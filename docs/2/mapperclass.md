# mapper注解类解析

### MapperAnnotationBuilder
```java
public class MapperAnnotationBuilder {
    private static final Set<Class<? extends Annotation>> SQL_ANNOTATION_TYPES = new HashSet();//sql注解
    private static final Set<Class<? extends Annotation>> SQL_PROVIDER_ANNOTATION_TYPES = new HashSet();//sqlprovider注解
    private final Configuration configuration;
    private final MapperBuilderAssistant assistant;//mapper辅助类，后续会分析
    private final Class<?> type;// 被代理的Mapper接口
	
	static {
        SQL_ANNOTATION_TYPES.add(Select.class);//@注解
        SQL_ANNOTATION_TYPES.add(Insert.class);
        SQL_ANNOTATION_TYPES.add(Update.class);
        SQL_ANNOTATION_TYPES.add(Delete.class);
        SQL_PROVIDER_ANNOTATION_TYPES.add(SelectProvider.class);//@注解 提供指定类来构建sql
        SQL_PROVIDER_ANNOTATION_TYPES.add(InsertProvider.class);
        SQL_PROVIDER_ANNOTATION_TYPES.add(UpdateProvider.class);
        SQL_PROVIDER_ANNOTATION_TYPES.add(DeleteProvider.class);
    }

	public MapperAnnotationBuilder(Configuration configuration, Class<?> type) {
        String resource = type.getName().replace('.', '/') + ".java (best guess)";
        this.assistant = new MapperBuilderAssistant(configuration, resource);
        this.configuration = configuration;
        this.type = type;
    }

	public void parse() {
        String resource = this.type.toString();
        if (!this.configuration.isResourceLoaded(resource)) {//配置是不是加载过了
            this.loadXmlResource();//查看是否有xml并加载
            this.configuration.addLoadedResource(resource);//类存的是包名，xml存的是路径，不过会额外存一个namespace:类路径
            this.assistant.setCurrentNamespace(this.type.getName());
            this.parseCache();//一级缓存
            this.parseCacheRef();//二级缓存
            Method[] methods = this.type.getMethods();
            for(int i = 0; i < methods.length; ++i) {
                Method method = methods[i];
                try {
                    if (!method.isBridge()) {//桥接方法 子类泛型擦除后补充的强制转型方法
                        this.parseStatement(method);//解析 sql
                    }
                } catch (IncompleteElementException e) {
                    this.configuration.addIncompleteMethod(new MethodResolver(this, method));//未解析完的，涉及到级联引用
                }
            }
        }
        this.parsePendingMethods();//未解析完的方法解析
    }
	
	....	
}
```

### loadXmlResource
```java
private void loadXmlResource() {
    if (!this.configuration.isResourceLoaded("namespace:" + this.type.getName())) {
        String xmlResource = this.type.getName().replace('.', '/') + ".xml";
        InputStream inputStream = this.type.getResourceAsStream("/" + xmlResource);
        if (inputStream == null) {
            try {
                inputStream = Resources.getResourceAsStream(this.type.getClassLoader(), xmlResource);
            } catch (IOException e) {
            }
        }
        if (inputStream != null) {
            XMLMapperBuilder xmlParser = new XMLMapperBuilder(inputStream, this.assistant.getConfiguration(), xmlResource, this.configuration.getSqlFragments(), this.type.getName());
            xmlParser.parse();//后续解析
        }
    }
}
```
### parseCache
```java
private void parseCache() {
    CacheNamespace cacheDomain = (CacheNamespace)this.type.getAnnotation(CacheNamespace.class);//@CacheNamespace注解
    if (cacheDomain != null) {
        Integer size = cacheDomain.size() == 0 ? null : cacheDomain.size();
        Long flushInterval = cacheDomain.flushInterval() == 0L ? null : cacheDomain.flushInterval();
        Properties props = this.convertToProperties(cacheDomain.properties());//注解配置提取转换
        this.assistant.useNewCache(cacheDomain.implementation(), cacheDomain.eviction(), flushInterval, size, cacheDomain.readWrite(), cacheDomain.blocking(), props);//设置以及缓存 // [!code hl]
    }
}
```
```java
private Properties convertToProperties(Property[] properties) {
    if (properties.length == 0) {
        return null;
    } else {
        Properties props = new Properties();
        for(int i = 0; i < properties.length; ++i) {
            Property property = properties[i];
            props.setProperty(property.name(), PropertyParser.parse(property.value(), this.configuration.getVariables()));
        }
        return props;
    }
}
```

