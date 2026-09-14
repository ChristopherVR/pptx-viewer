import type { LandingCopy } from './types';

export const zh: LandingCopy = {
	hero: {
		kicker: '开源 · Apache-2.0 · TypeScript',
		titleTop: '.pptx 编辑',
		titleAccent: '轻松融入应用',
		sub: '开源 PowerPoint 预览与所见即所得编辑器，支持 React、Vue 3、Angular、Svelte 5 和原生 JavaScript。TypeScript 核心引擎可独立加载、编辑和保存 .pptx 文件，各框架组件通过 HTML、CSS 和 SVG 实时呈现幻灯片。',
		start: { text: '开始使用', href: '/zh/guide/' },
		demo: '在线演示',
		scroll: '向下探索',
		frameCaption: 'sample-deck.pptx · 在浏览器中实时体验',
		frameTry: '试一试',
		frameAlt: '使用 pptx-viewer 编辑演示文稿：切换幻灯片、拖动元素和显示图表',
		copyLabel: '复制',
		copiedLabel: '已复制',
	},
	features: {
		kicker: '功能亮点',
		title: '从预览到编辑，一应俱全',
		items: [
			{
				title: '高保真渲染',
				copy: '支持 187 种以上预设形状、23 种图表、SmartArt、动画、平滑切换、嵌入字体、EMF 和 WMF 图元文件以及 3D 模型，均通过 HTML、CSS 和 SVG 绘制。文字仍可选中，也能被屏幕阅读器读取。',
				link: { text: '了解渲染机制', href: '/zh/guide/architecture' },
			},
			{
				title: '所见即所得编辑',
				copy: '通过功能区、属性面板和画布直接编辑文字、形状、表格、图表及 SmartArt，并支持完整的撤销历史。母版和版式中的元素也可以编辑。',
				link: { text: '了解编辑功能', href: '/zh/react/getting-started' },
			},
			{
				title: '编辑后保存为 PPTX',
				copy: '加载后得到涵盖 16 种元素的完整类型化数据模型。保存时生成有效的 OpenXML，保留主题、母版、版式及 OOXML Strict 格式支持，让编辑后的文件可在 PowerPoint 中重新打开。',
				link: { text: '加载与保存', href: '/zh/core/loading' },
			},
			{
				title: '实时协作',
				copy: '基于 Yjs CRDT 共同编辑，支持在线状态、字符级文本合并和点对点传输。信令连接由 y-webrtc 提供。',
				link: { text: '了解协作功能', href: '/zh/react/collaboration' },
			},
			{
				title: '多格式导出',
				copy: '直接在浏览器中导出 PNG、JPEG、SVG、PDF、GIF 和视频。SVG 还可在 Node.js 中导出，无需浏览器或 DOM。',
				link: { text: '了解导出功能', href: '/zh/react/export' },
			},
			{
				title: '文件加密',
				copy: '支持使用 AES-128 和 AES-256 敏捷加密打开和保存受密码保护的文件。',
				link: { text: '了解加密功能', href: '/zh/core/encryption' },
			},
			{
				title: '生成与转换',
				copy: '通过链式构建 API 编程生成演示文稿，或将文件转换为清晰的 Markdown 和保留元素位置的 HTML，同时提取媒体资源和演讲者备注。',
				link: { text: '构建器 API', href: '/zh/core/builder' },
			},
			{
				title: '国际化',
				copy: '界面文案通过 1,600 多个 pptx.* 翻译键提供，可接入应用现有的国际化库，如 react-i18next、vue-i18n 或 ngx-translate。',
				link: { text: '了解国际化支持', href: '/zh/guide/localization' },
			},
		],
	},
	agents: {
		kicker: '自动化',
		title: '让智能体也能编辑 .pptx',
		copy: 'pptx-viewer-mcp 通过模型上下文协议提供 73 个带有 Zod 数据结构定义的 PPTX 工具，让 Claude、Cursor 和 Copilot 直接读取、编辑和转换演示文稿。这些函数也能在 Node、Bun 或无服务器环境中独立运行，命令行工具则适合处理单次转换。',
		link: { text: 'MCP 与工具', href: '/zh/packages/mcp' },
	},
	quickstart: {
		kicker: '快速开始',
		title: '几行代码，即可呈现幻灯片',
		copy: '安装对应框架的组件包，传入 .pptx 文件的字节数据，并设置容器高度。通过组件属性即可启用编辑、放映、协作和导出。',
		docsLabel: '完整指南',
	},
	demos: {
		kicker: '在线演示',
		title: '现在就试一试',
		copy: '这里嵌入的是在浏览器中真实运行的编辑器演示，使用的正是 npm 上发布的组件。切换框架体验不同版本，或开启分屏，观察两个独立应用如何共同编辑一份演示文稿。',
		frameworkLabel: '选择框架',
		soloTab: '编辑器',
		collabTab: '协作演示',
		guestPicker: '参与者框架',
		load: '加载在线演示',
		loading: '正在加载编辑器',
		openFull: '打开完整应用',
		hostLabel: '发起者',
		guestLabel: '参与者',
		soloHint:
			'解析、渲染、编辑和保存都在当前浏览器标签页中完成，文件无需上传。打开完整应用，即可导入自己的演示文稿。',
		collabHint:
			'两个独立应用通过点对点 Yjs CRDT 会话共享一份演示文稿，并使用 y-webrtc 进行信令连接。在任意一侧拖动形状或编辑文字，另一侧都会同步更新，不同框架之间也能协作。',
	},
	faq: {
		kicker: '常见问题',
		title: '你可能想了解这些',
		items: [
			{
				q: '可以免费用于商业项目吗？',
				a: '可以。核心引擎、五个框架组件包、MCP 服务器和演示应用均采用 Apache-2.0 许可证，没有付费版本。',
			},
			{
				q: '编辑后的文件能在 PowerPoint 中重新打开吗？',
				a: '可以。保存时会生成有效的 OpenXML，保留主题、母版、版式及 OOXML Strict 格式支持，加载、编辑并保存后的演示文稿可以在 PowerPoint 中重新打开。',
			},
			{
				q: '需要部署服务器吗？',
				a: '解析、渲染、编辑和保存都在浏览器中完成，无需服务器。核心引擎也能在 Node.js 和 Bun 中运行，用于服务端或命令行任务。',
			},
			{
				q: '幻灯片是如何渲染的？',
				a: '使用实时的 HTML、CSS 和 SVG 渲染。文字可以选中，缩放后依然清晰，并支持屏幕阅读器。',
			},
			{
				q: '实时协作需要额外的基础设施吗？',
				a: '内置的点对点传输依赖 y-webrtc 信令服务。如果需要持久化存储、身份验证或受控网络连接，可以接入 y-websocket 中继等协作服务。',
				link: { text: '了解协作功能', href: '/zh/react/collaboration' },
			},
			{
				q: '能打开受密码保护的文件吗？',
				a: '可以。打开和保存文件均支持 AES-128 和 AES-256 敏捷加密。',
			},
			{
				q: '支持哪些框架？',
				a: '支持 React 18/19、Vue 3、Angular、Svelte 5，以及无需框架的原生 JavaScript 版本。各版本共享核心引擎和与框架无关的渲染逻辑，并提供各自的视图层。',
			},
			{
				q: '有哪些功能限制？',
				a: '可以替换 OLE 内容，也能编辑受支持的嵌入表格、文档和嵌套演示文稿标题。部分视觉效果采用近似呈现，具体支持范围请查看功能限制文档。',
				link: { text: '功能限制', href: '/zh/guide/limitations' },
			},
		],
	},
	finale: {
		kicker: '开始使用',
		title: '从打开 .pptx，到保存 .pptx',
		sub: '只需一个依赖，就能为应用加入 PowerPoint 支持。采用 Apache-2.0 许可证、严格的 TypeScript 类型检查，无需原生依赖。先用自己的演示文稿体验演示，再按快速开始指南完成接入。',
		quick: { text: '快速开始', href: '/zh/guide/quick-start' },
		github: '在 GitHub 上查看',
		columns: [
			{
				title: '产品',
				links: [
					{
						text: '在线演示',
						href: 'https://christophervr.github.io/pptx-viewer/demo/',
						external: true,
					},
					{ text: '核心引擎', href: '/zh/core/' },
					{ text: 'MCP 服务器', href: '/zh/packages/mcp' },
					{ text: '版本发布', href: '/zh/releases/' },
				],
			},
			{
				title: '文档',
				links: [
					{ text: '项目介绍', href: '/zh/guide/introduction' },
					{ text: '快速开始', href: '/zh/guide/quick-start' },
					{ text: '架构说明', href: '/zh/guide/architecture' },
					{ text: '功能限制', href: '/zh/guide/limitations' },
				],
			},
			{
				title: '社区',
				links: [
					{ text: 'GitHub', href: 'https://github.com/ChristopherVR/pptx-viewer', external: true },
					{
						text: 'npm',
						href: 'https://www.npmjs.com/package/pptx-react-viewer',
						external: true,
					},
					{
						text: '问题反馈',
						href: 'https://github.com/ChristopherVR/pptx-viewer/issues',
						external: true,
					},
					{
						text: '许可证',
						href: 'https://github.com/ChristopherVR/pptx-viewer/blob/main/LICENSE',
						external: true,
					},
				],
			},
		],
		bottomLeft: '© 2026 Christopher van Rooyen · Apache-2.0',
		bottomRight: 'pptx-viewer · 面向 Web 的 PowerPoint 引擎',
	},
};
