import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: "/test.github.io/",
  title: "MyBatis源码分析",
  description: "一个持久层框架",
  themeConfig: {
	search: {
      provider: 'local'
    },
    nav: [
      { text: '首页', link: '/' },
      { text: '帮助', link: '/markdown-examples' }
    ],

    sidebar: [
      {
        text: '引言',
        items: [
          { text: 'Markdown Examples', link: '/markdown-examples' },
          { text: 'Runtime API Examples', link: '/api-examples' }
        ]
      },
	  {
		text: '1.配置文件解析',
		items: [
		  { text: '读取文件', items:[
				{ text: 'Resources', link: ''},
				{ text: 'ClassLoaderWrapper', link: ''},
				{ text: 'SqlSessionFactoryBuilder', link: ''},
			]},
		  { text: '解析xml', items:[
				{ text: 'XMLConfigBuilder', link: ''},
				{ text: 'XMLMapperEntityResolver', link: ''},
				{ text: 'XPathParser', link: ''},
			]},
		  { text: '解析properties节点', link: ''},
		  { text: '解析settings节点', items:[
				{ text: 'MetaClass', link: ''},
				{ text: 'ReflectorFactory', link: ''},
				{ text: 'Reflector', link: ''},
			]},
		  { text: '解析typeAliases节点', items:[
				{ text: 'TypeAliasRegistry', link: ''},
				{ text: 'ResolverUtil', link: ''},
				{ text: 'BaseBuilder', link: ''},
				{ text: 'Configuration', link: ''},
			]},
		  { text: '解析plugs节点', link: ''},
		  { text: '解析environments节点', link: ''},
		  { text: '解析typeHandlers节点', link: ''},
		  { text: '解析objectFactory节点', link: ''},
		  { text: '解析databaseIdProvider节点', link: ''},
		]  
	  },
	  {
		 text: '2.映射器',
		 items: [
		  { text: '解析mappers节点', link: ''},
		  { text: '解析cache节点', link: ''},
		  { text: '解析cache-ref节点', link: ''},
		  { text: '解析parameterMap节点', link: ''},
		  { text: '解析resultMap节点', link: ''},
		  { text: '解析plugs节点', link: ''},
		  { text: '解析typeHandlers节点', link: ''},
		  { text: '解析objectFactory节点', link: ''},
		  { text: '解析databaseIdProvider节点', link: ''},
		] 
		  
		  
	  }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ]
  }
})
