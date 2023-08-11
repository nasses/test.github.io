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

	//MapperRegistry创建
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
### @CacheNamespace
```java
@CacheNamespace(implementation = PerpetualCache.class, eviction = LruCache.class, flushInterval = 6000, size = 1024, readWrite = true, blocking = false)
public interface ArticleMapper {

}
```
为给定的命名空间（比如类）配置缓存。
- `implementation`缓存的实现类
- `eviction` 缓存的淘汰策略
- `flushInterval` 刷新的秒数
- `size` 缓存的大小
- `readWrite` true会给所有调用者返回缓存的相同实例,false则会通过序列化返回缓存对象的拷贝,速度慢但更安全
- `blocking` true时会给缓存的get/set方法加锁

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

### @CacheNamespaceRef

二级缓存根据命名空间配置参照缓存

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
    LanguageDriver languageDriver = this.getLanguageDriver(method);//@Lang注解 默认XMLLanguageDriver
    SqlSource sqlSource = this.getSqlSourceFromAnnotations(method, parameterTypeClass, languageDriver);//获取sql //[!code hl]
    if (sqlSource != null) {
        Options options = (Options)method.getAnnotation(Options.class);//相关配置
        String mappedStatementId = this.type.getName() + "." + method.getName();
        Integer fetchSize = null;
        Integer timeout = null;
        StatementType statementType = StatementType.PREPARED;
        ResultSetType resultSetType = null;
        SqlCommandType sqlCommandType = this.getSqlCommandType(method);//sql类型
        boolean isSelect = sqlCommandType == SqlCommandType.SELECT;
        boolean flushCache = !isSelect;
        boolean useCache = isSelect;
        String keyProperty = null;
        String keyColumn = null;
        Object keyGenerator;
        if (!SqlCommandType.INSERT.equals(sqlCommandType) && !SqlCommandType.UPDATE.equals(sqlCommandType)) {
            keyGenerator = NoKeyGenerator.INSTANCE;//不用生成主键
        } else {
            SelectKey selectKey = (SelectKey)method.getAnnotation(SelectKey.class);//查询数据库自增主键注解，有些库不能有两个select语句，注解支持
            if (selectKey != null) {
                keyGenerator = this.handleSelectKeyAnnotation(selectKey, mappedStatementId, this.getParameterType(method), languageDriver);
                keyProperty = selectKey.keyProperty();
            } else if (options == null) {
                keyGenerator = this.configuration.isUseGeneratedKeys() ? Jdbc3KeyGenerator.INSTANCE : NoKeyGenerator.INSTANCE;//是否配置了全局主键生成器
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
            fetchSize = options.fetchSize() <= -1 && options.fetchSize() != Integer.MIN_VALUE ? null : options.fetchSize();
            timeout = options.timeout() > -1 ? options.timeout() : null;
            statementType = options.statementType();
            resultSetType = options.resultSetType();
        }
        String resultMapId = null;
        ResultMap resultMapAnnotation = (ResultMap)method.getAnnotation(ResultMap.class);
        if (resultMapAnnotation != null) {
            resultMapId = String.join(",", resultMapAnnotation.value());
        } else if (isSelect) {
            resultMapId = this.parseResultMap(method);//解析resultMap //[!code hl]
        }
        this.assistant.addMappedStatement(mappedStatementId, sqlSource, statementType, sqlCommandType, fetchSize, timeout, (String)null, parameterTypeClass, resultMapId, this.getReturnType(method), resultSetType, flushCache, useCache, false, (KeyGenerator)keyGenerator, keyProperty, keyColumn, (String)null, languageDriver, options != null ? this.nullOrEmpty(options.resultSets()) : null);//添加
    }

}
```

### getParameterType
```java
private Class<?> getParameterType(Method method) {
    Class<?> parameterType = null;//没有参数返回null
    Class<?>[] parameterTypes = method.getParameterTypes();
    for(int i = 0; i < parameterTypes.length; ++i) {
        Class<?> currentParameterType = parameterTypes[i];
		//除了这两种返回，都会认为参数类型是ParamMap
        if (!RowBounds.class.isAssignableFrom(currentParameterType) && !ResultHandler.class.isAssignableFrom(currentParameterType)) {//[!code hl]
            if (parameterType == null) {
                parameterType = currentParameterType;//参数只有一个的情况
            } else {
                parameterType = ParamMap.class;//多个参数都的情况都使用ParamMap //[!code hl]
            }
        }
    }
    return parameterType;
}
```
### @Select @Insert @Update @Delete 
```java
private SqlSource getSqlSourceFromAnnotations(Method method, Class<?> parameterType, LanguageDriver languageDriver) {
    try {
		//@Select @Insert @Update @Delete 
        Class<? extends Annotation> sqlAnnotationType = this.getSqlAnnotationType(method);
		//@SelectProvider @InsertProvider @UpdateProvider @DeleteProvider
        Class<? extends Annotation> sqlProviderAnnotationType = this.getSqlProviderAnnotationType(method);
        Annotation sqlProviderAnnotation;
        if (sqlAnnotationType != null) {
            if (sqlProviderAnnotationType != null) {//sql 和 sqlprovider 不能同时使用
                throw new BindingException("...");
            } else {
                sqlProviderAnnotation = method.getAnnotation(sqlAnnotationType);
                String[] strings = (String[])sqlProviderAnnotation.getClass().getMethod("value").invoke(sqlProviderAnnotation);
                return this.buildSqlSourceFromStrings(strings, parameterType, languageDriver);//构建sql
            }
        } else if (sqlProviderAnnotationType != null) {
            sqlProviderAnnotation = method.getAnnotation(sqlProviderAnnotationType);
            return new ProviderSqlSource(this.assistant.getConfiguration(), sqlProviderAnnotation, this.type, method);//构建 providerSql
        } else {
            return null;
        }
    } catch (Exception e) {
        throw new BuilderException("...");
    }
}
```

### buildSqlSourceFromStrings
```java
private SqlSource buildSqlSourceFromStrings(String[] strings, Class<?> parameterTypeClass, LanguageDriver languageDriver) {
    StringBuilder sql = new StringBuilder();
    for(int i = 0; i < strings.length; ++i) {
        sql.append(strings[i]);//@sql中的value，实际可以用,分隔多个sql
        sql.append(" ");
    }
    return languageDriver.createSqlSource(this.configuration, sql.toString().trim(), parameterTypeClass);
}
```

### @SelectKey
```java
private KeyGenerator handleSelectKeyAnnotation(SelectKey selectKeyAnnotation, String baseStatementId, Class<?> parameterTypeClass, LanguageDriver languageDriver) {
    String id = baseStatementId + "!selectKey";
    Class<?> resultTypeClass = selectKeyAnnotation.resultType();
    StatementType statementType = selectKeyAnnotation.statementType();
    String keyProperty = selectKeyAnnotation.keyProperty();
    String keyColumn = selectKeyAnnotation.keyColumn();
    boolean executeBefore = selectKeyAnnotation.before();
    boolean useCache = false;
    KeyGenerator keyGenerator = NoKeyGenerator.INSTANCE;
    Integer fetchSize = null;
    Integer timeout = null;
    boolean flushCache = false;
    String parameterMap = null;
    String resultMap = null;
    ResultSetType resultSetTypeEnum = null;
    SqlSource sqlSource = this.buildSqlSourceFromStrings(selectKeyAnnotation.statement(), parameterTypeClass, languageDriver);
    SqlCommandType sqlCommandType = SqlCommandType.SELECT;
    this.assistant.addMappedStatement(id, sqlSource, statementType, sqlCommandType, (Integer)fetchSize, (Integer)timeout, (String)parameterMap, parameterTypeClass, (String)resultMap, resultTypeClass, (ResultSetType)resultSetTypeEnum, flushCache, useCache, false, keyGenerator, keyProperty, keyColumn, (String)null, languageDriver, (String)null);//里面id也会添加namespace 
    id = this.assistant.applyCurrentNamespace(id, false);//添加namespace 
    MappedStatement keyStatement = this.configuration.getMappedStatement(id, false);
    SelectKeyGenerator answer = new SelectKeyGenerator(keyStatement, executeBefore);
    this.configuration.addKeyGenerator(id, answer);
    return answer;
}

