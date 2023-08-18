# XMLStatementBuilder
```java
public class XMLStatementBuilder extends BaseBuilder {
    private final MapperBuilderAssistant builderAssistant;
    private final XNode context;
    private final String requiredDatabaseId;

	public void parseStatementNode() {
        String id = this.context.getStringAttribute("id");
        String databaseId = this.context.getStringAttribute("databaseId");
        if (databaseIdMatchesCurrent(id, databaseId, this.requiredDatabaseId)) {
            String nodeName = this.context.getNode().getNodeName();
            SqlCommandType sqlCommandType = SqlCommandType.valueOf(nodeName.toUpperCase(Locale.ENGLISH));
            boolean isSelect = sqlCommandType == SqlCommandType.SELECT;
            boolean flushCache = this.context.getBooleanAttribute("flushCache", !isSelect);
            boolean useCache = this.context.getBooleanAttribute("useCache", isSelect);
            boolean resultOrdered = this.context.getBooleanAttribute("resultOrdered", false);
            XMLIncludeTransformer includeParser = new XMLIncludeTransformer(this.configuration, this.builderAssistant);//[!code hl]
            includeParser.applyIncludes(this.context.getNode());//解析include节点
            String parameterType = this.context.getStringAttribute("parameterType");
            Class<?> parameterTypeClass = resolveClass(parameterType);
            String lang = this.context.getStringAttribute("lang");
            LanguageDriver langDriver = getLanguageDriver(lang);//语言引擎 默认是XMLLanguageDriver
            processSelectKeyNodes(id, parameterTypeClass, langDriver);
            String keyStatementId = id + "!selectKey";
            keyStatementId = this.builderAssistant.applyCurrentNamespace(keyStatementId, true);
            KeyGenerator keyGenerator;
            if (this.configuration.hasKeyGenerator(keyStatementId)) {//如果<selectKey>已经添加过 主键生成器了
                keyGenerator = this.configuration.getKeyGenerator(keyStatementId);//取selectKey获得的,使用的是SelectKeyGenerator
            } else {//是否开启 是否是<insert> 使用Jdbc3KeyGenerator
                keyGenerator = this.context.getBooleanAttribute("useGeneratedKeys", this.configuration.isUseGeneratedKeys() && SqlCommandType.INSERT.equals(sqlCommandType)) ? Jdbc3KeyGenerator.INSTANCE : NoKeyGenerator.INSTANCE;
            }
            //解析sql
            SqlSource sqlSource = langDriver.createSqlSource(this.configuration, this.context, parameterTypeClass);
            StatementType statementType = StatementType.valueOf(this.context.getStringAttribute("statementType", StatementType.PREPARED.toString()));
            Integer fetchSize = this.context.getIntAttribute("fetchSize");
            Integer timeout = this.context.getIntAttribute("timeout");
            String parameterMap = this.context.getStringAttribute("parameterMap");
            String resultType = this.context.getStringAttribute("resultType");
            Class<?> resultTypeClass = this.resolveClass(resultType);
            String resultMap = this.context.getStringAttribute("resultMap");
            String resultSetType = this.context.getStringAttribute("resultSetType");
            ResultSetType resultSetTypeEnum = this.resolveResultSetType(resultSetType);
            String keyProperty = this.context.getStringAttribute("keyProperty");
            String keyColumn = this.context.getStringAttribute("keyColumn");
            String resultSets = this.context.getStringAttribute("resultSets");
            this.builderAssistant.addMappedStatement(id, sqlSource, statementType, sqlCommandType, fetchSize, timeout, parameterMap, parameterTypeClass, resultMap, resultTypeClass, resultSetTypeEnum, flushCache, useCache, resultOrdered, keyGenerator, keyProperty, keyColumn, databaseId, langDriver, resultSets);
        }
    }

	private void processSelectKeyNodes(String id, Class<?> parameterTypeClass, LanguageDriver langDriver) {
        List<XNode> selectKeyNodes = this.context.evalNodes("selectKey");
        if (this.configuration.getDatabaseId() != null) {
            this.parseSelectKeyNodes(id, selectKeyNodes, parameterTypeClass, langDriver, this.configuration.getDatabaseId());
        }
        this.parseSelectKeyNodes(id, selectKeyNodes, parameterTypeClass, langDriver, (String)null);
        this.removeSelectKeyNodes(selectKeyNodes);
    }
	
	private void parseSelectKeyNodes(String parentId, List<XNode> list, Class<?> parameterTypeClass, LanguageDriver langDriver, String skRequiredDatabaseId) {
        for(XNode nodeToHandle: list){
            String id = parentId + "!selectKey";
            String databaseId = nodeToHandle.getStringAttribute("databaseId");
            if (this.databaseIdMatchesCurrent(id, databaseId, skRequiredDatabaseId)) {
                this.parseSelectKeyNode(id, nodeToHandle, parameterTypeClass, langDriver, databaseId);
            }
        }
    }

	private void parseSelectKeyNode(String id, XNode nodeToHandle, Class<?> parameterTypeClass, LanguageDriver langDriver, String databaseId) {
        String resultType = nodeToHandle.getStringAttribute("resultType");
        Class<?> resultTypeClass = this.resolveClass(resultType);
        StatementType statementType = StatementType.valueOf(nodeToHandle.getStringAttribute("statementType", StatementType.PREPARED.toString()));
        String keyProperty = nodeToHandle.getStringAttribute("keyProperty");
        String keyColumn = nodeToHandle.getStringAttribute("keyColumn");
        boolean executeBefore = "BEFORE".equals(nodeToHandle.getStringAttribute("order", "AFTER"));
        boolean useCache = false;
        boolean resultOrdered = false;
        KeyGenerator keyGenerator = NoKeyGenerator.INSTANCE;
        Integer fetchSize = null;
        Integer timeout = null;
        boolean flushCache = false;
        String parameterMap = null;
        String resultMap = null;
        ResultSetType resultSetTypeEnum = null;
        SqlSource sqlSource = langDriver.createSqlSource(this.configuration, nodeToHandle, parameterTypeClass);
        SqlCommandType sqlCommandType = SqlCommandType.SELECT;
        this.builderAssistant.addMappedStatement(id, sqlSource, statementType, sqlCommandType, (Integer)fetchSize, (Integer)timeout, (String)parameterMap, parameterTypeClass, (String)resultMap, resultTypeClass, (ResultSetType)resultSetTypeEnum, flushCache, useCache, resultOrdered, keyGenerator, keyProperty, keyColumn, databaseId, langDriver, (String)null);
        id = this.builderAssistant.applyCurrentNamespace(id, false);
        MappedStatement keyStatement = this.configuration.getMappedStatement(id, false);
        this.configuration.addKeyGenerator(id, new SelectKeyGenerator(keyStatement, executeBefore));
    }
}
```

