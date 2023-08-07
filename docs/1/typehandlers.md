# 解析typehandlers节点
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
        this.typeHandlerElement(root.evalNode("typeHandlers"));//[!code focus]
        this.mapperElement(root.evalNode("mappers"));
    } catch (Exception e) {
        throw new BuilderException("...");
    }
}
```
```xml
<typeHandlers> 
	<package name="xyz.coolblog.handlers"/> 
</typeHandlers> 
    
<typeHandlers> 
	<typeHandler handler="com.nasses.mybatis.chapter01.mybatis.model.ArticleTypeHandler" javaType="com.nasses.mybatis.chapter01.mybatis.model.ArticleTypeEnum"/>
</typeHandlers> 
```

### typeHandlerElement
```java
private void typeHandlerElement(XNode parent) {
    if (parent != null) {
        List<XNode> children = parent.getChildren();
        for(XNode child : children) {
            String typeHandlerPackage;
            if ("package".equals(child.getName())) {//根据包注册
                typeHandlerPackage = child.getStringAttribute("name");
                this.typeHandlerRegistry.register(typeHandlerPackage);
            } else {//根据类注册
                typeHandlerPackage = child.getStringAttribute("javaType");
                String jdbcTypeName = child.getStringAttribute("jdbcType");
                String handlerTypeName = child.getStringAttribute("handler");
                Class<?> javaTypeClass = this.resolveClass(typeHandlerPackage);// TypeHandlerRegistry
                JdbcType jdbcType = this.resolveJdbcType(jdbcTypeName);//JdbcType.valueOf(alias)
                Class<?> typeHandlerClass = this.resolveClass(handlerTypeName);
                if (javaTypeClass != null) {
                    if (jdbcType == null) {
                        this.typeHandlerRegistry.register(javaTypeClass, typeHandlerClass);
                    } else {
                        this.typeHandlerRegistry.register(javaTypeClass, jdbcType, typeHandlerClass);
                    }
                } else {
                    this.typeHandlerRegistry.register(typeHandlerClass);
                }
            }
        }
    }
}
```

### TypeHandlerRegistry
```java
public final class TypeHandlerRegistry {
    private final Map<JdbcType, TypeHandler<?>> jdbcTypeHandlerMap = new EnumMap(JdbcType.class);// jdbc类型-处理类
    private final Map<Type, Map<JdbcType, TypeHandler<?>>> typeHandlerMap = new ConcurrentHashMap();//java类型 与 jdbc类型-处理类

    private final Map<Class<?>, TypeHandler<?>> allTypeHandlersMap = new HashMap();//处理类Class与实体的映射
    private static final Map<JdbcType, TypeHandler<?>> NULL_TYPE_HANDLER_MAP = Collections.emptyMap();//空map
    private Class<? extends TypeHandler> defaultEnumTypeHandler = EnumTypeHandler.class;//枚举处理器,每次使用newInstance创建新的
    private final TypeHandler<Object> unknownTypeHandler = new UnknownTypeHandler(this);//处理Object/JdbcType.OTHER

	public TypeHandlerRegistry() {//注册默认类型处理器
        this.register((Class)Boolean.class, (TypeHandler)(new BooleanTypeHandler()));
		....
	}

    public void register(String packageName) {//根据包名注册handler
        ResolverUtil<Class<?>> resolverUtil = new ResolverUtil();//通过虚拟文件系统从.class里查找符合条件的类
        resolverUtil.find(new ResolverUtil.IsA(TypeHandler.class), packageName);//用虚拟文件系统从.class
        Set<Class<?>> handlerSet = resolverUtil.getClasses();
        for(Class<?> type : handlerSet){
            if (!type.isAnonymousClass() && !type.isInterface() && !Modifier.isAbstract(type.getModifiers())) {//不是匿名类,接口,抽象类
                register(type);//根据类注册
            }
        }
    }

    public void register(Class<?> typeHandlerClass) {
        boolean mappedTypeFound = false;
        MappedTypes mappedTypes = typeHandlerClass.getAnnotation(MappedTypes.class);
        if (mappedTypes != null) {
            Class<?>[] classes = mappedTypes.value();
            for(Class<?> javaTypeClass : classes) {
                register(javaTypeClass, typeHandlerClass);
                mappedTypeFound = true;
            }
        }
        if (!mappedTypeFound) {//没有找到注解
            register(getInstance(null, typeHandlerClass));//创建实体并注册
        }
    }
        
    public void register(Class<?> javaTypeClass, Class<?> typeHandlerClass) {
        register(javaTypeClass, getInstance(javaTypeClass, typeHandlerClass));
    }
    
    public <T> void register(Class<T> javaType, TypeHandler<? extends T> typeHandler) {
        register((Type)javaType, typeHandler);
    }
    
    private <T> void register(Type javaType, TypeHandler<? extends T> typeHandler) {//根据Type注册
        MappedJdbcTypes mappedJdbcTypes = typeHandler.getClass().getAnnotation(MappedJdbcTypes.class);
        if (mappedJdbcTypes != null) {
            JdbcType[] jdbcTypes = mappedJdbcTypes.value();
            for(JdbcType handledJdbcType : jdbcTypes) {
                register(javaType, handledJdbcType, typeHandler);
            }
            if (mappedJdbcTypes.includeNullJdbcType()) {
                register(javaType, null, typeHandler);
            }
        } else {
            register(javaType, null, typeHandler);
        }
    }
    
