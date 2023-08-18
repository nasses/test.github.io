# XMLMapperBuilder
> mappers -> mapper -> resource or url

### XMLMapperBuilder
```java
public class XMLMapperBuilder extends BaseBuilder {
    private final XPathParser parser;//解析mapper子节点
    private final MapperBuilderAssistant builderAssistant;//mapper辅助类
    private final Map<String, XNode> sqlFragments;
    private final String resource;

	public void parse() {
        if (!this.configuration.isResourceLoaded(this.resource)) {
            this.configurationElement(this.parser.evalNode("/mapper"));
            this.configuration.addLoadedResource(this.resource);
            this.bindMapperForNamespace();
        }
        this.parsePendingResultMaps();
        this.parsePendingCacheRefs();
        this.parsePendingStatements();
    }

	//mapper节点解析
	private void configurationElement(XNode context) {
        try {
            String namespace = context.getStringAttribute("namespace");
            if (namespace != null && !namespace.equals("")) {
                this.builderAssistant.setCurrentNamespace(namespace);
                this.cacheRefElement(context.evalNode("cache-ref"));
                this.cacheElement(context.evalNode("cache"));
                this.parameterMapElement(context.evalNodes("/mapper/parameterMap"));
                this.resultMapElements(context.evalNodes("/mapper/resultMap"));
                this.sqlElement(context.evalNodes("/mapper/sql"));
                this.buildStatementFromContext(context.evalNodes("select|insert|update|delete"));
            } else {
                throw new BuilderException("Mapper's namespace cannot be empty");
            }
        } catch (Exception e) {
            throw new BuilderException("...");
        }
    }
}
```

### cache

MyBatis 提供了一、二级缓存，其中一级缓存是 SqlSession 级别的，默认为开启状态
二级缓存配置在映射文件中，使用者需要显示配置才能开启.

<cache  eviction="FIFO"  flushInterval="60000"  size="512" readOnly="true"/>
 
- type:可以通过配置实现自己的缓存,但必须实现Cache接口 常用的EhcacheCache
- eviction:淘汰缓存的策略 FIFO先进先出 LRU最近最小使用(默认) SOFT基于垃圾回收和软引用规则 WEAK基于垃圾回收器和弱引用规则
- flushInterval:刷新间隔(毫秒) 不设置则没有,会在调用下一个语句是刷新
- size:引用数目,默认1024
- readOnly:只读,会给所有调用者返回缓存的相同实例,false则会通过序列化返回缓存对象的拷贝,速度慢但更安全
    
### cacheElement
```java
private void cacheElement(XNode context) {
    if (context != null) {
        String type = context.getStringAttribute("type", "PERPETUAL");//获取实现类
        Class<? extends Cache> typeClass = this.typeAliasRegistry.resolveAlias(type);//查找实现类
        String eviction = context.getStringAttribute("eviction", "LRU");//获取淘汰规则
        Class<? extends Cache> evictionClass = this.typeAliasRegistry.resolveAlias(eviction);//查找规则类
        Long flushInterval = context.getLongAttribute("flushInterval");//获取刷新间隔
        Integer size = context.getIntAttribute("size");//获取大小
        boolean readWrite = !context.getBooleanAttribute("readOnly", false);//是否只读,不是拷贝
        boolean blocking = context.getBooleanAttribute("blocking", false);//是否阻塞
        Properties props = context.getChildrenAsProperties();
        this.builderAssistant.useNewCache(typeClass, evictionClass, flushInterval, size, readWrite, blocking, props);//[!code hl]
    }
}
```
```java
public Cache useNewCache(Class<? extends Cache> typeClass, Class<? extends Cache> evictionClass, Long flushInterval, Integer size, boolean readWrite, boolean blocking, Properties props) {
    Cache cache = (new CacheBuilder(this.currentNamespace))
            .implementation(valueOrDefault(typeClass, PerpetualCache.class))
            .addDecorator(valueOrDefault(evictionClass, LruCache.class))
            .clearInterval(flushInterval).size(size)
            .readWrite(readWrite).blocking(blocking).properties(props).build();
    this.configuration.addCache(cache);
    this.currentCache = cache;
    return cache;
}
```