### 解析include节点

```java
public void applyIncludes(Node source) {
    Properties variablesContext = new Properties();//创建一个新的,防止污染
    Properties configurationVariables = this.configuration.getVariables();
    if(configurationVariables != null) {
        variablesContext.putAll(configurationVariables);
    }
    applyIncludes(source, variablesContext, false);
}
```

```java
private void applyIncludes(Node source, Properties variablesContext, boolean included) {
    if (source.getNodeName().equals("include")) {
        Node toInclude = findSqlFragment(getStringAttribute(source, "refid"), variablesContext);//获取sql节点(可能不存在)
        Properties toIncludeContext = getVariablesContext(source, variablesContext);//解析<include>的子节点<proerty>合并
        applyIncludes(toInclude, toIncludeContext, true);//对找到的<sql>递归查询include,此时标记已经是include了
        if (toInclude.getOwnerDocument() != source.getOwnerDocument()) {
            toInclude = source.getOwnerDocument().importNode(toInclude, true);//<sql>和<include>不在一个xml,则从其他xml导入<sql>
        }
        source.getParentNode().replaceChild(toInclude, source);//  此 方 法 核 心, 替 换 <include> 为 <sql>
        while(toInclude.hasChildNodes()) {//此时toInclude已经是<sql>
            toInclude.getParentNode().insertBefore(toInclude.getFirstChild(), toInclude);//将sql中的内容插入到sql之前
        }
        toInclude.getParentNode().removeChild(toInclude);//然后移除sql,只需要sql中的内容
    } else if (source.getNodeType() == Node.ELEMENT_NODE) {
        if (included && !variablesContext.isEmpty()) {//是include 是对sql进行递归
            NamedNodeMap attributes = source.getAttributes();
            for(int i = 0; i < attributes.getLength(); ++i) {
                Node attr = attributes.item(i);
                attr.setNodeValue(PropertyParser.parse(attr.getNodeValue(), variablesContext));//将sql属性中的${}替换
            }
        }
        NodeList children = source.getChildNodes();
        for(int i = 0; i < children.getLength(); ++i) {
            applyIncludes(children.item(i), variablesContext, included);//子节点递归扫描
        }
    } else if (included && source.getNodeType() == Node.TEXT_NODE && !variablesContext.isEmpty()) {//文本节点
        source.setNodeValue(PropertyParser.parse(source.getNodeValue(), variablesContext));//将内容中的${}替换
    }
}
```

