### 解析settings

> ### XMLConfigBuilder
```java
private void parseConfiguration(XNode root) {
    try {
        this.propertiesElement(root.evalNode("properties"));
        Properties settings = this.settingsAsProperties(root.evalNode("settings"));// [!code focus]
        this.loadCustomVfs(settings);// [!code focus]
        this.loadCustomLogImpl(settings);// [!code focus]
        this.typeAliasesElement(root.evalNode("typeAliases"));
        this.pluginElement(root.evalNode("plugins"));
        this.objectFactoryElement(root.evalNode("objectFactory"));
        this.objectWrapperFactoryElement(root.evalNode("objectWrapperFactory"));
        this.reflectorFactoryElement(root.evalNode("reflectorFactory"));
        this.settingsElement(settings);// [!code focus]
        this.environmentsElement(root.evalNode("environments"));
        this.databaseIdProviderElement(root.evalNode("databaseIdProvider"));
        this.typeHandlerElement(root.evalNode("typeHandlers"));
        this.mapperElement(root.evalNode("mappers"));
    } catch (Exception e) {
        throw new BuilderException("...");
    }
}
```
### settingsAsProperties
```xml
<settings> 
    <setting name="cacheEnabled" value="true"/> 
    <setting name="lazyLoadingEnabled" value="true"/> 
    <setting name="autoMappingBehavior" value="PARTIAL"/> 
</settings> 
```
```java
private Properties settingsAsProperties(XNode settingNode) {
    if (settingNode == null) {
        return new Properties();
    }
    Properties props = settingNode.getChildrenAsProperties();
    // Configuration 类的“元信息”
    MetaClass metaConfig = MetaClass.forClass(Configuration.class, this.localReflectorFactory);
    for (Object key : props.keySet()) {
        // 检测 Configuration 中是否存在相关属性，不存在则抛出异常
        if (!metaConfig.hasSetter(String.valueOf(key))) {
            throw new BuilderException("...");
        }
    }
    return props;
}
```
👉[getChildrenAsProperties](./properties.html#getchildrenasproperties)方法多次使用

### loadCustomVfs

```java
//支持配置外部虚拟文件系统实现 用来加载jar包
private void loadCustomVfs(Properties props) throws ClassNotFoundException {
    String value = props.getProperty("vfsImpl");
    if (value != null) {
        String[] clazzes = value.split(",");
        int length = clazzes.length;
        for(int i = 0; i < length; ++i) {
            String clazz = clazzes[i];
            if (!clazz.isEmpty()) {
                Class<? extends VFS> vfsImpl = Resources.classForName(clazz);
                this.configuration.setVfsImpl(vfsImpl);
            }
        }
    }
}
```

### loadCustomLogImpl

```java
private void loadCustomLogImpl(Properties props) {
	//通过TypeAliasRegistry获取
    Class<? extends Log> logImpl = this.resolveClass(props.getProperty("logImpl"));//[!code hl]
    this.configuration.setLogImpl(logImpl);
}

//支持配置外部日志实现
public void setLogImpl(Class<? extends Log> logImpl) {
    if (logImpl != null) {
        this.logImpl = logImpl;
        LogFactory.useCustomLogging(this.logImpl);
    }

}
```

###settingsElement
```java
private void settingsElement(Properties props) {
    this.configuration.setAutoMappingBehavior(AutoMappingBehavior.valueOf(props.getProperty("autoMappingBehavior", "PARTIAL")));
    this.configuration.setAutoMappingUnknownColumnBehavior(AutoMappingUnknownColumnBehavior.valueOf(props.getProperty("autoMappingUnknownColumnBehavior", "NONE")));
    this.configuration.setCacheEnabled(this.booleanValueOf(props.getProperty("cacheEnabled"), true));
    this.configuration.setProxyFactory((ProxyFactory)this.createInstance(props.getProperty("proxyFactory")));//newInstance反射创建对象 默认JavassistProxyFactory//[!code hl]
    this.configuration.setLazyLoadingEnabled(this.booleanValueOf(props.getProperty("lazyLoadingEnabled"), false));
    this.configuration.setAggressiveLazyLoading(this.booleanValueOf(props.getProperty("aggressiveLazyLoading"), false));
    this.configuration.setMultipleResultSetsEnabled(this.booleanValueOf(props.getProperty("multipleResultSetsEnabled"), true));
    this.configuration.setUseColumnLabel(this.booleanValueOf(props.getProperty("useColumnLabel"), true));
    this.configuration.setUseGeneratedKeys(this.booleanValueOf(props.getProperty("useGeneratedKeys"), false));
    this.configuration.setDefaultExecutorType(ExecutorType.valueOf(props.getProperty("defaultExecutorType", "SIMPLE")));//默认simple //[!code hl]
    this.configuration.setDefaultStatementTimeout(this.integerValueOf(props.getProperty("defaultStatementTimeout"), (Integer)null));
    this.configuration.setDefaultFetchSize(this.integerValueOf(props.getProperty("defaultFetchSize"), (Integer)null));
    this.configuration.setMapUnderscoreToCamelCase(this.booleanValueOf(props.getProperty("mapUnderscoreToCamelCase"), false));
    this.configuration.setSafeRowBoundsEnabled(this.booleanValueOf(props.getProperty("safeRowBoundsEnabled"), false));
    this.configuration.setLocalCacheScope(LocalCacheScope.valueOf(props.getProperty("localCacheScope", "SESSION")));//缓存模式 //[!code hl]
    this.configuration.setJdbcTypeForNull(JdbcType.valueOf(props.getProperty("jdbcTypeForNull", "OTHER")));//null处理 //[!code hl]
    this.configuration.setLazyLoadTriggerMethods(this.stringSetValueOf(props.getProperty("lazyLoadTriggerMethods"), "equals,clone,hashCode,toString"));//懒加载方法 //[!code hl]
    this.configuration.setSafeResultHandlerEnabled(this.booleanValueOf(props.getProperty("safeResultHandlerEnabled"), true));
    this.configuration.setDefaultScriptingLanguage(this.resolveClass(props.getProperty("defaultScriptingLanguage")));//XMLLanguageDriver
    this.configuration.setDefaultEnumTypeHandler(this.resolveClass(props.getProperty("defaultEnumTypeHandler")));//javaType jdbcType Handler
    this.configuration.setCallSettersOnNulls(this.booleanValueOf(props.getProperty("callSettersOnNulls"), false));//map接收时无key
    this.configuration.setUseActualParamName(this.booleanValueOf(props.getProperty("useActualParamName"), true));
    this.configuration.setReturnInstanceForEmptyRow(this.booleanValueOf(props.getProperty("returnInstanceForEmptyRow"), false));
    this.configuration.setLogPrefix(props.getProperty("logPrefix"));
    this.configuration.setConfigurationFactory(this.resolveClass(props.getProperty("configurationFactory")));
}
```



### TypeAliasRegistry

```java
public class TypeAliasRegistry {//通过别名获取类  // [!code focus]
    private final Map<String, Class<?>> typeAliases = new HashMap();// [!code focus]

	public <T> Class<T> resolveAlias(String string) {
        try {
            if (string == null) {
                return null;
            } else {
                String key = string.toLowerCase(Locale.ENGLISH);
                Class value;
                if (this.typeAliases.containsKey(key)) {
                    value = (Class)this.typeAliases.get(key);// [!code focus]
                } else {
                    value = Resources.classForName(string);// [!code focus]
                }
                return value;
            }
        } catch (ClassNotFoundException e) {
            throw new TypeException("...");
        }
    }

	public void registerAliases(String packageName) {//通过包名注册所有类// [!code focus]
        this.registerAliases(packageName, Object.class);// [!code focus]
    }

	public void registerAliases(String packageName, Class<?> superType) {// [!code focus]
        ResolverUtil<Class<?>> resolverUtil = new ResolverUtil();// [!code focus]
        resolverUtil.find(new ResolverUtil.IsA(superType), packageName);//要检验包名加载出来的类与class是否匹配 // [!code focus]
        Set<Class<?>> typeSet = resolverUtil.getClasses();
        for(Class<?> type : typeSet){
			//不是匿名类,接口,内部类// [!code focus]
            if (!type.isAnonymousClass() && !type.isInterface() && !type.isMemberClass()) {// [!code focus]
                registerAlias(type);// [!code focus]
            }
        }
    }

    public void registerAlias(Class<?> type) {// [!code focus]
        String alias = type.getSimpleName();
        Alias aliasAnnotation = type.getAnnotation(Alias.class);
        if (aliasAnnotation != null) {//如果注解上有别名,取注解上的// [!code focus]
            alias = aliasAnnotation.value();
        }
        registerAlias(alias, type);// [!code focus]
    }

	public void registerAlias(String alias, Class<?> value) {
        if (alias == null) {
            throw new TypeException("The parameter alias cannot be null");
        } else {
            String key = alias.toLowerCase(Locale.ENGLISH);
            if (this.typeAliases.containsKey(key) && this.typeAliases.get(key) != null && !((Class)this.typeAliases.get(key)).equals(value)) {
                throw new TypeException("...");
            } else {
                this.typeAliases.put(key, value);// [!code focus]
            }
        }
    }

}
```

### ResolverUtil
	
```java
public class ResolverUtil<T> {//通过虚拟文件系统从.class里查找符合条件的类
    
    public ResolverUtil<T> find(Test test, String packageName) {//使用一个接口Test,和内部实现类IsA
        String path = this.getPackagePath(packageName);
        try {
            List<String> children = VFS.getInstance().list(path);//从文件加载的类里找
            for(String child : children){
                if (child.endsWith(".class")) {
                    addIfMatching(test, child);
                }
            }
        } catch (IOException e) {
            log.error("Could not read package: " + packageName, e);
        }
        return this;
    }

    protected String getPackagePath(String packageName) {
        return packageName == null ? null : packageName.replace('.', '/');
    }

    protected void addIfMatching(Test test, String classFilePath) {
        try {
            String externalName = classFilePath.substring(0, classFilePath.indexOf(46)).replace('/', '.');
            ClassLoader loader = this.getClassLoader();
            if (log.isDebugEnabled()) {
                log.debug("...");
            }
            Class<?> type = loader.loadClass(externalName);
            if (test.matches(type)) {//加载出来的类是否与传的相匹配 //[!code hl]
                this.matches.add(type);
            }
        } catch (Throwable throw) {
            log.warn("...");
        }
    }
}
```