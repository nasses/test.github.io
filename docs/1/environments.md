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
        this.settingsElement(settings);
        this.environmentsElement(root.evalNode("environments"));//[!code focus]
        this.databaseIdProviderElement(root.evalNode("databaseIdProvider"));//[!code focus]
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

### TransactionFactory
```java
public interface TransactionFactory {
    void setProperties(Properties props);

    Transaction newTransaction(Connection conn);

    Transaction newTransaction(DataSource ds, TransactionIsolationLevel level, boolean autoCommit);
}
```
### Transaction
```java
public interface Transaction {
    Connection getConnection() throws SQLException;

    void commit() throws SQLException;

    void rollback() throws SQLException;

    void close() throws SQLException;

    Integer getTimeout() throws SQLException;
}
``` 

事务工厂的实现包括:
- JdbcTransactionFactory 使用 `JdbcTransaction`
- ManagedTransactionFactory 使用 `ManagedTransaction`
- SpringManagedTransactionFactory 使用 `SpringManagedTransaction`

JdbcTransaction 在`openConnection`时设置了`TransactionIsolationLevel` 和 `autoCommit`

ManagedTransaction 设置了`TransactionIsolationLevel`但没有设置`autoCommit` 但它有一个`closeConnection`判断是否关闭了连接

SpringManagedTransaction 是在`openConnection`时获取的数据库的`autoCommit`和数据源的 `isConnectionTransactional`


### DataSourceFactory

```java
public interface DataSourceFactory {
    void setProperties(Properties props);

    DataSource getDataSource();
}
```

### JndiDataSourceFactory
```java
//Java Nameing Directory Interface //[!code focus]
public class JndiDataSourceFactory implements DataSourceFactory {//[!code focus]
public static final String INITIAL_CONTEXT = "initial_context";
    public static final String DATA_SOURCE = "data_source";
    public static final String ENV_PREFIX = "env.";
    private DataSource dataSource;

    public JndiDataSourceFactory() {
    }

    public void setProperties(Properties properties) {
        try {
            Properties env = getEnvProperties(properties);
            InitialContext initCtx;
            if (env == null) {
                initCtx = new InitialContext();
            } else {
                initCtx = new InitialContext(env);//[!code focus]
            }

            if (properties.containsKey(INITIAL_CONTEXT) && properties.containsKey(DATA_SOURCE)) {
                Context ctx = (Context)initCtx.lookup(properties.getProperty(INITIAL_CONTEXT));//[!code focus]
                this.dataSource = (DataSource)ctx.lookup(properties.getProperty(DATA_SOURCE));//[!code focus]
            } else if (properties.containsKey(DATA_SOURCE)) {
                this.dataSource = (DataSource)initCtx.lookup(properties.getProperty(DATA_SOURCE));
            }

        } catch (NamingException e) {
            throw new DataSourceException("...");
        }
    }

    public DataSource getDataSource() {
        return this.dataSource;
    }

    private static Properties getEnvProperties(Properties allProps) {
        String PREFIX = "env.";
        Properties contextProperties = null;
        Iterator iterator = allProps.entrySet().iterator();
        while(iterator.hasNext()) {
            Entry<Object, Object> entry = (Entry)iterator.next();
            String key = (String)entry.getKey();
            String value = (String)entry.getValue();
            if (key.startsWith(ENV_PREFIX)) {
                if (contextProperties == null) {
                    contextProperties = new Properties();
                }
                contextProperties.put(key.substring(ENV_PREFIX.length()), value);
            }
        }
        return contextProperties;
    }
}
```

### UnpooledDataSourceFactory
```java 
public class UnpooledDataSourceFactory implements DataSourceFactory {//[!code focus]
    private static final String DRIVER_PROPERTY_PREFIX = "driver.";
    private static final int DRIVER_PROPERTY_PREFIX_LENGTH = "driver.".length();
    protected DataSource dataSource = new UnpooledDataSource();//[!code focus]
	public UnpooledDataSourceFactory() {
    }

    public void setProperties(Properties properties) {
        Properties driverProperties = new Properties();
        MetaObject metaDataSource = SystemMetaObject.forObject(this.dataSource);//数据源的对象数据//[!code focus]
        Iterator iterator = properties.keySet().iterator();
        while(iterator.hasNext()) {
            Object key = iterator.next();
            String propertyName = (String)key;
            String value;
            if (propertyName.startsWith("driver.")) {
                value = properties.getProperty(propertyName);
                driverProperties.setProperty(propertyName.substring(DRIVER_PROPERTY_PREFIX_LENGTH), value);
            } else {
                if (!metaDataSource.hasSetter(propertyName)) {
                    throw new DataSourceException("...");
                }
                value = (String)properties.get(propertyName);//这里强转的String,因此要知道配置的实际类型，比如Boolean和Integer//[!code focus]
                Object convertedValue = this.convertValue(metaDataSource, //[!code focus]propertyName, value);
                metaDataSource.setValue(propertyName, convertedValue);
            }
        }
        if (driverProperties.size() > 0) {
            metaDataSource.setValue("driverProperties", driverProperties);
        }
    }

    public DataSource getDataSource() {
        return this.dataSource;
    }

    private Object convertValue(MetaObject metaDataSource, String propertyName, String value) {//[!code focus]
        Object convertedValue = value;
        Class<?> targetType = metaDataSource.getSetterType(propertyName);//[!code focus]
        if (targetType != Integer.class && targetType != Integer.TYPE) {
            if (targetType != Long.class && targetType != Long.TYPE) {
                if (targetType == Boolean.class || targetType == Boolean.TYPE) {
                    convertedValue = Boolean.valueOf(value);
                }
            } else {
                convertedValue = Long.valueOf(value);
            }
        } else {
            convertedValue = Integer.valueOf(value);
        }
        return convertedValue;
    }
}
```