```

### @ResultMap
```java
private String parseResultMap(Method method) {
    Class<?> returnType = this.getReturnType(method);
    ConstructorArgs args = (ConstructorArgs)method.getAnnotation(ConstructorArgs.class);//参数传递给结果对象的构造方法
    Results results = (Results)method.getAnnotation(Results.class);
    TypeDiscriminator typeDiscriminator = (TypeDiscriminator)method.getAnnotation(TypeDiscriminator.class);
    String resultMapId = this.generateResultMapName(method);
    this.applyResultMap(resultMapId, returnType, this.argsIf(args), this.resultsIf(results), typeDiscriminator);
    return resultMapId;
}
```

### generateResultMapName
```java
private String generateResultMapName(Method method) {
    Results results = (Results)method.getAnnotation(Results.class);
    if (results != null && !results.id().isEmpty()) {
        return this.type.getName() + "." + results.id();
    } else {
        StringBuilder suffix = new StringBuilder();
        Class[] clazzs = method.getParameterTypes();
        for(int i = 0; i < clazz.length; ++i) {
            Class<?> c = clazzs[i];
            suffix.append("-");
            suffix.append(c.getSimpleName());
        }
        if (suffix.length() < 1) {
            suffix.append("-void");
        }
        return this.type.getName() + "." + method.getName() + suffix;
    }
}
```

### applyResultMap
```java
private void applyResultMap(String resultMapId, Class<?> returnType, Arg[] args, Result[] results, TypeDiscriminator discriminator) {
    List<ResultMapping> resultMappings = new ArrayList();
    this.applyConstructorArgs(args, returnType, resultMappings);
    this.applyResults(results, returnType, resultMappings);
    Discriminator disc = this.applyDiscriminator(resultMapId, returnType, discriminator);
    this.assistant.addResultMap(resultMapId, returnType, (String)null, disc, resultMappings, (Boolean)null);
    this.createDiscriminatorResultMaps(resultMapId, returnType, discriminator);
}
```

### applyConstructorArgs
```java
private void applyConstructorArgs(Arg[] args, Class<?> resultType, List<ResultMapping> resultMappings) {]
    for(int i = 0; i < args.length; ++i) {
        Arg arg = args[i];
        List<ResultFlag> flags = new ArrayList();
        flags.add(ResultFlag.CONSTRUCTOR);
        if (arg.id()) {//是否有Id
            flags.add(ResultFlag.ID);
        }
        Class<? extends TypeHandler<?>> typeHandler = arg.typeHandler() == UnknownTypeHandler.class ? null : arg.typeHandler();
		//构造resultMap
        ResultMapping resultMapping = this.assistant.buildResultMapping(resultType, this.nullOrEmpty(arg.name()), this.nullOrEmpty(arg.column()), arg.javaType() == Void.TYPE ? null : arg.javaType(), arg.jdbcType() == JdbcType.UNDEFINED ? null : arg.jdbcType(), this.nullOrEmpty(arg.select()), this.nullOrEmpty(arg.resultMap()), (String)null, this.nullOrEmpty(arg.columnPrefix()), typeHandler, flags, (String)null, (String)null, false);
        resultMappings.add(resultMapping);
    }
}
```

### applyResults
```java
private void applyResults(Result[] results, Class<?> resultType, List<ResultMapping> resultMappings) {
    for(int i = 0; i < results.length; ++i) {
        Result result = results[i];
        List<ResultFlag> flags = new ArrayList();
        if (result.id()) {
            flags.add(ResultFlag.ID);
        }

        Class<? extends TypeHandler<?>> typeHandler = result.typeHandler() == UnknownTypeHandler.class ? null : result.typeHandler();
		//构建resultMap
        ResultMapping resultMapping = this.assistant.buildResultMapping(resultType, this.nullOrEmpty(result.property()), this.nullOrEmpty(result.column()), result.javaType() == Void.TYPE ? null : result.javaType(), result.jdbcType() == JdbcType.UNDEFINED ? null : result.jdbcType(), this.hasNestedSelect(result) ? this.nestedSelectId(result) : null, (String)null, (String)null, (String)null, typeHandler, flags, (String)null, (String)null, this.isLazy(result));
        resultMappings.add(resultMapping);
    }
}
```

### applyDiscriminator
```java
private Discriminator applyDiscriminator(String resultMapId, Class<?> resultType, TypeDiscriminator discriminator) {
    if (discriminator == null) {//鉴别器
        return null;
    } else {
        String column = discriminator.column();
        Class<?> javaType = discriminator.javaType() == Void.TYPE ? String.class : discriminator.javaType();
        JdbcType jdbcType = discriminator.jdbcType() == JdbcType.UNDEFINED ? null : discriminator.jdbcType();
        Class<? extends TypeHandler<?>> typeHandler = discriminator.typeHandler() == UnknownTypeHandler.class ? null : discriminator.typeHandler();
        Case[] cases = discriminator.cases();
        Map<String, String> discriminatorMap = new HashMap();
        for(Case c : cases) {
            String value = c.value();
            String caseResultMapId = resultMapId + "-" + value;
            discriminatorMap.put(value, caseResultMapId);
        }
        return this.assistant.buildDiscriminator(resultType, column, javaType, jdbcType, typeHandler, discriminatorMap);
    }
}
```

### createDiscriminatorResultMaps
```java
private void createDiscriminatorResultMaps(String resultMapId, Class<?> resultType, TypeDiscriminator discriminator) {
    if (discriminator != null) {
		Case[] cases = discriminator.cases();
        for(Case c: cases) {、
            String caseResultMapId = resultMapId + "-" + c.value();
            List<ResultMapping> resultMappings = new ArrayList();
            this.applyConstructorArgs(c.constructArgs(), resultType, resultMappings);
            this.applyResults(c.results(), resultType, resultMappings);
            this.assistant.addResultMap(caseResultMapId, c.type(), resultMapId, (Discriminator)null, resultMappings, (Boolean)null);
        }
    }
}
```

### @Result
```java
private void applyResults(Result[] results, Class<?> resultType, List<ResultMapping> resultMappings) {
    for(int i = 0; i < results.length; ++i) {
        Result result = results[i];
        List<ResultFlag> flags = new ArrayList();
        if (result.id()) {
            flags.add(ResultFlag.ID);
        }
        Class<? extends TypeHandler<?>> typeHandler = result.typeHandler() == UnknownTypeHandler.class ? null : result.typeHandler();
        ResultMapping resultMapping = this.assistant.buildResultMapping(resultType, this.nullOrEmpty(result.property()), this.nullOrEmpty(result.column()), result.javaType() == Void.TYPE ? null : result.javaType(), result.jdbcType() == JdbcType.UNDEFINED ? null : result.jdbcType(), this.hasNestedSelect(result) ? this.nestedSelectId(result) : null, (String)null, (String)null, (String)null, typeHandler, flags, (String)null, (String)null, this.isLazy(result));
        resultMappings.add(resultMapping);
    }
}
```