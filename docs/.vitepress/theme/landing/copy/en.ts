import type { LandingCopy } from './types';

export const en: LandingCopy = {
	hero: {
		kicker: 'Open source · Apache-2.0 · TypeScript',
		titleTop: 'The PowerPoint engine',
		titleAccent: 'for the web.',
		sub: 'Load, render, edit, and save .pptx files in the browser or Node.js. Comes as a headless TypeScript core and drop-in components for React, Vue 3, Angular, Svelte 5, and vanilla JavaScript.',
		start: { text: 'Get started', href: '/guide/introduction' },
		demo: 'Open the live demo',
		scroll: 'Scroll',
		frameCaption: 'sample-deck.pptx · live in the browser',
		frameTry: 'Try it',
	},
	statement: {
		kicker: 'Rendering',
		line1: 'Slides render as live HTML, CSS, and SVG.',
		line2Pre: 'Text stays ',
		line2Em: 'selectable',
		line2Post: ', zoom stays sharp,',
		line3: 'and saved files reopen cleanly in PowerPoint.',
	},
	panels: [
		{
			kicker: 'Rendering',
			title: 'Covers the full OpenXML feature surface.',
			copy: '187+ preset shapes, 23 chart types, SmartArt, animations, morph transitions, EMF and WMF metafiles, embedded fonts, and 3D models are all drawn with HTML, CSS, and SVG. There is no canvas rasterization, so text stays selectable and screen readers keep working.',
			link: { text: 'How rendering works', href: '/guide/architecture' },
		},
		{
			kicker: 'Data model',
			title: 'Load it, change it, save it back.',
			copy: 'Loading a .pptx file produces a fully-typed PptxData model with sixteen element types. Themes, masters, layouts, and OOXML Strict conformance survive the round trip, so an edited deck reopens cleanly in PowerPoint.',
			link: { text: 'Loading and parsing', href: '/core/loading' },
		},
		{
			kicker: 'Frameworks',
			title: 'One engine. Every framework, or none.',
			copy: 'The viewer ships as a drop-in component for React, Vue 3, Angular, and Svelte 5, plus a zero-framework vanilla JavaScript build for everything else. Each package bundles the core engine, so one dependency gets you the same rendering everywhere: presenter mode, editing, and export included.',
			link: { text: 'Choose a framework', href: '/guide/installation' },
		},
		{
			kicker: 'Automation',
			title: 'Use it headless, from the CLI, or over MCP.',
			copy: 'pptx-viewer-mcp exposes 50+ PPTX tools with Zod schemas as an MCP server, so Claude, Cursor, and Copilot can read, edit, and convert presentations directly. The same functions can be called from your own code in Node, Bun, or serverless runtimes.',
			link: { text: 'MCP and tools', href: '/packages/mcp' },
		},
	],
	bento: {
		kicker: 'Also included',
		tiles: [
			{
				title: 'Real-time collaboration',
				copy: 'Co-edit through a Yjs CRDT with presence tracking, character-level text merging, and a P2P transport that needs no server.',
				href: '/react/collaboration',
			},
			{
				title: 'Encryption',
				copy: 'Open and save password-protected files with AES-128 and AES-256 agile encryption.',
				href: '/core/encryption',
			},
			{
				title: 'Export',
				copy: 'PNG, JPEG, SVG, PDF, GIF, and video from the browser. SVG export also runs headlessly in Node.js with no DOM.',
				href: '/react/export',
			},
			{
				title: 'Markdown conversion',
				copy: 'Turn decks into clean Markdown or positioned HTML, with media extraction, speaker notes, and metadata.',
				href: '/core/converter',
			},
			{
				title: 'Builder API',
				copy: 'Create presentations programmatically: text, shapes, images, tables, and charts without touching raw OpenXML.',
				href: '/core/builder',
			},
			{
				title: 'Limitations',
				copy: 'OLE objects are read-only and some visual effects are approximated on screen. The limitations page lists exactly what to expect.',
				href: '/guide/limitations',
			},
			{
				title: 'Localization',
				copy: 'Every UI label resolves through a pptx.* translation key (1,600+ of them), wired to the i18n library your app already uses: react-i18next, vue-i18n, or ngx-translate. An English dictionary ships with each package, and these docs are available in English, French, Spanish, and German.',
				href: '/guide/localization',
				wide: true,
			},
		],
	},
	stack: {
		kicker: 'Choose your stack',
		title: 'Install one package.',
		copyPre:
			'Every UI package bundles the core engine, so a single dependency is enough. Not sure which one fits? ',
		copyCode: 'npx @christophervr/pptx-viewer',
		copyPost: ' walks you through it.',
		packages: [
			{
				name: 'pptx-react-viewer',
				desc: 'Viewer + WYSIWYG editor for React 19',
				href: '/react/getting-started',
				external: false,
			},
			{
				name: 'pptx-vue-viewer',
				desc: 'The same feature set for Vue 3',
				href: 'https://www.npmjs.com/package/pptx-vue-viewer',
				external: true,
			},
			{
				name: 'pptx-angular-viewer',
				desc: 'The same feature set for Angular',
				href: 'https://www.npmjs.com/package/pptx-angular-viewer',
				external: true,
			},
			{
				name: 'pptx-vanilla-viewer',
				desc: 'The same engine, zero framework, plain DOM',
				href: '/vanilla/',
				external: false,
			},
			{
				name: 'pptx-svelte-viewer',
				desc: 'The same feature set for Svelte 5',
				href: '/svelte/',
				external: false,
			},
			{
				name: 'pptx-viewer-core',
				desc: 'Headless engine: parse, edit, convert, encrypt',
				href: '/core/',
				external: false,
			},
			{
				name: 'pptx-viewer-mcp',
				desc: '50+ MCP tools, CLI, collaboration codec',
				href: '/packages/mcp',
				external: false,
			},
		],
	},
	finale: {
		kicker: 'Get started',
		title: 'Add PowerPoint support to your app.',
		sub: 'Apache-2.0 licensed, strict TypeScript, no native dependencies. Try the demo with one of your own decks, then follow the quick start.',
		quick: { text: 'Quick start', href: '/guide/quick-start' },
		github: 'View on GitHub',
		footLeft: 'pptx-viewer · the PowerPoint engine for the web',
		footRight: 'Apache-2.0 · TypeScript strict · no native dependencies',
	},
};
