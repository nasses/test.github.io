# MapperBuilderAssistant

构建Mapper的辅助类，父类BaseBuilder是几个重要build类的基类
- XMLConfigBuilder
- MapperBuilderAssistant
- XMLMapperBuilder
- XMLScriptBuilder
- XMLStatementBuilder
- SqlSourceBuilder
- ParameterMappingTokenHandler

### BaseBuilder
```java
protected final Configuration configuration;
    protected final TypeAliasRegistry typeAliasRegistry;
    protected final TypeHandlerRegistry typeHandlerRegistry;

    public BaseBuilder(Configuration configuration) {
        this.configuration = configuration;
        this.typeAliasRegistry = this.configuration.getTypeAliasRegistry();
        this.typeHandlerRegistry = this.configuration.getTypeHandlerRegistry();
    }

	//别名查找类并创建对象
	protected Object createInstance(String alias) {
        Class<?> clazz = this.resolveClass(alias);
        if (clazz == null) {
            return null;
        } else {
            try {
                return this.resolveClass(alias).newInstance();
            } catch (Exception e) {
                throw new BuilderException("...");
            }
        }
    }

	//别名查找类
    protected <T> Class<? extends T> resolveClass(String alias) {
        if (alias == null) {
            return null;
        } else {
            try {
                return this.resolveAlias(alias);
            } catch (Exception e) {
                throw new BuilderException("...");
            }
        }
    }

	//根据别名找到TypeHandler，找不到就创建
    protected TypeHandler<?> resolveTypeHandler(Class<?> javaType, String typeHandlerAlias) {
        if (typeHandlerAlias == null) {
            return null;
        } else {
            Class<?> type = this.resolveClass(typeHandlerAlias);
            if (type != null && !TypeHandler.class.isAssignableFrom(type)) {
                throw new BuilderException("...");
            } else {
                return this.resolveTypeHandler(javaType, type);
            }
        }
    }
	
	//创建TypeHandler对象
    protected TypeHandler<?> resolveTypeHandler(Class<?> javaType, Class<? extends TypeHandler<?>> typeHandlerType) {
        if (typeHandlerType == null) {
            return null;
        } else {
            TypeHandler<?> handler = this.typeHandlerRegistry.getMappingTypeHandler(typeHandlerType);
            if (handler == null) {
                handler = this.typeHandlerRegistry.getInstance(javaType, typeHandlerType);
            }
            return handler;
        }
    }

	//别名查找类
    protected <T> Class<? extends T> resolveAlias(String alias) {
        return this.typeAliasRegistry.resolveAlias(alias);
    }
}
```

