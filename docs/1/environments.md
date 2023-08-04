# 解析environments节点

```java
private void parseConfiguration(XNode root) {
    try {
        this.propertiesElement(root.evalNode("properties"));
        Properties settings = this.settingsAsProperties(root.evalNode("settings"));
        this.loadCustomVfs(settings);
        this.loadCustomLogImpl(settings);
        this.typeAliasesElement(root.evalNode("typeAliases"));
        this.pluginElement(root.evalNode("plugins"));
        this.objectFactoryElement(root.evalNode("objectFactory"));
        this.objectWrapperFactoryElement(root.evalNode("objectWrapperFactory"));
        this.reflectorFactoryElement(root.evalNode("reflectorFactory"));
        this.settingsElement(settings);//[!code focus]
        this.environmentsElement(root.evalNode("environments"));
        this.databaseIdProviderElement(root.evalNode("databaseIdProvider"));
        this.typeHandlerElement(root.evalNode("typeHandlers"));
        this.mapperElement(root.evalNode("mappers"));
    } catch (Exception e) {
        throw new BuilderException("...");
    }
}
```
```xml
<environments default="development">
    <environment id="development">
        <transactionManager type="JDBC"/>
        <dataSource type="POOLED">
            <property name="driver" value="${jdbc.driver}"/>
            <property name="url" value="${jdbc.url}"/>
            <property name="username" value="${jdbc.username}"/>
            <property name="password" value="${jdbc.password}"/>
        </dataSource>
    </environment>
</environments>
```

### environmentsElement
```java
private void environmentsElement(XNode context) throws Exception {
    if (context != null) {
        if (this.environment == null) {
            this.environment = context.getStringAttribute("default");
        }
        List<XNode> children = context.getChildren();
        for(XNode child : children){
            String id = child.getStringAttribute("id");
            if (this.isSpecifiedEnvironment(id)) {
                TransactionFactory txFactory = this.transactionManagerElement(child.evalNode("transactionManager"));
                DataSourceFactory dsFactory = this.dataSourceElement(child.evalNode("dataSource"));
                DataSource dataSource = dsFactory.getDataSource();
                Environment.Builder environmentBuilder = (new Environment.Builder(id)).transactionFactory(txFactory).dataSource(dataSource);
                this.configuration.setEnvironment(environmentBuilder.build());
            }
        }
    }
}

private TransactionFactory transactionManagerElement(XNode context) throws Exception {
    if (context != null) {
        String type = context.getStringAttribute("type");
        Properties props = context.getChildrenAsProperties();
        TransactionFactory factory = (TransactionFactory)this.resolveClass(type).newInstance();
        factory.setProperties(props);
        return factory;
    } else {
        throw new BuilderException("Environment declaration requires a TransactionFactory.");
    }
}

private DataSourceFactory dataSourceElement(XNode context) throws Exception {
    if (context != null) {
        String type = context.getStringAttribute("type");
        Properties props = context.getChildrenAsProperties();
        DataSourceFactory factory = (DataSourceFactory)this.resolveClass(type).newInstance();
        factory.setProperties(props);
        return factory;
    } else {
        throw new BuilderException("Environment declaration requires a DataSourceFactory.");
    }
}

```

### Environment
```java
public final class Environment {
    private final String id;
    private final TransactionFactory transactionFactory;
    private final DataSource dataSource;
    
    public static class Builder {
        private String id;
        private TransactionFactory transactionFactory;
        private DataSource dataSource;
        ....
        public Environment build() {
            return new Environment(this.id, this.transactionFactory, this.dataSource);
        }
    }
}
```

