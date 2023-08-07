
# 读取配置文件

```java
String resource = "chapter01/mybatis-config.xml";
InputStream inputStream = Resources.getResourceAsStream(resource);
SqlSessionFactory sqlSessionFactory =  new SqlSessionFactoryBuilder().build(inputStream); 

可以手动构建配置
PooledDataSource dataSource = new PooledDataSource();
dataSource.setDriver("");dataSource.setUrl("");dataSource.setUsername("");dataSource.setPassword("");
TransactionFactory transactionFactory = new JdbcTransactionFactory();
Environment environment = new Environment("development", transactionFactory, dataSource);
Configuration configuration = new Configuration(environment);
configuration.getTypeAliasRegistry().registerAlias("Article", Article.class);
configuration.addMapper(ArticleDao.class);
sqlSessionFactory = new SqlSessionFactoryBuilder().build(configuration);
SqlSessionFactory sqlSessionFactory =  new SqlSessionFactoryBuilder().build(config); 

public void testMyBatis(){
    SqlSession session = null;
    try {
        session = sqlSessionFactory.openSession();
        ArticleDao articleDao = session.getMapper(ArticleDao.class);
        List<Article> articles = articleDao.findByAuthorAndCreateTime("wes", "2018-06-10");
        System.out.println(articles);
    } finally {
        session.commit();
        session.close();
    }
}
```

### Resource

 `Resources(使用ClassLoaderWrapper读取)` -> `SqlSessionFactoryBuilder(使用XMLConfigBuilder解析)` `build()` -> `sqlSessionFactory(使用时openSession()得到SqlSession对象)`


```java
String resource = "chapter01/mybatis-config.xml";
InputStream inputStream = Resources.getResourceAsStream(resource);// [!code focus]
SqlSessionFactory sqlSessionFactory =  new SqlSessionFactoryBuilder().build(inputStream); 
```

```java
public class Resources {//通过ClassLoaderWrapper来读取资源文件
    private static ClassLoaderWrapper classLoaderWrapper = new ClassLoaderWrapper();
    private static Charset charset;
    Resources() {
    }
    public static InputStream getResourceAsStream(ClassLoader loader, String resource) throws IOException {
        InputStream in = classLoaderWrapper.getResourceAsStream(resource, loader);// [!code hl]
        if (in == null) {
            throw new IOException("Could not find resource " + resource);
        } else {
            return in;
        }
    }
    ...
}
```

### ClassLoaderWrapper

```java    
public class ClassLoaderWrapper {//classLoader包装器 内置一个数组,包含各种classLoader
    ClassLoader defaultClassLoader;//通过Resource来传递,或者是null
    ClassLoader systemClassLoader;
    ClassLoaderWrapper() {
        try {
            this.systemClassLoader = ClassLoader.getSystemClassLoader();
        } catch (SecurityException se) {
        }
    }
    //共有三个方法,一个返回InputStream,一个返回URL,一个返回Class<?>
    InputStream getResourceAsStream(String resource, ClassLoader[] classLoader) {
        for(int i = 0; i < classLoader.length; ++i) {
            ClassLoader cl = classLoader[i];
            if (null != cl) {
                InputStream returnValue = cl.getResourceAsStream(resource);// [!code hl]
                if (null == returnValue) {
                    returnValue = cl.getResourceAsStream("/" + resource);
                }
                if (null != returnValue) {
                    return returnValue;
                }
            }
        }
        return null;
    }
    ClassLoader[] getClassLoaders(ClassLoader classLoader) {
        return new ClassLoader[]{
                classLoader,
                this.defaultClassLoader,
                Thread.currentThread().getContextClassLoader(),
                this.getClass().getClassLoader(),
                this.systemClassLoader};
    }
}
```

### SqlSessionFactoryBuilder

```java
String resource = "chapter01/mybatis-config.xml";
InputStream inputStream = Resources.getResourceAsStream(resource);
SqlSessionFactory sqlSessionFactory =  new SqlSessionFactoryBuilder().build(inputStream); // [!code focus]
```

```java
//通过XMLConfigBuilder解析xml创建SqlSessionFactory
public class SqlSessionFactoryBuilder {
    //InputStream 或者 Reader
    public SqlSessionFactory build(InputStream inputStream, String environment, Properties properties) {
        SqlSessionFactory sqlSessionFactory;
        try {
            XMLConfigBuilder parser = new XMLConfigBuilder(inputStream, environment, properties);// [!code hl]
            //解析成Configuration对象
			sqlSessionFactory = this.build(parser.parse());// [!code hl]
        } catch (Exception e) {
            throw ExceptionFactory.wrapException("Error building SqlSession.", e);
        } finally {
            ErrorContext.instance().reset();
            try {
                inputStream.close();
            } catch (IOException ioe) {
            }
        }
        return sqlSessionFactory;
    }
	//也可以直接通过config来创建
    public SqlSessionFactory build(Configuration config) {// [!code hl]
        return new DefaultSqlSessionFactory(config);
    }
}
```
