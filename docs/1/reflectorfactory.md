# 解析reflectorfactory节点
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
        this.reflectorFactoryElement(root.evalNode("reflectorFactory"));// [!code focus]
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

### reflectorFactoryElement
```java
private void reflectorFactoryElement(XNode context) throws Exception {
    if (context != null) {
        String type = context.getStringAttribute("type");
        ReflectorFactory factory = (ReflectorFactory)this.resolveClass(type).newInstance();
        this.configuration.setReflectorFactory(factory);
    }
}
```

### ReflectorFactory
```java
public interface ReflectorFactory {//反射工厂，对象的信息都存储在Reflector
    boolean isClassCacheEnabled();//是否允许缓存

    void setClassCacheEnabled(boolean classCacheEnabled);

    Reflector findForClass(Class<?> type);//[!code hl]
}
```

### DefaultReflectorFactory

```java
public class DefaultReflectorFactory implements ReflectorFactory{
    private boolean classCacheEnabled = true;
	//类作为key 类的属性方法信息存储在Reflector
    private final ConcurrentMap<Class<?>, Reflector> reflectorMap = new ConcurrentHashMap();//[!code hl]

    public DefaultReflectorFactory() {
    }

    public boolean isClassCacheEnabled() {
        return this.classCacheEnabled;
    }

    public void setClassCacheEnabled(boolean classCacheEnabled) {
        this.classCacheEnabled = classCacheEnabled;
    }

    public Reflector findForClass(Class<?> type) {
        return this.classCacheEnabled ? (Reflector)this.reflectorMap.computeIfAbsent(type, Reflector::new) : new Reflector(type);
    }
}
```

### 💥💥Reflector

