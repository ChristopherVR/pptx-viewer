import type { DefaultTheme } from 'vitepress';

export const sidebar: DefaultTheme.Sidebar = {
	'/zh/architecture/': [
		{
			text: '架构参考',
			items: [{ text: 'OpenXML 符合性', link: '/zh/architecture/openxml-conformance' }],
		},
	],
	'/zh/guide/': [
		{
			text: '开始使用',
			items: [
				{ text: '文档概览', link: '/zh/guide/' },
				{ text: '什么是 pptx-viewer', link: '/zh/guide/introduction' },
				{ text: '安装', link: '/zh/guide/installation' },
				{ text: '快速开始', link: '/zh/guide/quick-start' },
			],
		},
		{
			text: '基本概念',
			items: [
				{ text: '架构说明', link: '/zh/guide/architecture' },
				{ text: 'PptxData 数据模型', link: '/zh/guide/data-model' },
				{ text: '主题', link: '/zh/guide/theming' },
				{ text: '视口适配', link: '/zh/guide/viewport-fit' },
				{ text: '本地化（i18n）', link: '/zh/guide/localization' },
				{ text: '智能助手', link: '/zh/guide/ai-assistant' },
				{ text: '账户与登录', link: '/zh/guide/account' },
				{ text: '视觉效果还原', link: '/zh/guide/visual-effects' },
				{ text: '运行环境', link: '/zh/guide/runtime-environments' },
				{ text: '已知限制', link: '/zh/guide/limitations' },
				{ text: 'OpenXML 符合性', link: '/zh/architecture/openxml-conformance' },
			],
		},
	],

	'/zh/user/': [
		{
			text: '使用指南',
			items: [
				{ text: '概览', link: '/zh/user/' },
				{ text: '查看演示文稿', link: '/zh/user/viewing' },
				{ text: '编辑幻灯片', link: '/zh/user/editing' },
				{ text: '放映', link: '/zh/user/presenting' },
				{ text: '导出', link: '/zh/user/exporting' },
				{ text: '实时协作', link: '/zh/user/collaboration' },
				{ text: '键盘快捷键', link: '/zh/user/shortcuts' },
			],
		},
	],

	'/zh/core/': [
		{
			text: '核心引擎',
			items: [
				{ text: '概览', link: '/zh/core/' },
				{ text: '加载与解析', link: '/zh/core/loading' },
				{ text: '构建器 API', link: '/zh/core/builder' },
				{ text: '编程编辑', link: '/zh/core/editing' },
				{ text: '保存与往返处理', link: '/zh/core/saving' },
			],
		},
		{
			text: '转换与导出',
			items: [
				{ text: 'Markdown 转换器', link: '/zh/core/converter' },
				{ text: 'SVG 导出', link: '/zh/core/svg-export' },
			],
		},
		{
			text: '高级功能',
			items: [
				{ text: '加密', link: '/zh/core/encryption' },
				{ text: '几何引擎', link: '/zh/core/geometry' },
				{ text: '命令行工具', link: '/zh/core/cli' },
			],
		},
	],

	'/zh/react/': [
		{
			text: 'React 查看器',
			items: [
				{ text: '概览', link: '/zh/react/' },
				{ text: '快速上手', link: '/zh/react/getting-started' },
				{ text: '组件属性', link: '/zh/react/props' },
				{ text: '命令式句柄', link: '/zh/react/handle' },
			],
		},
		{
			text: '定制',
			items: [
				{ text: '主题', link: '/zh/react/theming' },
				{ text: 'Hook', link: '/zh/react/hooks' },
				{ text: '完整 Hook 参考', link: '/zh/react/hooks-reference' },
				{ text: '导出', link: '/zh/react/export' },
				{ text: '实时协作', link: '/zh/react/collaboration' },
			],
		},
	],

	'/zh/vue/': [
		{
			text: 'Vue 查看器',
			items: [
				{ text: '概览', link: '/zh/vue/' },
				{ text: '快速上手', link: '/zh/vue/getting-started' },
				{ text: '组件属性', link: '/zh/vue/props' },
				{ text: '命令式句柄', link: '/zh/vue/handle' },
			],
		},
		{
			text: '定制',
			items: [
				{ text: '主题', link: '/zh/vue/theming' },
				{ text: '组合式函数', link: '/zh/vue/composables' },
				{ text: '完整组合式函数参考', link: '/zh/vue/composables-reference' },
				{ text: '导出', link: '/zh/vue/export' },
				{ text: '实时协作', link: '/zh/vue/collaboration' },
			],
		},
	],

	'/zh/angular/': [
		{
			text: 'Angular 查看器',
			items: [
				{ text: '概览', link: '/zh/angular/' },
				{ text: '快速上手', link: '/zh/angular/getting-started' },
				{ text: '组件输入与输出', link: '/zh/angular/props' },
				{ text: '公开 API', link: '/zh/angular/api' },
			],
		},
		{
			text: '定制',
			items: [
				{ text: '主题', link: '/zh/angular/theming' },
				{ text: '服务', link: '/zh/angular/services' },
				{ text: '完整服务参考', link: '/zh/angular/services-reference' },
				{ text: '导出', link: '/zh/angular/export' },
				{ text: '实时协作', link: '/zh/angular/collaboration' },
			],
		},
	],

	'/zh/vanilla/': [
		{
			text: '原生 JavaScript 查看器',
			items: [
				{ text: '概览', link: '/zh/vanilla/' },
				{ text: '快速上手', link: '/zh/vanilla/getting-started' },
				{ text: '选项与回调', link: '/zh/vanilla/options' },
				{ text: '实例 API', link: '/zh/vanilla/api' },
			],
		},
		{
			text: '定制',
			items: [
				{ text: '主题', link: '/zh/vanilla/theming' },
				{ text: '元素渲染器', link: '/zh/vanilla/renderers' },
			],
		},
	],

	'/zh/svelte/': [
		{
			text: 'Svelte 查看器',
			items: [
				{ text: '概览', link: '/zh/svelte/' },
				{ text: '快速上手', link: '/zh/svelte/getting-started' },
				{ text: '组件属性', link: '/zh/svelte/props' },
				{ text: '实例 API', link: '/zh/svelte/api' },
			],
		},
		{
			text: '定制',
			items: [
				{ text: '主题', link: '/zh/svelte/theming' },
				{ text: '导出与打印', link: '/zh/svelte/export' },
				{ text: '实时协作', link: '/zh/svelte/collaboration' },
				{ text: '本地化', link: '/zh/svelte/i18n' },
			],
		},
	],

	'/zh/packages/': [
		{
			text: '配套工具',
			items: [{ text: 'MCP 与工具', link: '/zh/packages/mcp' }],
		},
	],

	'/zh/releases/': [
		{
			text: '版本记录',
			items: [
				{ text: '概览', link: '/zh/releases/' },
				{ text: 'pptx-viewer-core', link: '/releases/core' },
				{ text: 'pptx-react-viewer', link: '/releases/react' },
				{ text: 'pptx-vue-viewer', link: '/releases/vue' },
				{ text: 'pptx-angular-viewer', link: '/releases/angular' },
				{ text: 'pptx-vanilla-viewer', link: '/releases/vanilla' },
				{ text: 'pptx-svelte-viewer', link: '/releases/svelte' },
				{ text: 'pptx-viewer-mcp', link: '/releases/mcp' },
				{ text: '@christophervr/pptx-viewer (CLI)', link: '/releases/cli' },
			],
		},
	],
};