### MapperBuilderAssistant
```java
public class MapperBuilderAssistant extends BaseBuilder {
    private String currentNamespace;//当前命名空间
    private final String resource;//包下具体类文件
    private Cache currentCache;//当前一级缓存
    private boolean unresolvedCacheRef;//是否还有没解决的二级缓存

	//在MapperAnnotationBuilder创建
    public MapperBuilderAssistant(Configuration configuration, String resource) {
        super(configuration);
        ErrorContext.instance().resource(resource);
        this.resource = resource;
    }

	//handleSelectKeyAnnotation时使用，加上命名空间id前
	public String applyCurrentNamespace(String base, boolean isReference) {
        if (base == null) {
            return null;
        } else {
            if (isReference) {
                if (base.contains(".")) {
                    return base;
                }
            } else {
                if (base.startsWith(this.currentNamespace + ".")) {
                    return base;
                }
                if (base.contains(".")) {
                    throw new BuilderException("Dots are not allowed in element names, please remove it from " + base);
                }
            }
            return this.currentNamespace + "." + base;
        }
    }

	//获取当前命名空间的缓存
    public Cache useCacheRef(String namespace) {
        if (namespace == null) {
            throw new BuilderException("...");
        } else {
            try {
                this.unresolvedCacheRef = true;
                Cache cache = this.configuration.getCache(namespace);
                if (cache == null) {
                    throw new IncompleteElementException("...");
                } else {
                    this.currentCache = cache;
                    this.unresolvedCacheRef = false;
                    return cache;
                }
            } catch (IllegalArgumentException e) {
                throw new IncompleteElementException("...");
            }
        }
    }

	//添加新缓存
    public Cache useNewCache(Class<? extends Cache> typeClass, Class<? extends Cache> evictionClass, Long flushInterval, Integer size, boolean readWrite, boolean blocking, Properties props) {
        Cache cache = (new CacheBuilder(this.currentNamespace)).implementation((Class)this.valueOrDefault(typeClass, PerpetualCache.class)).addDecorator((Class)this.valueOrDefault(evictionClass, LruCache.class)).clearInterval(flushInterval).size(size).readWrite(readWrite).blocking(blocking).properties(props).build();
        this.configuration.addCache(cache);//添加缓存
        this.currentCache = cache;
        return cache;
    }

	//添加ParameterMap
    public ParameterMap addParameterMap(String id, Class<?> parameterClass, List<ParameterMapping> parameterMappings) {
        id = this.applyCurrentNamespace(id, false);
        ParameterMap parameterMap = (new Builder(this.configuration, id, parameterClass, parameterMappings)).build();
        this.configuration.addParameterMap(parameterMap);
        return parameterMap;
    }

	//构建ParameterMapping XMLMapperBuilder使用
    public ParameterMapping buildParameterMapping(Class<?> parameterType, String property, Class<?> javaType, JdbcType jdbcType, String resultMap, ParameterMode parameterMode, Class<? extends TypeHandler<?>> typeHandler, Integer numericScale) {
        resultMap = this.applyCurrentNamespace(resultMap, true);
        Class<?> javaTypeClass = this.resolveParameterJavaType(parameterType, property, javaType, jdbcType);
        TypeHandler<?> typeHandlerInstance = this.resolveTypeHandler(javaTypeClass, typeHandler);
        return (new org.apache.ibatis.mapping.ParameterMapping.Builder(this.configuration, property, javaTypeClass)).jdbcType(jdbcType).resultMapId(resultMap).mode(parameterMode).numericScale(numericScale).typeHandler(typeHandlerInstance).build();
    }

	//添加ResultMap
    public ResultMap addResultMap(String id, Class<?> type, String extend, Discriminator discriminator, List<ResultMapping> resultMappings, Boolean autoMapping) {
        id = this.applyCurrentNamespace(id, false);
        extend = this.applyCurrentNamespace(extend, true);//鉴别器时使用原来的resultMapId
        ResultMap resultMap;
        if (extend != null) {//鉴别器
            if (!this.configuration.hasResultMap(extend)) {//重复
                throw new IncompleteElementException("...");
            }
            resultMap = this.configuration.getResultMap(extend);//取出原来的
            List<ResultMapping> extendedResultMappings = new ArrayList(resultMap.getResultMappings());
            extendedResultMappings.removeAll(resultMappings);
            boolean declaresConstructor = false;
            for(ResultMapping resultMapping : resultMappings){
                if (resultMapping.getFlags().contains(ResultFlag.CONSTRUCTOR)) {
                    declaresConstructor = true;//声明了构造器
                    break;
                }
            }
            if (declaresConstructor) {//移除有构造器的
                extendedResultMappings.removeIf((resultMappingx) -> {
                    return resultMappingx.getFlags().contains(ResultFlag.CONSTRUCTOR);
                });
            }
            resultMappings.addAll(extendedResultMappings);
        }

        resultMap = (new org.apache.ibatis.mapping.ResultMap.Builder(this.configuration, id, type, resultMappings, autoMapping)).discriminator(discriminator).build();
        this.configuration.addResultMap(resultMap);//添加resultMap
        return resultMap;
    }
	
	//构造鉴别器
    public Discriminator buildDiscriminator(Class<?> resultType, String column, Class<?> javaType, JdbcType jdbcType, Class<? extends TypeHandler<?>> typeHandler, Map<String, String> discriminatorMap) {
        ResultMapping resultMapping = this.buildResultMapping(resultType, (String)null, column, javaType, jdbcType, (String)null, (String)null, (String)null, (String)null, typeHandler, new ArrayList(), (String)null, (String)null, false);
        Map<String, String> namespaceDiscriminatorMap = new HashMap();
        Iterator iterator = discriminatorMap.entrySet().iterator();
        while(iterator.hasNext()) {
            Entry<String, String> e = (Entry)iterator.next();
            String resultMap = (String)e.getValue();
            resultMap = this.applyCurrentNamespace(resultMap, true);
            namespaceDiscriminatorMap.put((String)e.getKey(), resultMap);
        }
        return (new org.apache.ibatis.mapping.Discriminator.Builder(this.configuration, resultMapping, namespaceDiscriminatorMap)).build();
    }

	//添加单个sql statement
    public MappedStatement addMappedStatement(String id, SqlSource sqlSource, StatementType statementType, SqlCommandType sqlCommandType, Integer fetchSize, Integer timeout, String parameterMap, Class<?> parameterType, String resultMap, Class<?> resultType, ResultSetType resultSetType, boolean flushCache, boolean useCache, boolean resultOrdered, KeyGenerator keyGenerator, String keyProperty, String keyColumn, String databaseId, LanguageDriver lang, String resultSets) {
        if (this.unresolvedCacheRef) {
            throw new IncompleteElementException("Cache-ref not yet resolved");
        } else {
            id = this.applyCurrentNamespace(id, false);
            boolean isSelect = sqlCommandType == SqlCommandType.SELECT;
            org.apache.ibatis.mapping.MappedStatement.Builder statementBuilder = (new org.apache.ibatis.mapping.MappedStatement.Builder(this.configuration, id, sqlSource, sqlCommandType)).resource(this.resource).fetchSize(fetchSize).timeout(timeout).statementType(statementType).keyGenerator(keyGenerator).keyProperty(keyProperty).keyColumn(keyColumn).databaseId(databaseId).lang(lang).resultOrdered(resultOrdered).resultSets(resultSets).resultMaps(this.getStatementResultMaps(resultMap, resultType, id)).resultSetType(resultSetType).flushCacheRequired((Boolean)this.valueOrDefault(flushCache, !isSelect)).useCache((Boolean)this.valueOrDefault(useCache, isSelect)).cache(this.currentCache);
            ParameterMap statementParameterMap = this.getStatementParameterMap(parameterMap, parameterType, id);
            if (statementParameterMap != null) {
                statementBuilder.parameterMap(statementParameterMap);
            }

            MappedStatement statement = statementBuilder.build();
            this.configuration.addMappedStatement(statement);
            return statement;
        }
    }
	
	//获取参数Map
    private ParameterMap getStatementParameterMap(String parameterMapName, Class<?> parameterTypeClass, String statementId) {
        parameterMapName = this.applyCurrentNamespace(parameterMapName, true);
        ParameterMap parameterMap = null;
        if (parameterMapName != null) {
            try {
                parameterMap = this.configuration.getParameterMap(parameterMapName);
            } catch (IllegalArgumentException e) {
                throw new IncompleteElementException("...");
            }
        } else if (parameterTypeClass != null) {
            List<ParameterMapping> parameterMappings = new ArrayList();
            parameterMap = (new Builder(this.configuration, statementId + "-Inline", parameterTypeClass, parameterMappings)).build();
        }

        return parameterMap;
    }

	//获取 resultMap
    private List<ResultMap> getStatementResultMaps(String resultMap, Class<?> resultType, String statementId) {
        resultMap = this.applyCurrentNamespace(resultMap, true);
        List<ResultMap> resultMaps = new ArrayList();
        if (resultMap != null) {
            String[] resultMapNames = resultMap.split(",");
            for(String resultMapName : resultMapNames) {
                try {
                    resultMaps.add(this.configuration.getResultMap(resultMapName.trim()));
                } catch (IllegalArgumentException e) {
                    throw new IncompleteElementException("...");
                }
            }
        } else if (resultType != null) {
            ResultMap inlineResultMap = (new org.apache.ibatis.mapping.ResultMap.Builder(this.configuration, statementId + "-Inline", resultType, new ArrayList(), (Boolean)null)).build();
            resultMaps.add(inlineResultMap);
        }
        return resultMaps;
    }
	
	//构造resultMapping
    public ResultMapping buildResultMapping(Class<?> resultType, String property, String column, Class<?> javaType, JdbcType jdbcType, String nestedSelect, String nestedResultMap, String notNullColumn, String columnPrefix, Class<? extends TypeHandler<?>> typeHandler, List<ResultFlag> flags, String resultSet, String foreignColumn, boolean lazy) {
        Class<?> javaTypeClass = this.resolveResultJavaType(resultType, property, javaType);
        TypeHandler<?> typeHandlerInstance = this.resolveTypeHandler(javaTypeClass, typeHandler);
        List<ResultMapping> composites = this.parseCompositeColumnName(column);
        return (new org.apache.ibatis.mapping.ResultMapping.Builder(this.configuration, property, column, javaTypeClass)).jdbcType(jdbcType).nestedQueryId(this.applyCurrentNamespace(nestedSelect, true)).nestedResultMapId(this.applyCurrentNamespace(nestedResultMap, true)).resultSet(resultSet).typeHandler(typeHandlerInstance).flags((List)(flags == null ? new ArrayList() : flags)).composites(composites).notNullColumns(this.parseMultipleColumnNames(notNullColumn)).columnPrefix(columnPrefix).foreignColumn(foreignColumn).lazy(lazy).build();
    }

	//解析多列
    private Set<String> parseMultipleColumnNames(String columnName) {
        Set<String> columns = new HashSet();
        if (columnName != null) {
            if (columnName.indexOf(',') > -1) {
                StringTokenizer parser = new StringTokenizer(columnName, "{}, ", false);
                while(parser.hasMoreTokens()) {
                    String column = parser.nextToken();
                    columns.add(column);
                }
            } else {
                columns.add(columnName);
            }
        }

        return columns;
    }

	//解析混合列名
    private List<ResultMapping> parseCompositeColumnName(String columnName) {
        List<ResultMapping> composites = new ArrayList();
        if (columnName != null && (columnName.indexOf('=') > -1 || columnName.indexOf(',') > -1)) {
            StringTokenizer parser = new StringTokenizer(columnName, "{}=, ", false);
            while(parser.hasMoreTokens()) {
                String property = parser.nextToken();
                String column = parser.nextToken();
                ResultMapping complexResultMapping = (new org.apache.ibatis.mapping.ResultMapping.Builder(this.configuration, property, column, this.configuration.getTypeHandlerRegistry().getUnknownTypeHandler())).build();
                composites.add(complexResultMapping);
            }
        }
        return composites;
    }

	//找到resultType具体属性的Class
    private Class<?> resolveResultJavaType(Class<?> resultType, String property, Class<?> javaType) {
        if (javaType == null && property != null) {
            try {
                MetaClass metaResultType = MetaClass.forClass(resultType, this.configuration.getReflectorFactory());
                javaType = metaResultType.getSetterType(property);
            } catch (Exception e) {
            }
        }
        if (javaType == null) {
            javaType = Object.class;
        }
        return javaType;
    }
	
	//
    private Class<?> resolveParameterJavaType(Class<?> resultType, String property, Class<?> javaType, JdbcType jdbcType) {
        if (javaType == null) {
            if (JdbcType.CURSOR.equals(jdbcType)) {
                javaType = ResultSet.class;
            } else if (Map.class.isAssignableFrom(resultType)) {
                javaType = Object.class;
            } else {
                MetaClass metaResultType = MetaClass.forClass(resultType, this.configuration.getReflectorFactory());
                javaType = metaResultType.getGetterType(property);
            }
        }
        if (javaType == null) {
            javaType = Object.class;
        }
        return javaType;
    }

    public ResultMapping buildResultMapping(Class<?> resultType, String property, String column, Class<?> javaType, JdbcType jdbcType, String nestedSelect, String nestedResultMap, String notNullColumn, String columnPrefix, Class<? extends TypeHandler<?>> typeHandler, List<ResultFlag> flags) {
        return this.buildResultMapping(resultType, property, column, javaType, jdbcType, nestedSelect, nestedResultMap, notNullColumn, columnPrefix, typeHandler, flags, (String)null, (String)null, this.configuration.isLazyLoadingEnabled());
    }


    public MappedStatement addMappedStatement(String id, SqlSource sqlSource, StatementType statementType, SqlCommandType sqlCommandType, Integer fetchSize, Integer timeout, String parameterMap, Class<?> parameterType, String resultMap, Class<?> resultType, ResultSetType resultSetType, boolean flushCache, boolean useCache, boolean resultOrdered, KeyGenerator keyGenerator, String keyProperty, String keyColumn, String databaseId, LanguageDriver lang) {
        return this.addMappedStatement(id, sqlSource, statementType, sqlCommandType, fetchSize, timeout, parameterMap, parameterType, resultMap, resultType, resultSetType, flushCache, useCache, resultOrdered, keyGenerator, keyProperty, keyColumn, databaseId, lang, (String)null);
    }
}

```