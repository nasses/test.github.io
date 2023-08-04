# 解析objectFactory节点
```java
private void parseConfiguration(XNode root) {
    try {
        this.propertiesElement(root.evalNode("properties"));
        Properties settings = this.settingsAsProperties(root.evalNode("settings"));
        this.loadCustomVfs(settings);
        this.loadCustomLogImpl(settings);
        this.typeAliasesElement(root.evalNode("typeAliases"));
        this.pluginElement(root.evalNode("plugins"));
        this.objectFactoryElement(root.evalNode("objectFactory"));// [!code focus]
        this.objectWrapperFactoryElement(root.evalNode("objectWrapperFactory"));// [!code focus]
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
<objectFactory type="org.mybatis.example.MyObjectFactory">
    <property name="email" value="undefined"/>
</objectFactory>
```
### objectFactoryElement
```java
private void objectFactoryElement(XNode context) throws Exception {
    if (context != null) {
        String type = context.getStringAttribute("type");
        Properties properties = context.getChildrenAsProperties();
        ObjectFactory factory = (ObjectFactory)this.resolveClass(type).newInstance();
        factory.setProperties(properties);
        this.configuration.setObjectFactory(factory);
    }

}
```

### ObjectFactory
```java
public interface ObjectFactory {
    void setProperties(Properties properties);

    <T> T create(Class<T> type);

    <T> T create(Class<T> type, List<Class<?>> constructorArgsTypes, List<Object> constructorArgs);

    <T> boolean isCollection(Class<T> type);
}
```
### DefaultObjectFactory
```java
public class DefaultObjectFactory implements ObjectFactory, Serializable {

	public <T> T create(Class<T> type) {
        return this.create(type, (List)null, (List)null);
    }

    public <T> T create(Class<T> type, List<Class<?>> constructorArgTypes, List<Object> constructorArgs) {//[!code focus]
        Class<?> classToCreate = this.resolveInterface(type);
        return this.instantiateClass(classToCreate, constructorArgTypes, constructorArgs);//[!code focus]
    }

	private <T> T instantiateClass(Class<T> type, List<Class<?>> constructorArgTypes, List<Object> constructorArgs) {//[!code focus]
        try {
            Constructor constructor;
            if (constructorArgTypes != null && constructorArgs != null) {
                constructor = type.getDeclaredConstructor((Class[])constructorArgTypes.toArray(new Class[constructorArgTypes.size()]));

                try {
                    return constructor.newInstance(constructorArgs.toArray(new Object[constructorArgs.size()]));//[!code focus]
                } catch (IllegalAccessException e) {
                    if (Reflector.canControlMemberAccessible()) {
                        constructor.setAccessible(true);
                        return constructor.newInstance(constructorArgs.toArray(new Object[constructorArgs.size()]));
                    } else {
                        throw e;
                    }
                }
            } else {
                constructor = type.getDeclaredConstructor();
                try {
                    return constructor.newInstance();//[!code focus]
                } catch (IllegalAccessException e) {
                    if (Reflector.canControlMemberAccessible()) {
                        constructor.setAccessible(true);
                        return constructor.newInstance();
                    } else {
                        throw e;
                    }
                }
            }
        } catch (Exception e) {
            throw new ReflectionException("");
        }
    }

}

```

### objectWrapperFactoryElement
```java
private void objectWrapperFactoryElement(XNode context) throws Exception {
    if (context != null) {
        String type = context.getStringAttribute("type");
        ObjectWrapperFactory factory = (ObjectWrapperFactory)this.resolveClass(type).newInstance();
        this.configuration.setObjectWrapperFactory(factory);
    }
}
```

### ObjectWrapperFactory
```java
public interface ObjectWrapperFactory {//创建对象的工厂
    boolean hasWrapperFor(Object object);

    ObjectWrapper getWrapperFor(MetaObject metaObject, Object object);
}
```

### DefaultObjectWrapperFactory
```java
public class DefaultObjectWrapperFactory implements ObjectWrapperFactory {
    public DefaultObjectWrapperFactory() {
    }

    public boolean hasWrapperFor(Object object) {
        return false;
    }

    public ObjectWrapper getWrapperFor(MetaObject metaObject, Object object) {
        throw new ReflectionException("The DefaultObjectWrapperFactory should never be called to provide an ObjectWrapper.");
    }
}
```