### UnpooledDataSource
```java
public class UnpooledDataSource implements DataSource {
    private ClassLoader driverClassLoader;
    private Properties driverProperties;
    private static Map<String, Driver> registeredDrivers = new ConcurrentHashMap();
    private String driver;
    private String url;
    private String username;
    private String password;
    private Boolean autoCommit;
    private Integer defaultTransactionIsolationLevel;
	
	static {
        Enumeration drivers = DriverManager.getDrivers();
        while(drivers.hasMoreElements()) {
            Driver driver = (Driver)drivers.nextElement();
            registeredDrivers.put(driver.getClass().getName(), driver);//记录所有注册的驱动
        }
    }

    public UnpooledDataSource() {
    }

	private Connection doGetConnection(Properties properties) throws SQLException {
        this.initializeDriver();
        Connection connection = DriverManager.getConnection(this.url, properties);
        this.configureConnection(connection);
        return connection;
    }

    private synchronized void initializeDriver() throws SQLException {
        if (!registeredDrivers.containsKey(this.driver)) {//没注册过的
            try {
                Class driverType;
                if (this.driverClassLoader != null) {
                    driverType = Class.forName(this.driver, true, this.driverClassLoader);//加载驱动
                } else {
                    driverType = Resources.classForName(this.driver);
                }
                Driver driverInstance = (Driver)driverType.newInstance();
                DriverManager.registerDriver(new UnpooledDataSource.DriverProxy(driverInstance));//注册
                registeredDrivers.put(this.driver, driverInstance);//记录
            } catch (Exception e) {
                throw new SQLException("...");
            }
        }

    }

    private void configureConnection(Connection conn) throws SQLException {
        if (this.autoCommit != null && this.autoCommit != conn.getAutoCommit()) {
            conn.setAutoCommit(this.autoCommit);//设置自动提交
        }
        if (this.defaultTransactionIsolationLevel != null) {
            conn.setTransactionIsolation(this.defaultTransactionIsolationLevel);//设置隔离级别
        }
    }
}
```

### DatabaseIdProvider
```java
public interface DatabaseIdProvider {
    void setProperties(Properties props);

    String getDatabaseId(DataSource dataSource) throws SQLException;
}
```

### databaseIdProviderElement
```java
private void databaseIdProviderElement(XNode context) throws Exception {//不同数据源隔离
    DatabaseIdProvider databaseIdProvider = null;
    if (context != null) {
        String type = context.getStringAttribute("type");
        if ("VENDOR".equals(type)) {
            type = "DB_VENDOR";
        }
        Properties properties = context.getChildrenAsProperties();
        databaseIdProvider = (DatabaseIdProvider)this.resolveClass(type).newInstance();
        databaseIdProvider.setProperties(properties);
    }
    Environment environment = this.configuration.getEnvironment();
    if (environment != null && databaseIdProvider != null) {
        String databaseId = databaseIdProvider.getDatabaseId(environment.getDataSource());
        this.configuration.setDatabaseId(databaseId);
    }
}
```

### VendorDatabaseIdProvider
```java
public class VendorDatabaseIdProvider implements DatabaseIdProvider {
    private Properties properties;

    public VendorDatabaseIdProvider() {
    }

    public String getDatabaseId(DataSource dataSource) {
        if (dataSource == null) {
            throw new NullPointerException("dataSource cannot be null");
        } else {
            try {
                return this.getDatabaseName(dataSource);
            } catch (Exception e) {
                VendorDatabaseIdProvider.LogHolder.log.error("Could not get a databaseId from dataSource", e);
                return null;
            }
        }
    }

    public void setProperties(Properties p) {
        this.properties = p;
    }

    private String getDatabaseName(DataSource dataSource) throws SQLException {
        String productName = this.getDatabaseProductName(dataSource);
        if (this.properties != null) {
            Iterator iterator = this.properties.entrySet().iterator();
            Entry entry;
            do {
                if (!iterator.hasNext()) {
                    return null;
                }
                entry = (Entry)iterator.next();
            } while(!productName.contains((String)property.getKey()));
            return (String)entry.getValue();
        } else {
            return productName;
        }
    }

    private String getDatabaseProductName(DataSource dataSource) throws SQLException {
        Connection con = null;
        String name;
        try {
            con = dataSource.getConnection();
            DatabaseMetaData metaData = con.getMetaData();//[!code focus]
            name = metaData.getDatabaseProductName();//[!code focus]
        } finally {
            if (con != null) {
                try {
                    con.close();
                } catch (SQLException var11) {
                }
            }
        }
        return name;
    }

    private static class LogHolder {
        private static final Log log = LogFactory.getLog(VendorDatabaseIdProvider.class);

        private LogHolder() {
        }
    }
}
```