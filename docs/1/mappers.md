# 解析mappers节点
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
        this.settingsElement(settings);
        this.environmentsElement(root.evalNode("environments"));
        this.databaseIdProviderElement(root.evalNode("databaseIdProvider"));
        this.typeHandlerElement(root.evalNode("typeHandlers"));
        this.mapperElement(root.evalNode("mappers"));//[!code focus]
    } catch (Exception e) {
        throw new BuilderException("...");
    }
}
```
```xml
<!-- 使用相对于类路径的资源引用 -->
<mappers>
  <mapper resource="org/mybatis/builder/AuthorMapper.xml"/>
</mappers>
<!-- 使用完全限定资源定位符（URL） -->
<mappers>
  <mapper url="file:///var/mappers/AuthorMapper.xml"/>
</mappers>
<!-- 使用映射器接口实现类的完全限定类名 -->
<mappers>
  <mapper class="org.mybatis.builder.AuthorMapper"/>
</mappers>
<!-- 将包内的映射器接口全部注册为映射器 -->
<mappers>
  <package name="org.mybatis.builder"/>
</mappers>
```
### mapperElement
```java
private void mapperElement(XNode parent) throws Exception {
    if (parent != null) {
        List<XNode> children = parent.getChildren();
        for(XNode child : children){
            String resource;
            if ("package".equals(child.getName())) {//扫描整个包 //[!code hl]
                resource = child.getStringAttribute("name");
                this.configuration.addMappers(resource);// mapperRegistry
            } else {
                resource = child.getStringAttribute("resource");
                String url = child.getStringAttribute("url");
                String mapperClass = child.getStringAttribute("class");
                XMLMapperBuilder mapperParser;
                InputStream inputStream;
                if (resource != null && url == null && mapperClass == null) {//只resource //[!code hl]
                    ErrorContext.instance().resource(resource);
                    inputStream = Resources.getResourceAsStream(resource);
                    mapperParser = new XMLMapperBuilder(inputStream, this.configuration, resource, this.configuration.getSqlFragments());
                    mapperParser.parse();
                } else if (resource == null && url != null && mapperClass == null) {//只有url //[!code hl]
                    ErrorContext.instance().resource(url);
                    inputStream = Resources.getUrlAsStream(url);
                    mapperParser = new XMLMapperBuilder(inputStream, this.configuration, url, this.configuration.getSqlFragments());
                    mapperParser.parse();
                } else if(resource == null || url == null || mapperClass != null){//只有class //[!code hl]
                    Class<?> mapperInterface = Resources.classForName(mapperClass);
                    this.configuration.addMapper(mapperInterface);//mapperRegistry
                } else {
                    throw new BuilderException("...");
                }
            }
        }
    }
}
```
### 通过包名下的类来解析
```java
public void addMappers(String packageName) {
    this.mapperRegistry.addMappers(packageName);
}
```
### MapperRegistry
```java
public class MapperRegistry {
    private final Configuration config;
    private final Map<Class<?>, MapperProxyFactory<?>> knownMappers = new HashMap();//注册Mapper类和代理对象

    public MapperRegistry(Configuration config) {
        this.config = config;
    }

    public <T> T getMapper(Class<T> type, SqlSession sqlSession) {
        MapperProxyFactory<T> mapperProxyFactory = (MapperProxyFactory)this.knownMappers.get(type);//查找 //[!code hl]
        if (mapperProxyFactory == null) {
            throw new BindingException("...");
        } else {
            try {
                return mapperProxyFactory.newInstance(sqlSession);//创建代理对象 //[!code hl]
            } catch (Exception e) {
                throw new BindingException("...");
            }
        }
    }

    public <T> boolean hasMapper(Class<T> type) {
        return this.knownMappers.containsKey(type);
    }

    public <T> void addMapper(Class<T> type) {
        if (type.isInterface()) {//必须是接口
            if (this.hasMapper(type)) {//重复
                throw new BindingException("...");
            }
            boolean loadCompleted = false;
            try {
                this.knownMappers.put(type, new MapperProxyFactory(type));
                MapperAnnotationBuilder parser = new MapperAnnotationBuilder(this.config, type);//[!code hl]
                parser.parse();//注解解析
                loadCompleted = true;
            } finally {
                if (!loadCompleted) {
                    this.knownMappers.remove(type);
                }
            }
        }
    }

