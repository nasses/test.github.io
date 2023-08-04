# xml解析

>XPathParser(使用javax.xml.xpath.XPath解析xml文件并记录在XNode, XMLMapperEntityResolver实现了org.xml.sax.EntityResolver, 通过读取dtd来获取xml的解析规则) -> 


### 🎯XMLConfigBuilder

```java
public class XMLConfigBuilder extends BaseBuilder {//需要XPathParser 
    private boolean parsed;
    private final XPathParser parser;//使用Xpath 和 XMLMapperEntityResolver传入规则
    private String environment;
    private final ReflectorFactory localReflectorFactory;
    
    public XMLConfigBuilder(InputStream inputStream, String environment, Properties props) {
        this(new XPathParser(inputStream, true, props, new XMLMapperEntityResolver()), environment, props);// [!code hl]
    }
    
    private XMLConfigBuilder(XPathParser parser, String environment, Properties props) {
        super(new Configuration());
        this.localReflectorFactory = new DefaultReflectorFactory();
        ErrorContext.instance().resource("SQL Mapper Configuration");
        this.configuration.setVariables(props);
        this.parsed = false;
        this.environment = environment;
        this.parser = parser;
    }

    public Configuration parse() {//解析 //[!code hl]
        if (this.parsed) {
            throw new BuilderException("Each XMLConfigBuilder can only be used once.");
        } else {
            this.parsed = true;
            this.parseConfiguration(this.parser.evalNode("/configuration"));// [!code hl]
            return this.configuration;
        }
    }

    private void parseConfiguration(XNode root) {// [!code hl]
        try {
            propertiesElement(root.evalNode("properties"));
            Properties settings = settingsAsProperties(root.evalNode("settings"));
            loadCustomVfs(settings);//从配置中读取vfs实现类 加载jar包
            loadCustomLogImpl(settings);//从配置中读取log实现类
            typeAliasesElement(root.evalNode("typeAliases"));
            pluginElement(root.evalNode("plugins"));
            objectFactoryElement(root.evalNode("objectFactory"));
            objectWrapperFactoryElement(root.evalNode("objectWrapperFactory"));
            reflectorFactoryElement(root.evalNode("reflectorFactory"));
            settingsElement(settings);
            environmentsElement(root.evalNode("environments"));
            databaseIdProviderElement(root.evalNode("databaseIdProvider"));
            typeHandlerElement(root.evalNode("typeHandlers"));
            mapperElement(root.evalNode("mappers"));
        } catch (Exception e) {
            throw new BuilderException("Error parsing SQL Mapper Configuration. Cause: " + e, e);
        }
    }
}
```

### XPathParser

```java
public class XPathParser{
    private final Document document;
    private boolean validation;
    private EntityResolver entityResolver;
    private Properties properties;
    private XPath xpath;
    
    public XPathParser(InputStream inputStream, boolean validation, Properties properties, EntityResolver entityResolver) {
        commonConstructor(validation, properties, entityResolver);// 初始化 // [!code hl]
        document = createDocument(new InputSource(inputStream));// [!code hl]
    }
    
    private void commonConstructor(boolean validation, Properties properties, EntityResolver entityResolver) {
        this.validation = validation;
        this.entityResolver = entityResolver;
        this.properties = properties;
        XPathFactory factory = XPathFactory.newInstance();
        this.xpath = factory.newXPath();
    }

    private Document createDocument(InputSource inputSource) {
        try {
			//javax.xml.parsers.DocumentBuilderFactory
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setValidating(this.validation);
            factory.setNamespaceAware(false);
            factory.setIgnoringComments(true);
            factory.setIgnoringElementContentWhitespace(false);
            factory.setCoalescing(false);
            factory.setExpandEntityReferences(true);
            DocumentBuilder builder = factory.newDocumentBuilder();
            builder.setEntityResolver(this.entityResolver);// [!code hl]
            builder.setErrorHandler(new ErrorHandler() {
                public void error(SAXParseException exception) throws SAXException {
                    throw exception;
                }
                public void fatalError(SAXParseException exception) throws SAXException {
                    throw exception;
                }
                public void warning(SAXParseException exception) throws SAXException {
                }
            });
            return builder.parse(inputSource);
        } catch (Exception var4) {
            throw new BuilderException("Error creating document instance.  Cause: " + var4, var4);
        }
    }
    
    public XNode evalNode(String expression) {
        return evalNode(document, expression);
    }
    
    public XNode evalNode(Object root, String expression) {
        Node node = (Node)evaluate(expression, root, XPathConstants.NODE);// [!code hl]
        return node == null ? null : new XNode(this, node, variables);
    }

	private Object evaluate(String expression, Object root, QName returnType) {
        try {
            return xpath.evaluate(expression, root, returnType);//javax.xm.xpath.XPath 解析 // [!code hl]
        } catch (Exception var5) {
            throw new BuilderException("Error evaluating XPath.  Cause: " + var5, var5);
        }
    }
}  
```

### XMLMapperEntityResolver

```java
//Mybatis通过读取dtd文件来获取解析xml的规则
public class XMLMapperEntityResolver implements EntityResolver {
    private static final String IBATIS_CONFIG_SYSTEM = "ibatis-3-config.dtd";
    private static final String IBATIS_MAPPER_SYSTEM = "ibatis-3-mapper.dtd";
    private static final String MYBATIS_CONFIG_SYSTEM = "mybatis-3-config.dtd";
    private static final String MYBATIS_MAPPER_SYSTEM = "mybatis-3-mapper.dtd";
    private static final String MYBATIS_CONFIG_DTD = "org/apache/ibatis/builder/xml/mybatis-3-config.dtd";
    private static final String MYBATIS_MAPPER_DTD = "org/apache/ibatis/builder/xml/mybatis-3-mapper.dtd";

    public XMLMapperEntityResolver() {
    }

    public InputSource resolveEntity(String publicId, String systemId) throws SAXException {
        try {
            if (systemId != null) {
                String lowerCaseSystemId = systemId.toLowerCase(Locale.ENGLISH);
                if (lowerCaseSystemId.contains("mybatis-3-config.dtd") || lowerCaseSystemId.contains("ibatis-3-config.dtd")) {
                    return getInputSource("org/apache/ibatis/builder/xml/mybatis-3-config.dtd", publicId, systemId);
                }

                if (lowerCaseSystemId.contains("mybatis-3-mapper.dtd") || lowerCaseSystemId.contains("ibatis-3-mapper.dtd")) {
                    return getInputSource("org/apache/ibatis/builder/xml/mybatis-3-mapper.dtd", publicId, systemId);
                }
            }

            return null;
        } catch (Exception e) {
            throw new SAXException(e.toString());
        }
    }

    private InputSource getInputSource(String path, String publicId, String systemId) {
        InputSource source = null;
        if (path != null) {
            try {
                InputStream in = Resources.getResourceAsStream(path);
                source = new InputSource(in);
                source.setPublicId(publicId);
                source.setSystemId(systemId);
            } catch (IOException e) {
            }
        }
        return source;
    }
}   

```