    private void register(Type javaType, JdbcType jdbcType, TypeHandler<?> handler) {
        if (javaType != null) {
            Map<JdbcType, TypeHandler<?>> map = this.typeHandlerMap.get(javaType);// Type- jdbcType-handler
            if (map == null || map == NULL_TYPE_HANDLER_MAP) {
                map = new HashMap();
                this.typeHandlerMap.put(javaType, map);
            }
            ((Map)map).put(jdbcType, handler);
        }
        this.allTypeHandlersMap.put(handler.getClass(), handler);//handlerClass与实体的映射
    }
    
    
    public <T> void register(TypeHandler<T> typeHandler) {//根据handler注册
        boolean mappedTypeFound = false;
        MappedTypes mappedTypes = (MappedTypes)typeHandler.getClass().getAnnotation(MappedTypes.class);
        if (mappedTypes != null) {
            Class[] classes = mappedTypes.value();
            for(Class<?> handledType: classes) {
                register((Type)handledType, (TypeHandler)typeHandler);//根据Type注册
                mappedTypeFound = true;
            }
        }
        if (!mappedTypeFound && typeHandler instanceof TypeReference) {//没有注解 但是继承自TypeReference
            try {
                TypeReference<T> typeReference = (TypeReference)typeHandler;
                register(typeReference.getRawType(), typeHandler);//根据Type注册
                mappedTypeFound = true;
            } catch (Throwable throwable) {
            }
        }
        if (!mappedTypeFound) {
            register((Class)null, typeHandler);//CLass
        }
    }
    
    public <T> void register(Class<T> javaType, TypeHandler<? extends T> typeHandler) {//Class -> type
        register((Type)javaType, typeHandler);
    }
    
    ...
}
```

### TypeHandler
```java
public interface TypeHandler<T> {
    void setParameter(PreparedStatement ps, int parameterIndex, T parameter, JdbcType jdbcType) throws SQLException;

    T getResult(ResultSet rs, String columnName) throws SQLException;

    T getResult(ResultSet rs, int columnIndex) throws SQLException;

    T getResult(CallableStatement cs, int columnIndex) throws SQLException;
}
```

### TypeReference
```java
public abstract class TypeReference<T> {
    private final Type rawType = this.getSuperclassTypeParameter(this.getClass());

    protected TypeReference() {
    }

    Type getSuperclassTypeParameter(Class<?> clazz) {
        Type genericSuperclass = clazz.getGenericSuperclass();//带泛型的父类
        if (genericSuperclass instanceof Class) {// Class类的子类
            if (TypeReference.class != genericSuperclass) {//排除自己
                return this.getSuperclassTypeParameter(clazz.getSuperclass());
            } else {
                throw new TypeException("...");
            }
        } else {
            Type rawType = ((ParameterizedType)genericSuperclass).getActualTypeArguments()[0];//父类泛型数组 <>内
            if (rawType instanceof ParameterizedType) {
                rawType = ((ParameterizedType)rawType).getRawType();//原始类型 List<String> -> List
            }
            return rawType;
        }
    }

    public final Type getRawType() {
        return this.rawType;
    }

    public String toString() {
        return this.rawType.toString();
    }
}
```

### BaseTypeHandler
```java
public abstract class BaseTypeHandler<T> extends TypeReference<T> implements TypeHandler<T> {

    public BaseTypeHandler() {
    }

    public void setParameter(PreparedStatement ps, int parameterIndex, T parameter, JdbcType jdbcType) throws SQLException {
        if (parameter == null) {
            if (jdbcType == null) {
                throw new TypeException("...");
            }
            try {
                ps.setNull(parameterIndex, jdbcType.TYPE_CODE);
            } catch (SQLException e) {
                throw new TypeException("...");
            }
        } else {
            try {
                this.setNonNullParameter(ps, parameterIndex, parameter, jdbcType);
            } catch (Exception e) {
                throw new TypeException("...");
            }
        }
    }

    public T getResult(ResultSet rs, String columnName) throws SQLException {
        try {
            return this.getNullableResult(rs, columnName);
        } catch (Exception e) {
            throw new ResultMapException("...");
        }
    }

    public T getResult(ResultSet rs, int columnIndex) throws SQLException {
        try {
            return this.getNullableResult(rs, columnIndex);
        } catch (Exception e) {
            throw new ResultMapException("...");
        }
    }

    public T getResult(CallableStatement cs, int columnIndex) throws SQLException {
        try {
            return this.getNullableResult(cs, columnIndex);
        } catch (Exception e) {
            throw new ResultMapException("...");
        }
    }

    public abstract void setNonNullParameter(PreparedStatement ps, int parameterIndex, T parameter, JdbcType jdbcType) throws SQLException;

    public abstract T getNullableResult(ResultSet rs, String columnName) throws SQLException;

    public abstract T getNullableResult(ResultSet rs, int columnIndex) throws SQLException;

    public abstract T getNullableResult(CallableStatement cs, int columnIndex) throws SQLException;
}
```