### cache-ref
```xml
在MyBatis中，二级缓存是可以共用的。这需要通过<cache-ref>节点为命名空间配置参照缓存
    
<!-- Mapper1.xml --> 
<mapper namespace="xyz.coolblog.dao.Mapper1"> 
    <!-- Mapper1 与 Mapper2 共用一个二级缓存 --> 
    <cache-ref namespace="xyz.coolblog.dao.Mapper2"/> 
</mapper> 
     
<!-- Mapper2.xml --> 
<mapper namespace="xyz.coolblog.dao.Mapper2"> 
    <cache/> 
</mapper> 
```
```java
private void cacheRefElement(XNode context) {
    if (context != null) {
        this.configuration.addCacheRef(this.builderAssistant.getCurrentNamespace(), context.getStringAttribute("namespace"));
        CacheRefResolver cacheRefResolver = new CacheRefResolver(this.builderAssistant, context.getStringAttribute("namespace"));
        try {
            cacheRefResolver.resolveCacheRef();// builderAssistant.useCacheRef(this.cacheRefNamespace);
        } catch (IncompleteElementException e) {
            this.configuration.addIncompleteCacheRef(cacheRefResolver);
        }
    }
}
```

### 解析parameterMap节点
```xml
<parameterMap id="article" type="com.nasses.mybatis.chapter01.mybatis.model.Article" >
    <parameter property="content" resultMap="" javaType="" jdbcType="" mode="" scale="" typeHandler=""></parameter>
    <parameter property="title" resultMap="" javaType="" jdbcType="" mode="" scale="" typeHandler=""></parameter>
</parameterMap>
```
```java
private void parameterMapElement(List<XNode> list) {
    for(XNode parameterMapNode : list){
        String id = parameterMapNode.getStringAttribute("id");
        String type = parameterMapNode.getStringAttribute("type");
        Class<?> parameterClass = resolveClass(type);//查找参数类
        List<XNode> parameterNodes = parameterMapNode.evalNodes("parameter");
        List<ParameterMapping> parameterMappings = new ArrayList();
        for(XNode parameterNode : parameterNodes) {
            String property = parameterNode.getStringAttribute("property");
            String javaType = parameterNode.getStringAttribute("javaType");
            String jdbcType = parameterNode.getStringAttribute("jdbcType");
            String resultMap = parameterNode.getStringAttribute("resultMap");
            String mode = parameterNode.getStringAttribute("mode");
            String typeHandler = parameterNode.getStringAttribute("typeHandler");
            Integer numericScale = parameterNode.getIntAttribute("numericScale");
            ParameterMode modeEnum = resolveParameterMode(mode);
            Class<?> javaTypeClass = resolveClass(javaType);
            JdbcType jdbcTypeEnum = resolveJdbcType(jdbcType);
            Class<? extends TypeHandler<?>> typeHandlerClass = resolveClass(typeHandler);
            ParameterMapping parameterMapping = this.builderAssistant.buildParameterMapping(parameterClass, property, javaTypeClass, jdbcTypeEnum, resultMap, modeEnum, typeHandlerClass, numericScale);//[!code hl]
            parameterMappings.add(parameterMapping);//一个对应多条属性
        }
        this.builderAssistant.addParameterMap(id, parameterClass, parameterMappings);//根据id对应 //[!code hl]
    }
}
```
```java
public ParameterMapping buildParameterMapping(Class<?> parameterType, String property, Class<?> javaType, JdbcType jdbcType, String resultMap, ParameterMode parameterMode, Class<? extends TypeHandler<?>> typeHandler, Integer numericScale) {
    resultMap = applyCurrentNamespace(resultMap, true);//在resultMap名字前加上namespace
    Class<?> javaTypeClass = resolveParameterJavaType(parameterType, property, javaType, jdbcType);
    TypeHandler<?> typeHandlerInstance = this.resolveTypeHandler(javaTypeClass, typeHandler);
    return (new ParameterMapping.Builder(this.configuration, property, javaTypeClass)).jdbcType(jdbcType).resultMapId(resultMap).mode(parameterMode).numericScale(numericScale).typeHandler(typeHandlerInstance).build();
}
```

