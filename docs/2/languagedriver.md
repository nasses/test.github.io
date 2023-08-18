# LanguageDriver
Configuration 中注册了默认的实现`this.languageRegistry.setDefaultDriverClass(XMLLanguageDriver.class);`
```java
public class XMLLanguageDriver implements LanguageDriver {
    public XMLLanguageDriver() {
    }

    public ParameterHandler createParameterHandler(MappedStatement mappedStatement, Object parameterObject, BoundSql boundSql) {
        return new DefaultParameterHandler(mappedStatement, parameterObject, boundSql);
    }

    public SqlSource createSqlSource(Configuration configuration, XNode script, Class<?> parameterType) {
        XMLScriptBuilder builder = new XMLScriptBuilder(configuration, script, parameterType);
        return builder.parseScriptNode();
    }

    public SqlSource createSqlSource(Configuration configuration, String script, Class<?> parameterType) {
        if (script.startsWith("<script>")) {
            XPathParser parser = new XPathParser(script, false, configuration.getVariables(), new XMLMapperEntityResolver());
            return this.createSqlSource(configuration, parser.evalNode("/script"), parameterType);
        } else {
            script = PropertyParser.parse(script, configuration.getVariables());
            TextSqlNode textSqlNode = new TextSqlNode(script);
            return (textSqlNode.isDynamic() ? new DynamicSqlSource(configuration, textSqlNode) : new RawSqlSource(configuration, script, parameterType));
        }
    }
}
```

### XMLScriptBuilder
```java
public class XMLScriptBuilder extends BaseBuilder {
    private final XNode context;
    private boolean isDynamic;//是不是动态 包括标签 和 ${} 
    private final Class<?> parameterType;
    private final Map<String, NodeHandler> nodeHandlerMap;

    public XMLScriptBuilder(Configuration configuration, XNode context) {
        this(configuration, context, null);
    }

    public XMLScriptBuilder(Configuration configuration, XNode context, Class<?> parameterType) {
        super(configuration);
        this.nodeHandlerMap = new HashMap();
        this.context = context;
        this.parameterType = parameterType;
        initNodeHandlerMap();
    }

    private void initNodeHandlerMap() {
        this.nodeHandlerMap.put("trim", new XMLScriptBuilder.TrimHandler());
        this.nodeHandlerMap.put("where", new XMLScriptBuilder.WhereHandler());
        this.nodeHandlerMap.put("set", new XMLScriptBuilder.SetHandler());
        this.nodeHandlerMap.put("foreach", new XMLScriptBuilder.ForEachHandler());
        this.nodeHandlerMap.put("if", new XMLScriptBuilder.IfHandler());
        this.nodeHandlerMap.put("choose", new XMLScriptBuilder.ChooseHandler());
        this.nodeHandlerMap.put("when", new XMLScriptBuilder.IfHandler());
        this.nodeHandlerMap.put("otherwise", new XMLScriptBuilder.OtherwiseHandler());
        this.nodeHandlerMap.put("bind", new XMLScriptBuilder.BindHandler());
    }

    public SqlSource parseScriptNode() {
        MixedSqlNode rootSqlNode = parseDynamicTags(this.context);
        SqlSource sqlSource;
        if (this.isDynamic) {
            sqlSource = new DynamicSqlSource(this.configuration, rootSqlNode);
        } else {
            sqlSource = new RawSqlSource(this.configuration, rootSqlNode, this.parameterType);
        }
        return sqlSource;
    }

    protected MixedSqlNode parseDynamicTags(XNode node) {//解析所有 含nodeHandlerMap里标签的sql
        List<SqlNode> contents = new ArrayList();
        NodeList children = node.getNode().getChildNodes();//不是继承Iterator
        for(int i = 0; i < children.getLength(); ++i) {
            XNode child = node.newXNode(children.item(i));
            String nodeName;
            if (child.getNode().getNodeType() != Node.CDATA_SECTION_NODE && child.getNode().getNodeType() != Node.TEXT_NODE) {
                if (child.getNode().getNodeType() == Node.ELEMENT_NODE) {
                    nodeName = child.getNode().getNodeName();
                    XMLScriptBuilder.NodeHandler handler = this.nodeHandlerMap.get(nodeName);//找到对应的处理器
                    if (handler == null) {
                        throw new BuilderException("Unknown element <" + nodeName + "> in SQL statement.");
                    }
                    handler.handleNode(child, contents);//通过统一接口执行
                    this.isDynamic = true;
                }
            } else {//没使用标签
                nodeName = child.getStringBody("");//如果body不存在,则返回""
                TextSqlNode textSqlNode = new TextSqlNode(nodeName);
                if (textSqlNode.isDynamic()) {// GenericTokenParser parse 解析式使用handler记录 isDynamic 有${}
                    contents.add(textSqlNode);//去除了${}
                    this.isDynamic = true;
                } else {
                    contents.add(new StaticTextSqlNode(nodeName));
                }
            }
        }
        return new MixedSqlNode(contents);
    }
    
    private interface NodeHandler {
        void handleNode(XNode node, List<SqlNode> sqlNodeList);
    }
}
```