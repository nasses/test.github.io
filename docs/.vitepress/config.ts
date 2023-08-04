import { defineConfig } from 'vitepress'

export default defineConfig({
  base: "/test.github.io/",
  title: "MyBatis源码分析",
  description: "一个持久层框架",
  themeConfig: {
	outlineTitle: '小节',
	outline: 'deep',
	
	search: {
      provider: 'local',
      options: {
        appId: '...',
        apiKey: '...',
        indexName: '...',
        locales: {
          root: {
            placeholder: '搜索文档',
            translations: {
              button: {
                buttonText: '搜索文档',
                buttonAriaLabel: '搜索文档'
              },
              modal: {
                searchBox: {
                  resetButtonTitle: '清除查询条件',
                  resetButtonAriaLabel: '清除查询条件',
                  cancelButtonText: '取消',
                  cancelButtonAriaLabel: '取消'
                },
                startScreen: {
                  recentSearchesTitle: '搜索历史',
                  noRecentSearchesText: '没有搜索历史',
                  saveRecentSearchButtonTitle: '保存至搜索历史',
                  removeRecentSearchButtonTitle: '从搜索历史中移除',
                  favoriteSearchesTitle: '收藏',
                  removeFavoriteSearchButtonTitle: '从收藏中移除'
                },
                errorScreen: {
                  titleText: '无法获取结果',
                  helpText: '你可能需要检查你的网络连接'
                },
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                  closeText: '关闭',
                  searchByText: '搜索提供者'
                },
                noResultsScreen: {
                  noResultsText: '无法找到相关结果',
                  suggestedQueryText: '你可以尝试查询',
                  reportMissingResultsText: '你认为该查询应该有结果？',
                  reportMissingResultsLinkText: '点击反馈'
                }
              }
            }
          }
        }
      }
    },
	
    nav: [
      { text: '首页', link: '/' },
      { text: '帮助', link: '/markdown-examples' }
    ],
	
    sidebar: [
      {
        text: '引言',
        items: [
          { text: '介绍', link: '/introduction'}
        ]
      },
	  {
		text: '1.配置文件解析',
		collapsed : true,
		items: [
		  { text: '读取文件', link: '/1/read'},
		  { text: 'xml', link: '/1/xml'},
		  { text: 'properties', link: '/1/properties'},
		  { text: 'settings', link:'/1/settings'},
		  { text: 'typeAliases',link:'/1/typealiases'},
		  { text: 'plugs', link: '/1/plugs'},
		  { text: 'objectFactory',link:'/1/objectfactory'},
		  { text: '💥💥reflectorFactory',link:'/1/reflectorfactory'},
		  { text: 'environments', link: '/1/environments'},
		  { text: '事务', link: '/1/transaction'},
		  { text: 'typeHandlers', link: ''},
		  { text: 'ojectFactory', link: ''},
		  { text: 'databaseIdProvider', link: ''},
		]  
	  },
	  {
		 text: '2.映射器',
		 items: [
		  { text: '解析mappers节点', collapsed : true, items:[
				{ text: 'MetaObject', link: ''}
			]},
		  { text: '解析cache节点', link: ''},
		  { text: '解析cache-ref节点', link: ''},
		  { text: '解析parameterMap节点', link: ''},
		  { text: '解析resultMap节点', collapsed : true, items:[
				{ text: 'association', link: ''},
				{ text: 'constructor', link: ''},
				{ text: 'discriminator', link: ''},
				{ text: 'extend', link: ''},
				{ text: 'ResultMapping', link: ''},
				{ text: 'ResultMapp', link: ''},
			]},
		  { text: '解析sql节点', link: ''},
		  { text: '解析select|insert|update|delete节点', collapsed : true, items:[
				{ text: '解析include节点', link: ''},
				{ text: 'LanguageDriver', link: ''},
				{ text: 'selectKey', link: ''},
				{ text: 'XMLLanguageDriver -> XMLScriptBuilder', link: ''},
				{ text: 'SqlNode & SqlSource & BoundSql', link: ''},
				{ text: 'SqlSourceBuilder', link: ''},
				{ text: 'MappedStatement', link: ''},
			]},
		  { text: '解析失败的重试', link: ''},
		] 
	  },
	  {
		 text: '3.Sql执行流程',
		 items: [
		  { text: '构建sqlSession', link: ''},
		  { text: '获取Mapper', link: ''},
		  { text: '方法执行时使用代理', link: ''},
		  { text: '执行execute', link: ''},
		  { text: '查询sql执行流程', collapsed : true, items:[
				{ text: 'BaseExecutor', link: ''},
				{ text: 'SimpleExecutor', link: ''},
				{ text: 'DefaultResultSetHandler', link: ''},
				{ text: '懒加载', link: ''},
			]},
		  { text: '更新sql执行流程', collapsed : true, items:[
				{ text: 'KeyGenerator', link: ''},
				{ text: '处理更新结果', link: ''}
			]}
		] 
	  },
	  {
		 text: '4.内置数据源',
		 items: [
		  { text: '配置解析', link: ''},
		  { text: '执行流程', link: ''},
		  { text: 'UnpooledDataSource', link: ''},
		  { text: 'PooledDataSource', link: ''}
		] 
	  },
	  {
		 text: '5.缓存机制',
		 items: [
		  { text: '缓存类', link: ''},
		  { text: 'CacheKey', link: ''},
		  { text: '一级缓存', link: ''},
		  { text: '二级缓存', link: ''}
		] 
	  },
	  {
		 text: '6.插件机制',
		 items: [
		  { text: '实现一个分页插件', link: ''}
		] 
	  },
	  {
		 text: '7.Sping对mybatis的支持',
		 items: [
		  { text: '配置sqlSessionFactory', link: ''},
		  { text: '配置sqlSessionTemplate', link: ''},
		  { text: '配置Mapper', link: ''},
		  { text: '配置事务', link: ''}
		] 
	  }
    ],
	
    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ]
  
  },
})