### 解析resultMap节点
```xml
<resultMap id="articleResult" type="com.nasses.mybatis.chapter01.mybatis.model.Article">
    <id property="id" column="id" />
    <result property="title" column="title"/>
    <result property="type" column="type" typeHandler="com.nasses.mybatis.chapter01.mybatis.model.ArticleTypeHandler"/>
    <result property="content" column="content"/>
    <result property="createTime" column="create_time"/>
    <association property="author" javaType="com.nasses.mybatis.chapter01.mybatis.model.Author" resultMap="authorResult"/>
</resultMap>
```
```java
private ResultMap resultMapElement(XNode resultMapNode, List<ResultMapping> additionalResultMappings, Class<?> enclosingType) throws Exception {
    ErrorContext.instance().activity("processing " + resultMapNode.getValueBasedIdentifier());
    String type = resultMapNode.getStringAttribute("type", resultMapNode.getStringAttribute("ofType", resultMapNode.getStringAttribute("resultType", resultMapNode.getStringAttribute("javaType"))));
    Class<?> typeClass = resolveClass(type);
    if (typeClass == null) {//如果没有type
        typeClass = inheritEnclosingType(resultMapNode, enclosingType);//可能是association或者case
    }
    Discriminator discriminator = null;//鉴别器
    List<ResultMapping> resultMappings = new ArrayList();//映射对象
    resultMappings.addAll(additionalResultMappings);
    List<XNode> resultChildren = resultMapNode.getChildren();
    for(XNode resultChild : resultChildren) {
        if ("constructor".equals(resultChild.getName())) {
            processConstructorElement(resultChild, typeClass, resultMappings);//构造器解析
        } else if ("discriminator".equals(resultChild.getName())) {
            discriminator = processDiscriminatorElement(resultChild, typeClass, resultMappings);//鉴别器解析
        } else {
            List<ResultFlag> flags = new ArrayList();
            if ("id".equals(resultChild.getName())) {//<id property="id" column="id" />
                flags.add(ResultFlag.ID);
            }
            resultMappings.add(buildResultMappingFromContext(resultChild, typeClass, flags));
        }
    }
    String id = resultMapNode.getStringAttribute("id", resultMapNode.getValueBasedIdentifier());
    String extend = resultMapNode.getStringAttribute("extends");
    Boolean autoMapping = resultMapNode.getBooleanAttribute("autoMapping");
    ResultMapResolver resultMapResolver = new ResultMapResolver(this.builderAssistant, id, typeClass, extend, discriminator, resultMappings, autoMapping);
    try {
        return resultMapResolver.resolve();//构建ResultMap对象
    } catch (IncompleteElementException e) {
        this.configuration.addIncompleteResultMap(resultMapResolver);
        throw e;
    }
}
```
```java
protected Class<?> inheritEnclosingType(XNode resultMapNode, Class<?> enclosingType) {
    if ("association".equals(resultMapNode.getName()) && resultMapNode.getStringAttribute("resultMap") == null) {
        String property = resultMapNode.getStringAttribute("property");
        if (property != null && enclosingType != null) {
            MetaClass metaResultType = MetaClass.forClass(enclosingType, this.configuration.getReflectorFactory());
            return metaResultType.getSetterType(property);
        }
    } else if ("case".equals(resultMapNode.getName()) && resultMapNode.getStringAttribute("resultMap") == null) {
        return enclosingType;
    }
    return null;
}
```