    public Collection<Class<?>> getMappers() {
        return Collections.unmodifiableCollection(this.knownMappers.keySet());
    }

    public void addMappers(String packageName, Class<?> superType) {
        ResolverUtil<Class<?>> resolverUtil = new ResolverUtil();
        resolverUtil.find(new IsA(superType), packageName);//vfs加载包下所有
        Set<Class<? extends Class<?>>> mapperSet = resolverUtil.getClasses();
        Iterator it = mapperSet.iterator();
        while(it.hasNext()) {
            Class<?> mapperClass = (Class)it.next();
            this.addMapper(mapperClass);//包下所有接口
        }

    }

    public void addMappers(String packageName) {//入口
        this.addMappers(packageName, Object.class);
    }
}
```
### MapperProxyFactory
```java
public class MapperProxyFactory<T> {
    private final Class<T> mapperInterface;//被代理的Mapper接口
    private final Map<Method, MapperMethod> methodCache = new ConcurrentHashMap();//Mapper的方法及 对应的可执行对象 ConcurrentHashMap线程安全

    public MapperProxyFactory(Class<T> mapperInterface) {
        this.mapperInterface = mapperInterface;
    }

    public Class<T> getMapperInterface() {
        return this.mapperInterface;
    }

    public Map<Method, MapperMethod> getMethodCache() {
        return this.methodCache;
    }

	public T newInstance(SqlSession sqlSession) {
        MapperProxy<T> mapperProxy = new MapperProxy(sqlSession, this.mapperInterface, this.methodCache);//创建代理对象
        return this.newInstance(mapperProxy);
    }

    protected T newInstance(MapperProxy<T> mapperProxy) {
        return Proxy.newProxyInstance(this.mapperInterface.getClassLoader(), new Class[]{this.mapperInterface}, mapperProxy);
    }
}
```

### MapperProxy
```java
public class MapperProxy<T> implements InvocationHandler, Serializable {
    private static final long serialVersionUID = -6424540398559729838L;
    private final SqlSession sqlSession;
    private final Class<T> mapperInterface;//被代理类
    private final Map<Method, MapperMethod> methodCache;

    public MapperProxy(SqlSession sqlSession, Class<T> mapperInterface, Map<Method, MapperMethod> methodCache) {
        this.sqlSession = sqlSession;
        this.mapperInterface = mapperInterface;
        this.methodCache = methodCache;
    }

	//通过invoke来执行代理对象的方法
	@Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        try {
            if (Object.class.equals(method.getDeclaringClass())) {// 如果方法是定义在 Object 类中的，则直接调用
                return method.invoke(this, args);
            }
            if (isDefaultMethod(method)) {
                return invokeDefaultMethod(proxy, method, args);
            }
        } catch (Throwable thr) {
            throw ExceptionUtil.unwrapThrowable(thr);
        }
        MapperMethod mapperMethod = cachedMapperMethod(method);//从缓存中获取,没有则创建
        return mapperMethod.execute(this.sqlSession, args);//执行 接口方法 没有原来的method.invoke// [!code hl]
    }

    private MapperMethod cachedMapperMethod(Method method) {//缓存下方法执行类
        return this.methodCache.computeIfAbsent(method, (k) -> {
            return new MapperMethod(this.mapperInterface, method, this.sqlSession.getConfiguration());//可执行的sql方法，后续分析 [!code hl]
        });
    }

    private Object invokeDefaultMethod(Object proxy, Method method, Object[] args) throws Throwable {
        Constructor<MethodHandles.Lookup> constructor = MethodHandles.Lookup.class.getDeclaredConstructor(Class.class, Integer.TYPE);
        if (!constructor.isAccessible()) {
            constructor.setAccessible(true);
        }
        Class<?> declaringClass = method.getDeclaringClass();
        return constructor.newInstance(declaringClass,  
		MethodHandles.Lookup.PRIVATE | MethodHandles.Lookup.PROTECTED | MethodHandles.Lookup.PACKAGE | MethodHandles.Lookup.PUBLIC )
		.unreflectSpecial(method, declaringClass)
		.bindTo(proxy)
		.invokeWithArguments(args);
    }

    private boolean isDefaultMethod(Method method) {//过滤 jdk1.8 接口中的默认方法
        return (method.getModifiers() & (Modifier.ABSTRACT | Modifier.PUBLIC | Modifier.STATIC)) == Modifier.PUBLIC
                && method.getDeclaringClass().isInterface();
    }
}
```