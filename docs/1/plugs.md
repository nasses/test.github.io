# 解析plugs节点
```java
private void parseConfiguration(XNode root) {
    try {
        this.propertiesElement(root.evalNode("properties"));
        Properties settings = this.settingsAsProperties(root.evalNode("settings"));
        this.loadCustomVfs(settings);
        this.loadCustomLogImpl(settings);
        this.typeAliasesElement(root.evalNode("typeAliases"));
        this.pluginElement(root.evalNode("plugins"));// [!code focus]
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
<plugins> 
    <plugin interceptor="xxx.ExamplePlugin"> 
        <property name="key" value="value"/> 
    </plugin> 
</plugins> 
```
### pluginElement
```java
private void pluginElement(XNode parent) throws Exception {
    if (parent != null) {
        Iterator iterator = parent.getChildren().iterator();
        while(iterator.hasNext()) {
            XNode child = (XNode)iterator.next();
            String interceptor = child.getStringAttribute("interceptor");
            Properties properties = child.getChildrenAsProperties();
            Interceptor interceptorInstance = (Interceptor)resolveClass(interceptor).newInstance();//存到typeAliases里// [!code hl]
            interceptorInstance.setProperties(properties);
            this.configuration.addInterceptor(interceptorInstance);//加入InterceptorChain// [!code hl]
        }
    }
}
```
### Interceptor
```java
public interface Interceptor {
    Object intercept(Invocation interceptor) throws Throwable;

    default Object plugin(Object target){
		Plugin.wrap(target, this);
	}

    default void setProperties(Properties interceptor){
	}
}
```

插件是 MyBatis 提供的一个拓展机制，通过插件机制我们可在 SQL 执行过程中的某些点上做一些自定义操作。
    
实现一个插件首先需要让插件类实现Interceptor接口，然后在插件类上添加@Intercepts和@Signature注解，用于指定想要拦截的目标方法。
MyBatis允许拦截下面接口中的一些方法： 
- Executor: `update`，`query`，`flushStatements`，`commit`，`rollback`，`getTransaction`，`close`，`isClosed` 
- ParameterHandler: `getParameterObject`，`setParameters` 
- ResultSetHandler: `handleResultSets`，`handleOutputParameters` 
- StatementHandler: `prepare`，`parameterize`，`batch`，`update`，`query`

详细阅读第六章 插件机制