### parseCacheRef
```java 
private void parseCacheRef() {
    CacheNamespaceRef cacheDomainRef = (CacheNamespaceRef)this.type.getAnnotation(CacheNamespaceRef.class);//@CacheNamespaceRef注解
    if (cacheDomainRef != null) {
        Class<?> refType = cacheDomainRef.value();
        String refName = cacheDomainRef.name();
        if (refType == Void.TYPE && refName.isEmpty()) {//不能都空
            throw new BuilderException("...");
        }
        if (refType != Void.TYPE && !refName.isEmpty()) {//不能一起用
            throw new BuilderException("");
        }
        String namespace = refType != Void.TYPE ? refType.getName() : refName;
        try {
            this.assistant.useCacheRef(namespace);//设置二级缓存 //[!code hl]
        } catch (IncompleteElementException e) {
            this.configuration.addIncompleteCacheRef(new CacheRefResolver(this.assistant, namespace));//未完成的记录
        }
    }

}
```
### parseStatement
```java
void parseStatement(Method method) {
    Class<?> parameterTypeClass = this.getParameterType(method);//入参
    LanguageDriver languageDriver = this.getLanguageDriver(method);//@Lang注解
    SqlSource sqlSource = this.getSqlSourceFromAnnotations(method, parameterTypeClass, languageDriver);
    if (sqlSource != null) {
        Options options = (Options)method.getAnnotation(Options.class);
        String mappedStatementId = this.type.getName() + "." + method.getName();
        Integer fetchSize = null;
        Integer timeout = null;
        StatementType statementType = StatementType.PREPARED;
        ResultSetType resultSetType = null;
        SqlCommandType sqlCommandType = this.getSqlCommandType(method);
        boolean isSelect = sqlCommandType == SqlCommandType.SELECT;
        boolean flushCache = !isSelect;
        boolean useCache = isSelect;
        String keyProperty = null;
        String keyColumn = null;
        Object keyGenerator;
        if (!SqlCommandType.INSERT.equals(sqlCommandType) && !SqlCommandType.UPDATE.equals(sqlCommandType)) {
            keyGenerator = NoKeyGenerator.INSTANCE;
        } else {
            SelectKey selectKey = (SelectKey)method.getAnnotation(SelectKey.class);
            if (selectKey != null) {
                keyGenerator = this.handleSelectKeyAnnotation(selectKey, mappedStatementId, this.getParameterType(method), languageDriver);
                keyProperty = selectKey.keyProperty();
            } else if (options == null) {
                keyGenerator = this.configuration.isUseGeneratedKeys() ? Jdbc3KeyGenerator.INSTANCE : NoKeyGenerator.INSTANCE;
            } else {
                keyGenerator = options.useGeneratedKeys() ? Jdbc3KeyGenerator.INSTANCE : NoKeyGenerator.INSTANCE;
                keyProperty = options.keyProperty();
                keyColumn = options.keyColumn();
            }
        }

        if (options != null) {
            if (FlushCachePolicy.TRUE.equals(options.flushCache())) {
                flushCache = true;
            } else if (FlushCachePolicy.FALSE.equals(options.flushCache())) {
                flushCache = false;
            }

            useCache = options.useCache();
            fetchSize = options.fetchSize() <= -1 && options.fetchSize() != -2147483648 ? null : options.fetchSize();
            timeout = options.timeout() > -1 ? options.timeout() : null;
            statementType = options.statementType();
            resultSetType = options.resultSetType();
        }

        String resultMapId = null;
        ResultMap resultMapAnnotation = (ResultMap)method.getAnnotation(ResultMap.class);
        if (resultMapAnnotation != null) {
            resultMapId = String.join(",", resultMapAnnotation.value());
        } else if (isSelect) {
            resultMapId = this.parseResultMap(method);
        }

        this.assistant.addMappedStatement(mappedStatementId, sqlSource, statementType, sqlCommandType, fetchSize, timeout, (String)null, parameterTypeClass, resultMapId, this.getReturnType(method), resultSetType, flushCache, useCache, false, (KeyGenerator)keyGenerator, keyProperty, keyColumn, (String)null, languageDriver, options != null ? this.nullOrEmpty(options.resultSets()) : null);
    }

}
```