```java
private Node findSqlFragment(String refid, Properties variables) {
    refid = PropertyParser.parse(refid, variables);//将refid中的占位符替换成对应属性值
    refid = this.builderAssistant.applyCurrentNamespace(refid, true);
    try {
        XNode nodeToInclude = this.configuration.getSqlFragments().get(refid);//从存储的<sql>里试图获取节点
        return nodeToInclude.getNode().cloneNode(true);//返回一个克隆类
    } catch (IllegalArgumentException e) {
        throw new IncompleteElementException("Could not find SQL statement to include with refid '" + refid + "'", e);
    }
}
```

```java
private Properties getVariablesContext(Node node, Properties inheritedVariablesContext) {//合并Include子节点到Properties
    Map<String, String> declaredProperties = null;
	NodeList children = node.getChildNodes();//<include>的子节点
	for(int i = 0; i < children.getLength(); ++i) {
        Node n = children.item(i);
        if (n.getNodeType() == Node.ELEMENT_NODE) {
            String name = getStringAttribute(n, "name");
            String value = PropertyParser.parse(this.getStringAttribute(n, "value"), inheritedVariablesContext);//替换vlaue中的${}
            if (declaredProperties == null) {
                declaredProperties = new HashMap();
            }
            if (declaredProperties.put(name, value) != null) {
                throw new BuilderException("...");
            }
        }
    }
	if(declaredProperties == null) {
		return inheritedVariablesContext;
    } else {
		Properties newProperties = new Properties();
        newProperties.putAll(inheritedVariablesContext);
        newProperties.putAll(declaredProperties);
        return newProperties;//合并
    }
}
```


### selectKey

对于一些不支持自增主键的数据库,比如Oracle,可以通过自增序列获取主键数据,但这样需要两次查询数据库,但`<select>`中不能存在两个select
可以通过`<selectKey>`来解决, selectKey只能在 update或者insert上

```xml
<insert id="saveAuthor">
   <selectKey keyProperty="id" resultType="int" order="BEFORE"> 
        select author_seq.nextval from dual
   </selectKey>
    insert into Author (id, name, password)
    values (#{id}, #{username}, #{password})    
</insert>
```

```java
private void processSelectKeyNodes(String id, Class<?> parameterTypeClass, LanguageDriver langDriver) {
    List<XNode> selectKeyNodes = this.context.evalNodes("selectKey");
    if (this.configuration.getDatabaseId() != null) {
        parseSelectKeyNodes(id, selectKeyNodes, parameterTypeClass, langDriver, this.configuration.getDatabaseId());
    }
    parseSelectKeyNodes(id, selectKeyNodes, parameterTypeClass, langDriver, null);
    removeSelectKeyNodes(selectKeyNodes);//解析完成后移除dom
}
```

