import DefaultTheme from 'vitepress/theme'
import MyLayout from './Layout.vue'
import './style.css'

export default {
    ...DefaultTheme,
    // override the Layout with a wrapper component that
    // injects the slots
    Layout: MyLayout,
	enhanceApp({ app, router, siteData }) {
    // ...
  }
}