```java
public class Reflector {//缓存了一个类的各种信息
	private final Class<?> type;
    private final String[] readablePropertyNames;//get方法名
    private final String[] writablePropertyNames;//set方法名
    private final Map<String, Invoker> setMethods = new HashMap();//MethodInvoker可执行
    private final Map<String, Invoker> getMethods = new HashMap();
    private final Map<String, Class<?>> setTypes = new HashMap();//用于保存  setter 对应的属性名与参数类型的映射  //[!code hl]
    private final Map<String, Class<?>> getTypes = new HashMap();//用于保存  getter 对应的属性名与返回值类型的映射 //[!code hl]
    private Constructor<?> defaultConstructor;//无参构造//[!code hl]
    private Map<String, String> caseInsensitivePropertyMap = new HashMap();//大写属性//[!code hl]
    
    public Reflector(Class<?> clazz) {
        this.type = clazz;
        this.addDefaultConstructor(clazz);//添加无参构造
        this.addGetMethods(clazz);//添加get方法
        this.addSetMethods(clazz);//添加set方法
        this.addFields(clazz);//添加属性
        this.readablePropertyNames = this.getMethods.keySet().toArray(new String[this.getMethods.keySet().size()]);
        this.writablePropertyNames = this.setMethods.keySet().toArray(new String[this.setMethods.keySet().size()]);
        for(String propName : readablePropertyNames) {//大写get
            this.caseInsensitivePropertyMap.put(propName.toUpperCase(Locale.ENGLISH), propName);
        }
        for(String propName : writablePropertyNames) {//大写set
            this.caseInsensitivePropertyMap.put(propName.toUpperCase(Locale.ENGLISH), propName);
        }
    }
    
    private void addDefaultConstructor(Class<?> clazz) {
        Constructor<?>[] consts = clazz.getDeclaredConstructors();
        for(Constructor<?> constructor : consts){
            if (constructor.getParameterTypes().length == 0) {//无参构造
                this.defaultConstructor = constructor;
            }
        }
    }
    
    private void addGetMethods(Class<?> cls) {
        Map<String, List<Method>> conflictingGetters = new HashMap();
        Method[] methods = this.getClassMethods(cls);
        for(Method method : methods){
            if (method.getParameterTypes().length <= 0) {//get无参数
                String name = method.getName();
                if (name.startsWith("get") && name.length() > 3 || name.startsWith("is") && name.length() > 2) {
                    name = PropertyNamer.methodToProperty(name);//属性名转换 getName -> name
                    addMethodConflict(conflictingGetters, name, method);// conflictingSetters新增冲突 //[!code hl] 
                }
            }
        }
        resolveGetterConflicts(conflictingGetters);//处理 get is 冲突的情况
    }
    
    private void addMethodConflict(Map<String, List<Method>> conflictingMethods, String name, Method method) {
        List<Method> list = (List)conflictingMethods.computeIfAbsent(name, (k) -> {
            return new ArrayList();
        });//如果存在则返回Map中的value 不存在则新建一个value存进去
        list.add(method);
    }
    
    private void resolveGetterConflicts(Map<String, List<Method>> conflictingGetters) {//is get冲突 但name是相同的 同一个name 存两个method
        Iterator iterator = conflictingGetters.entrySet().iterator();
        while(iterator.hasNext()) {
            Map.Entry<String, List<Method>> entry = (Map.Entry)iterator.next();
            Method winner = null;
            String propName = entry.getKey();
            List<Method> list = entry.getValue();
            for(Method candidate : list){
                if (winner == null) {
                    winner = candidate;
                } else {
                    Class<?> winnerType = winner.getReturnType();
                    Class<?> candidateType = candidate.getReturnType();
                    if (candidateType.equals(winnerType)) {//get is方法返回类型相同 //[!code hl]
                        if (!Boolean.TYPE.equals(candidateType)) {//不是布尔类型直接映射失败//[!code hl]
                            throw new ReflectionException("Illegal overloaded getter method with ambiguous type for property " + propName + " in class " + winner.getDeclaringClass() + ". This breaks the JavaBeans specification and can cause unpredictable results.");
                        }
                        if (candidate.getName().startsWith("is")) {//选择 is
                            winner = candidate;
                        }
                    } else if (!candidateType.isAssignableFrom(winnerType)) {//子类或实现 //[!code hl]
                        if (!winnerType.isAssignableFrom(candidateType)) {
                            throw new ReflectionException("Illegal overloaded getter method with ambiguous type for property " + propName + " in class " + winner.getDeclaringClass() + ". This breaks the JavaBeans specification and can cause unpredictable results.");
                        }
                        winner = candidate;// 选择子类
                    }
                }
            }
            addGetMethod(propName, winner);//添加筛选过的方法
        }
    }

    private void addGetMethod(String name, Method method) {
        if (isValidPropertyName(name)) {
            this.getMethods.put(name, new MethodInvoker(method));//可以直接执行//[!code hl]
            Type returnType = TypeParameterResolver.resolveReturnType(method, this.type);//解析方法的返回值类型
            this.getTypes.put(name, this.typeToClass(returnType));// 将返回值类型由 Type 转为 Class
        }
    }
    
    private void addSetMethods(Class<?> cls) {
        Map<String, List<Method>> conflictingSetters = new HashMap();
        Method[] methods = this.getClassMethods(cls);
        for(Method method : methods) {
            String name = method.getName();
            if (name.startsWith("set") && name.length() > 3 && method.getParameterTypes().length == 1) {//方法仅有一个参数
                name = PropertyNamer.methodToProperty(name);
                // setter 方法发生冲突原因是：可能存在重载情况，比如：
                //     void setSex(int sex);
                //     void setSex(SexEnum sex);
                addMethodConflict(conflictingSetters, name, method);// conflictingSetters新增冲突 
            }
        }
        resolveSetterConflicts(conflictingSetters);
    }

    private void resolveSetterConflicts(Map<String, List<Method>> conflictingSetters) {
        Iterator<String> iterator = conflictingSetters.keySet().iterator();
        while(iterator.hasNext()) {
            String propName = iterator.next();
            List<Method> setters = conflictingSetters.get(propName);
            Class<?> getterType = this.getTypes.get(propName);//用getter来反推
            Method match = null;
            ReflectionException exception = null;
            for(Method setter : setters){
                Class<?> paramType = setter.getParameterTypes()[0];
                if (paramType.equals(getterType)) {//与getter返回一致认为是对的 //[!code hl]
                    match = setter;
                    break;
                }
                if (exception == null) {
                    try {
                        match = pickBetterSetter(match, setter, propName);
                    } catch (ReflectionException re) {
                        match = null;
                        exception = re;
                    }
                }
            }
            if (match == null) {
                throw exception;
            }
            this.addSetMethod(propName, match);
        }
    }
	
	//使用子类
    private Method pickBetterSetter(Method setter1, Method setter2, String property) {
        if (setter1 == null) {
            return setter2;
        } else {
            Class<?> paramType1 = setter1.getParameterTypes()[0];
            Class<?> paramType2 = setter2.getParameterTypes()[0];//根据请求参数判断
            if (paramType1.isAssignableFrom(paramType2)) {//子类更合适
                return setter2;
            } else if (paramType2.isAssignableFrom(paramType1)) {
                return setter1;
            } else {//完全无关就报异常
                throw new ReflectionException("Ambiguous setters defined for property '" + property + "' in class '" + setter2.getDeclaringClass() + "' with types '" + paramType1.getName() + "' and '" + paramType2.getName() + "'.");
            }
        }
    }

	private void addFields(Class<?> clazz) {
        Field[] fields = clazz.getDeclaredFields();
        for(int i = 0; i < fields.length; ++i) {
            Field field = fields[i];
            if (!this.setMethods.containsKey(field.getName())) {//get
                int modifiers = field.getModifiers();
                if (!Modifier.isFinal(modifiers) || !Modifier.isStatic(modifiers)) {
                    this.addSetField(field);
                }
            }
            if (!this.getMethods.containsKey(field.getName())) {//set
                this.addGetField(field);
            }
        }
        if (clazz.getSuperclass() != null) {
            this.addFields(clazz.getSuperclass());//属性超类
        }
    }

    private void addSetField(Field field) {
        if (this.isValidPropertyName(field.getName())) {
            this.setMethods.put(field.getName(), new SetFieldInvoker(field));
            Type fieldType = TypeParameterResolver.resolveFieldType(field, this.type);
            this.setTypes.put(field.getName(), this.typeToClass(fieldType));
        }
    }

    private void addGetField(Field field) {
        if (this.isValidPropertyName(field.getName())) {
            this.getMethods.put(field.getName(), new GetFieldInvoker(field));
            Type fieldType = TypeParameterResolver.resolveFieldType(field, this.type);
            this.getTypes.put(field.getName(), this.typeToClass(fieldType));
        }
    }

}
```

