### 解析typeAliases节点
```java
private void parseConfiguration(XNode root) {
    try {
        this.propertiesElement(root.evalNode("properties"));
        Properties settings = this.settingsAsProperties(root.evalNode("settings"));
        this.loadCustomVfs(settings);
        this.loadCustomLogImpl(settings);
        this.typeAliasesElement(root.evalNode("typeAliases"));// [!code focus]
        this.pluginElement(root.evalNode("plugins"));
        this.objectFactoryElement(root.evalNode("objectFactory"));
        this.objectWrapperFactoryElement(root.evalNode("objectWrapperFactory"));
        this.reflectorFactoryElement(root.evalNode("reflectorFactory"));
        this.settingsElement(settings);
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
<typeAliases>
    <typeAlias alias="Article" type="com.nasses.mybatis.chapter01.mybatis.model.Article"/>
    <typeAlias alias="Author" type="com.nasses.mybatis.chapter01.mybatis.model.Author"/>
    <package name="xx"/> <!--package只能放后面 dtd定义-->
</typeAliases>
```

```java
private void typeAliasesElement(XNode parent) {
    if (parent != null) {
        Iterator iterator = parent.getChildren().iterator();
        while(iterator.hasNext()) {
            XNode child = (XNode)iterator.next();
            if ("package".equals(child.getName())) {
                String packageName = child.getStringAttribute("name");
                this.configuration.getTypeAliasRegistry().registerAliases(packageName);
            } else {
                String alias = child.getStringAttribute("alias");
                String type = child.getStringAttribute("type");
                try {
                    Class<?> clazz = Resources.classForName(type);
                    if (alias == null) {
                        this.typeAliasRegistry.registerAlias(clazz);
                    } else {
                        this.typeAliasRegistry.registerAlias(alias, clazz);
                    }
                } catch (ClassNotFoundException e) {
                    throw new BuilderException("Error registering typeAlias for '" + alias + "'. Cause: " + e, e);
                }
            }
        }
    }
}
```