# 解析properties节点

> ### SqlSessionFactoryBuilder-build
```java
public SqlSessionFactory build(InputStream inputStream, String environment, Properties properties) {// [!code focus]
    SqlSessionFactory SqlSessionFactory;
    try {
        XMLConfigBuilder parser = new XMLConfigBuilder(inputStream, environment, properties);// [!code focus]
        SqlSessionFactory = this.build(parser.parse());// [!code focus]
    } catch (Exception var14) {
        throw ExceptionFactory.wrapException("Error building SqlSession.", var14);
    } finally {
        ErrorContext.instance().reset();
        try {
            inputStream.close();
        } catch (IOException e) {
        }
    }
    return SqlSessionFactory;
}
```
> ### XMLConfigBuilder-parseConfiguration
```java
public Configuration parse() {// [!code focus]
    if (this.parsed) {
        throw new BuilderException("Each XMLConfigBuilder can only be used once.");
    } else {
        this.parsed = true;
        this.parseConfiguration(this.parser.evalNode("/configuration"));// [!code focus]
        return this.configuration;
    }
}
private void parseConfiguration(XNode root) {
    try {
        this.propertiesElement(root.evalNode("properties"));// [!code focus]
        Properties settings = this.settingsAsProperties(root.evalNode("settings"));
        this.loadCustomVfs(settings);
        this.loadCustomLogImpl(settings);
        this.typeAliasesElement(root.evalNode("typeAliases"));
        this.pluginElement(root.evalNode("plugins"));
        this.objectFactoryElement(root.evalNode("objectFactory"));
        this.objectWrapperFactoryElement(root.evalNode("objectWrapperFactory"));
        this.reflectorFactoryElement(root.evalNode("reflectorFactory"));
        this.settingsElement(settings);
        this.environmentsElement(root.evalNode("environments"));
        this.databaseIdProviderElement(root.evalNode("databaseIdProvider"));
        this.typeHandlerElement(root.evalNode("typeHandlers"));
        this.mapperElement(root.evalNode("mappers"));
    } catch (Exception var3) {
        throw new BuilderException("Error parsing SQL Mapper Configuration. Cause: " + var3, var3);
    }
}
```

### propertiesElement
```xml
<properties resource="jdbc.properties"> 
    <property name="jdbc.username" value="xxx"/> 
    <property name="xx" value="xx"/> 
</properties> 
```
```java
private void propertiesElement(XNode propertieNode) throws Exception {
    if (propertieNode != null) {
        // 解析 propertis 的子节点，并将这些节点内容转换为属性对象 Properties
        Properties properties = propertieNode.getChildrenAsProperties();
        // 获取 propertis 节点中的 resource 和 url 属性值
        String resource = propertieNode.getStringAttribute("resource");
        String url = propertieNode.getStringAttribute("url");
        if (resource != null && url != null) {
            throw new BuilderException("...");
        }
        if (resource != null) {
            // 从文件系统中加载并解析属性文件
            properties.putAll(Resources.getResourceAsProperties(resource));
        } else if (url != null) {
            properties.putAll(Resources.getUrlAsProperties(url));
        }
        Properties configurationProperties = this.configuration.getVariables();
        if (configurationProperties != null) {
            properties.putAll(configurationProperties);//配置的会覆盖
        }
        this.parser.setVariables(properties);//XPathParser
        // 将属性值设置到 configuration 中
        this.configuration.setVariables(properties);
    }
}
```
### getChildrenAsProperties
```java
public Properties getChildrenAsProperties() {//Xnodes -> Properties
    Properties properties = new Properties();
    Iterator iterator = getChildren().iterator();
    while(iterator.hasNext()) {
        XNode child = (XNode)iterator.next();
        String name = child.getStringAttribute("name");
        String value = child.getStringAttribute("value");
        if (name != null && value != null) {
            properties.setProperty(name, value);
        }
    }
    return properties;
}
public List<XNode> getChildren() {//NodeList -> List<XNode>
    List<XNode> children = new ArrayList();
    NodeList nodeList = node.getChildNodes();
    if (nodeList != null) {
        for(int i = 0; i < nodeList.getLength(); ++i) {
            Node node = nodeList.item(i);
            if (node.getNodeType() == 1) {
                children.add(new XNode(xpathParser, node, properties));
            }
        }
    }
    return children;
}
```