### Invoker
```java
public interface Invoker {
    Object invoke(Object target, Object[] args) throws IllegalAccessException, InvocationTargetException;

    Class<?> getType();
}
```

### MethodInvoker
```java
public class MethodInvoker implements Invoker {
    private final Class<?> type;
    private final Method method;

    public MethodInvoker(Method method) {
        this.method = method;
        if (method.getParameterTypes().length == 1) {//一个参数则代表参数
            this.type = method.getParameterTypes()[0];
        } else {
            this.type = method.getReturnType();//否则代表返回
        }

    }

    public Object invoke(Object target, Object[] args) throws IllegalAccessException, InvocationTargetException {
        try {
            return this.method.invoke(target, args);
        } catch (IllegalAccessException e) {
            if (Reflector.canControlMemberAccessible()) {
                this.method.setAccessible(true);
                return this.method.invoke(target, args);
            } else {
                throw e;
            }
        }
    }

    public Class<?> getType() {
        return this.type;
    }
}
```

### GetFieldInvoker
```java
public class GetFieldInvoker implements Invoker {
    private final Field field;

    public GetFieldInvoker(Field field) {
        this.field = field;
    }

    public Object invoke(Object target, Object[] args) throws IllegalAccessException {
        try {
            return this.field.get(target);//[!code focus]
        } catch (IllegalAccessException e) {
            if (Reflector.canControlMemberAccessible()) {
                this.field.setAccessible(true);
                return this.field.get(target);
            } else {
                throw e;
            }
        }
    }

    public Class<?> getType() {
        return this.field.getType();
    }
}
```

### SetFieldInvoker
```java
public class SetFieldInvoker implements Invoker {
    private final Field field;

    public SetFieldInvoker(Field field) {
        this.field = field;
    }

    public Object invoke(Object target, Object[] args) throws IllegalAccessException {
        try {
            this.field.set(target, args[0]);//[!code focus]
        } catch (IllegalAccessException e) {
            if (!Reflector.canControlMemberAccessible()) {
                throw e;
            }

            this.field.setAccessible(true);
            this.field.set(target, args[0]);
        }

        return null;
    }

    public Class<?> getType() {
        return this.field.getType();
    }
}
```