### 级联association
```xml
<resultMap id="articleResult" type="com.nasses.mybatis.chapter01.mybatis.model.Article">
    <id property="id" column="id" />
    <result property="title" column="title"/>
    <result property="type" column="type" typeHandler="com.nasses.mybatis.chapter01.mybatis.model.ArticleTypeHandler"/>
    <result property="content" column="content"/>
    <result property="createTime" column="create_time"/>
    <association property="author" javaType="com.nasses.mybatis.chapter01.mybatis.model.Author" resultMap="authorResult"/>
</resultMap>

association代表一对一的关系
不仅可以指定java类和resultMap,还可以 通过column和select来指定查询
<association property="author" column="id" select="xxx.mapper.AuthorMapper.findById"/>

使用select时,fetchType可以选择lazy或者eager,lazy的话,只有在getAuthor时才会查询
<resultMap id="articleResult2" type="com.nasses.mybatis.chapter01.mybatis.model.Article">
    <id property="id" column="id" />
    <result property="title" column="title"/>
    <result property="type" column="type" typeHandler="com.nasses.mybatis.chapter01.mybatis.model.ArticleTypeHandler"/>
    <result property="content" column="content"/>
    <result property="createTime" column="create_time"/>
    <association property="author" column="{id=author_id}" fetchType="lazy" select="com.nasses.mybatis.chapter01.mybatis.model.AuthorDao.selectOne" />
</resultMap>

```
### 构造器constructor
```xml
<constructor> 
    <idArg column="id" name="id"/> 
    <arg column="title" name="title"/> 
    <arg column="content" name="content"/> 
</constructor> 
```
```java
private void processConstructorElement(XNode resultChild, Class<?> resultType, List<ResultMapping> resultMappings) throws Exception {
    List<XNode> argChildren = resultChild.getChildren();
    for(XNode argChild: argChildren){
        ArrayList flags = new ArrayList();
        flags.add(ResultFlag.CONSTRUCTOR);//标记为构造器
        if ("idArg".equals(argChild.getName())) {
            flags.add(ResultFlag.ID);
        }
        resultMappings.add(buildResultMappingFromContext(argChild, resultType, flags));//循环调用
    }
}
```
### discriminator鉴别器
```xml
多级嵌套时,只查询某个属性性能不好,单独写比较麻烦,不够灵活
<resultMap id="FullResultMap" type="xxx.RoleModel">
    <result column="transaction_id" jdbcType="VATCHAR" property="transactionId"/>
    <collection column="role_id" ofType="xxx.UserModel" property="userList" select="selectUserByRoleId"/>
    <collection column="role_id" ofType="xxx.GroupModel" property="groupList" select="selectGroupByRoleId"/>
    <collection column="role_id" ofType="xxx.PermissionModel" property="permissionList" select="selectPermissionByRoleId"/>
</resultMap>
可以根据实体类中role_flag的值动态选择
<resultMap id="FullResultMap" type="xxx.RoleModel">
    <discriminator javaType="java.lang.Integer" column="role_flag"/>
        <case value="1" resultMap="xxx.RoleUserMap"/>
        <case value="2" resultMap="xxx.RoleGroupMap"/>
        <case value="3" resultMap="xxx.RolePermissionMap"/>
    </discriminator>
</resultMap>
```
```java
private Discriminator processDiscriminatorElement(XNode context, Class<?> resultType, List<ResultMapping> resultMappings) throws Exception {
    String column = context.getStringAttribute("column");
    String javaType = context.getStringAttribute("javaType");
    String jdbcType = context.getStringAttribute("jdbcType");
    String typeHandler = context.getStringAttribute("typeHandler");
    Class<?> javaTypeClass = resolveClass(javaType);
    Class<? extends TypeHandler<?>> typeHandlerClass = resolveClass(typeHandler);
    JdbcType jdbcTypeEnum = resolveJdbcType(jdbcType);
    Map<String, String> discriminatorMap = new HashMap();
    for(XNode caseChild : context.getChildren()) {//多个case对应多种resultMap
        String value = caseChild.getStringAttribute("value");
        String resultMap = caseChild.getStringAttribute("resultMap", processNestedResultMappings(caseChild, resultMappings, resultType));
        discriminatorMap.put(value, resultMap);
    }
    return this.builderAssistant.buildDiscriminator(resultType, column, javaTypeClass, jdbcTypeEnum, typeHandlerClass, discriminatorMap);
}
```
```java
public Discriminator buildDiscriminator(Class<?> resultType, String column, Class<?> javaType, JdbcType jdbcType, Class<? extends TypeHandler<?>> typeHandler, Map<String, String> discriminatorMap) {
    ResultMapping resultMapping = buildResultMapping(resultType, null, column, javaType, jdbcType, null, null, null, null, typeHandler, new ArrayList(), null, null, false);
    Map<String, String> namespaceDiscriminatorMap = new HashMap();
    for(Map.Entry<String, String> entry : discriminatorMap.entrySet()){
        String resultMap = entry.getValue();
        resultMap = applyCurrentNamespace(resultMap, true);
        namespaceDiscriminatorMap.put(entry.getKey(), resultMap);
    }
    return (new Discriminator.Builder(this.configuration, resultMapping, namespaceDiscriminatorMap)).build();
}
```
```java
public class Discriminator {//鉴别器
    private ResultMapping resultMapping;
    private Map<String, String> discriminatorMap;// case的value 和 对应的 resultMap Id
    ...
    public static class Builder {
        private Discriminator discriminator = new Discriminator();
        public Builder(Configuration configuration, ResultMapping resultMapping, Map<String, String> discriminatorMap) {
            this.discriminator.resultMapping = resultMapping;
            this.discriminator.discriminatorMap = discriminatorMap;
        }
        public Discriminator build() {
            assert this.discriminator.resultMapping != null;
            assert this.discriminator.discriminatorMap != null;
            assert !this.discriminator.discriminatorMap.isEmpty();
            this.discriminator.discriminatorMap = Collections.unmodifiableMap(this.discriminator.discriminatorMap);
            return this.discriminator;
        }
    }
}
``` 
### extend
```xml
<resultMap id="UserResultMap" type="xxx.UserModel">
     <id property="id" column="id"/>
     <result property="name" column="name"/>
     ...
</resultMap>

<resultMap extends="UserResultMap" id="UserWithRoleResultMap" type="xxx.UserModel">
    <collection column="role_id" property="roleList" select="selectRoleByUserId"/>
</resultMap>
```
### ResultMapping
```java
private ResultMapping buildResultMappingFromContext(XNode context, Class<?> resultType, List<ResultFlag> flags) throws Exception {
    String property;
    if (flags.contains(ResultFlag.CONSTRUCTOR)) {
        property = context.getStringAttribute("name");//构造器则取name
    } else {
        property = context.getStringAttribute("property");
    }
    String column = context.getStringAttribute("column");
    String javaType = context.getStringAttribute("javaType");
    String jdbcType = context.getStringAttribute("jdbcType");
    String nestedSelect = context.getStringAttribute("select");
    String nestedResultMap = context.getStringAttribute("resultMap", processNestedResultMappings(context, Collections.emptyList(), resultType));
    String notNullColumn = context.getStringAttribute("notNullColumn");//只有当某列不为空才创建子对象,只有association和collection有
    String columnPrefix = context.getStringAttribute("columnPrefix");
    String typeHandler = context.getStringAttribute("typeHandler");
    String resultSet = context.getStringAttribute("resultSet");//结合select上resultSets来做映射
    String foreignColumn = context.getStringAttribute("foreignColumn");
    boolean lazy = "lazy".equals(context.getStringAttribute("fetchType", this.configuration.isLazyLoadingEnabled() ? "lazy" : "eager"));
    Class<?> javaTypeClass = this.resolveClass(javaType);
    Class<? extends TypeHandler<?>> typeHandlerClass = this.resolveClass(typeHandler);
    JdbcType jdbcTypeEnum = this.resolveJdbcType(jdbcType);
    return this.builderAssistant.buildResultMapping(resultType, property, column, javaTypeClass, jdbcTypeEnum, nestedSelect, nestedResultMap, notNullColumn, columnPrefix, typeHandlerClass, flags, resultSet, foreignColumn, lazy);
}
```
```java
private String processNestedResultMappings(XNode context, List<ResultMapping> resultMappings, Class<?> enclosingType) throws Exception {
    if (("association".equals(context.getName()) || "collection".equals(context.getName()) || "case".equals(context.getName())) && context.getStringAttribute("select") == null) {
        validateCollection(context, enclosingType);
        ResultMap resultMap = resultMapElement(context, resultMappings, enclosingType);//回到最初方法解析resultMap,并携带enclosingType
        return resultMap.getId();//resultMap - association - resultMap 这种情况,最后取Id
    } else {
        return null;
    }
}
```
```java
public ResultMapping buildResultMapping(Class<?> resultType, String property, String column, Class<?> javaType, JdbcType jdbcType, String nestedSelect, String nestedResultMap, String notNullColumn, String columnPrefix, Class<? extends TypeHandler<?>> typeHandler, List<ResultFlag> flags, String resultSet, String foreignColumn, boolean lazy) {
    Class<?> javaTypeClass = resolveResultJavaType(resultType, property, javaType);
    TypeHandler<?> typeHandlerInstance = resolveTypeHandler(javaTypeClass, typeHandler);
    List<ResultMapping> composites = parseCompositeColumnName(column);//column多个的情况
    return (new ResultMapping.Builder(this.configuration, property, column, javaTypeClass))
            .jdbcType(jdbcType).nestedQueryId(applyCurrentNamespace(nestedSelect, true))
            .nestedResultMapId(applyCurrentNamespace(nestedResultMap, true))
            .resultSet(resultSet).typeHandler(typeHandlerInstance)
            .flags((flags == null ? new ArrayList() : flags))
            .composites(composites).notNullColumns(parseMultipleColumnNames(notNullColumn))
            .columnPrefix(columnPrefix).foreignColumn(foreignColumn).lazy(lazy).build();
}
```
### 解析sql节点
```xml
<sql id="select" lang="" databaseId="">
    SELECT
        ar.id, ar.author_id, ar.title, ar.type, ar.content,
    FROM
        article ar
</sql>
```
```java
private void sqlElement(List<XNode> list) {
    if (this.configuration.getDatabaseId() != null) {
        sqlElement(list, this.configuration.getDatabaseId());
    }
    sqlElement(list, null);
}

private void sqlElement(List<XNode> list, String requiredDatabaseId) {
    for(XNode context : list) {
        String databaseId = context.getStringAttribute("databaseId");
        String id = context.getStringAttribute("id");
        id = this.builderAssistant.applyCurrentNamespace(id, false);
        if (databaseIdMatchesCurrent(id, databaseId, requiredDatabaseId)) {
            this.sqlFragments.put(id, context);//存储进当前XMLMapperBuilder,后续直接取出用 private final Map<String, XNode> sqlFragments;
        }
    }
}
```

### 解析select|insert|update|delete节点
```java
private void buildStatementFromContext(List<XNode> list) {
    if (this.configuration.getDatabaseId() != null) {
        buildStatementFromContext(list, this.configuration.getDatabaseId());
    }
    buildStatementFromContext(list, null);
}

private void buildStatementFromContext(List<XNode> list, String requiredDatabaseId) {
    for(XNode context : list) {
        XMLStatementBuilder statementParser = new XMLStatementBuilder(this.configuration, this.builderAssistant, context, requiredDatabaseId);
        try {
            statementParser.parseStatementNode();
        } catch (IncompleteElementException e) {
            this.configuration.addIncompleteStatement(statementParser);
        }
    }
}
```