```java
private void parseSelectKeyNodes(String parentId, List<XNode> list, Class<?> parameterTypeClass, LanguageDriver langDriver, String skRequiredDatabaseId) {
    for(XNode nodeToHandle : list) {//可能含有多个selectKey
        String id = parentId + "!selectKey";
        String databaseId = nodeToHandle.getStringAttribute("databaseId");
        if (databaseIdMatchesCurrent(id, databaseId, skRequiredDatabaseId)) {
            parseSelectKeyNode(id, nodeToHandle, parameterTypeClass, langDriver, databaseId);//匹配上开始解析,并将结果存到Configuration的mappedStatements中
        }
    }
}
```

```java
private boolean databaseIdMatchesCurrent(String id, String databaseId, String requiredDatabaseId) {
    if (requiredDatabaseId != null) {
        if (!requiredDatabaseId.equals(databaseId)) {//子标签与mapper不匹配
            return false;
        }
    } else {//不需要
        if (databaseId != null) {//子标签上却有
            return false;
        }
        id = this.builderAssistant.applyCurrentNamespace(id, false);
        if (this.configuration.hasStatement(id, false)) {
            MappedStatement previous = this.configuration.getMappedStatement(id, false);
            if (previous.getDatabaseId() != null) {//有过相同Id的
                return false;
            }
        }
    }
    return true;
}
```

```java
private void parseSelectKeyNode(String id, XNode nodeToHandle, Class<?> parameterTypeClass, LanguageDriver langDriver, String databaseId) {
    String resultType = nodeToHandle.getStringAttribute("resultType");
    Class<?> resultTypeClass = resolveClass(resultType);
    StatementType statementType = StatementType.valueOf(nodeToHandle.getStringAttribute("statementType", StatementType.PREPARED.toString()));//使用JDBC的哪个Statement,默认为PREPARED
    String keyProperty = nodeToHandle.getStringAttribute("keyProperty");
    String keyColumn = nodeToHandle.getStringAttribute("keyColumn");
    boolean executeBefore = "BEFORE".equals(nodeToHandle.getStringAttribute("order", "AFTER"));//before会首先执行selectKey然后insert
    SqlSource sqlSource = langDriver.createSqlSource(this.configuration, nodeToHandle, parameterTypeClass);
    //<selectKey>属于是select语句
    this.builderAssistant.addMappedStatement(id, sqlSource, statementType, SqlCommandType.SELECT, null, null, null,
            parameterTypeClass, null, resultTypeClass, null, false, false, false,
            NoKeyGenerator.INSTANCE, keyProperty, keyColumn, databaseId, langDriver, null);
    id = this.builderAssistant.applyCurrentNamespace(id, false);
    //设置主键生成器
    MappedStatement keyStatement = this.configuration.getMappedStatement(id, false);
    this.configuration.addKeyGenerator(id, new SelectKeyGenerator(keyStatement, executeBefore));
}
```

```java
public SqlSource createSqlSource(Configuration configuration, XNode script, Class<?> parameterType) {
    XMLScriptBuilder builder = new XMLScriptBuilder(configuration, script, parameterType);
    return builder.parseScriptNode();
}
```

### KeyGenerator

KeyGenerator 接口表示主键生成器,它有三个实现类:Jdbc3KeyGenerator, SelectKeyGenerator, NoKeyGenerator 
Jdbc3KeyGenerator用于获取插入数据后的自增主键数值。某些数据库不支持自增主键，需要手动填写主键字段，此时需要借助SelectKeyGenerator获取主键值。
至于NoKeyGenerator，是一个空实现

```java
public interface KeyGenerator {
    void processBefore(Executor executor, MappedStatement mappedStatement, Statement statement, Object object);

    void processAfter(Executor executor, MappedStatement mappedStatement, Statement statement, Object object);
}
```
