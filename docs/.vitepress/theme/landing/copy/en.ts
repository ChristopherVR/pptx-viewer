import type { LandingCopy } from './types';

export const en: LandingCopy = {
	hero: {
		kicker: 'Open source · Apache-2.0 · TypeScript',
		titleTop: '.pptx editing,',
		titleAccent: 'made embeddable.',
		sub: 'Open-source PowerPoint viewer and WYSIWYG editor for React, Vue 3, Angular, Svelte 5, and vanilla JavaScript. A headless TypeScript core loads, edits, and saves .pptx files; the components render them as live HTML, CSS, and SVG.',
		start: { text: 'Get started', href: '/guide/' },
		demo: 'Live demo',
		scroll: 'Scroll',
		frameCaption: 'sample-deck.pptx · live in the browser',
		frameTry: 'Try it',
		copyLabel: 'Copy',
		copiedLabel: 'Copied',
	},
	features: {
		kicker: 'Features',
		title: 'What you get.',
		items: [
			{
				title: 'Full-fidelity rendering',
				copy: '187+ preset shapes, 23 chart types, SmartArt, animations, morph transitions, embedded fonts, EMF and WMF metafiles, and 3D models, all drawn as HTML, CSS, and SVG. Text stays selectable and screen readers keep working.',
				link: { text: 'Rendering', href: '/guide/architecture' },
			},
			{
				title: 'WYSIWYG editing',
				copy: 'A ribbon, inspector panels, and on-canvas manipulation for text, shapes, tables, charts, and SmartArt, with full undo history. Master and layout elements are editable too.',
				link: { text: 'Editing', href: '/react/getting-started' },
			},
			{
				title: 'Round-trip save',
				copy: 'Loading produces a fully-typed data model with sixteen element types. Saving writes valid OpenXML with themes, masters, layouts, and OOXML Strict conformance intact, so edited decks reopen cleanly in PowerPoint.',
				link: { text: 'Load and save', href: '/core/loading' },
			},
			{
				title: 'Real-time collaboration',
				copy: 'Co-edit through a Yjs CRDT with presence tracking, character-level text merging, and a peer-to-peer transport that needs no server.',
				link: { text: 'Collaboration', href: '/react/collaboration' },
			},
			{
				title: 'Export',
				copy: 'PNG, JPEG, SVG, PDF, GIF, and video straight from the browser. SVG export also runs headlessly in Node.js with no DOM.',
				link: { text: 'Export', href: '/react/export' },
			},
			{
				title: 'Encryption',
				copy: 'Open and save password-protected files with AES-128 and AES-256 agile encryption.',
				link: { text: 'Encryption', href: '/core/encryption' },
			},
			{
				title: 'Build and convert',
				copy: 'Create decks programmatically with the fluent builder, or convert them to clean Markdown or positioned HTML with media extraction and speaker notes.',
				link: { text: 'Builder API', href: '/core/builder' },
			},
			{
				title: 'Localization',
				copy: 'Every UI label resolves through one of 1,600+ pptx.* translation keys, wired to the i18n library your app already uses: react-i18next, vue-i18n, or ngx-translate.',
				link: { text: 'Localization', href: '/guide/localization' },
			},
		],
	},
	agents: {
		kicker: 'Automation',
		title: '.pptx, edited by agents.',
		copy: 'pptx-viewer-mcp exposes 50+ PPTX tools with Zod schemas over the Model Context Protocol, so Claude, Cursor, and Copilot can read, edit, and convert presentations directly. The same functions run headlessly in Node, Bun, or serverless runtimes, and a CLI covers one-off conversions.',
		link: { text: 'MCP and tools', href: '/packages/mcp' },
	},
	quickstart: {
		kicker: 'Quickstart',
		title: 'Render a deck in fifteen lines.',
		copy: 'Install the package for your framework, pass the raw .pptx bytes, and give the container a height. Editing, presenting, collaboration, and export are props away.',
		docsLabel: 'Full guide',
	},
	demos: {
		kicker: 'Demos',
		title: 'See it running.',
		copy: 'Every binding ships a complete demo app, deployed from this repository alongside the docs. Open one and drop in a deck of your own.',
		open: 'Open',
		cards: [
			{
				name: 'pptx-react-viewer',
				desc: 'The complete editor in React 19: ribbon, inspector, collaboration, export.',
				href: 'https://christophervr.github.io/pptx-viewer/demo/',
				external: true,
			},
			{
				name: 'pptx-vue-viewer',
				desc: 'The same feature set in Vue 3, driven by props and events.',
				href: 'https://christophervr.github.io/pptx-viewer/demo-vue/',
				external: true,
			},
			{
				name: 'pptx-angular-viewer',
				desc: 'A standalone Angular component with signal-based inputs.',
				href: 'https://christophervr.github.io/pptx-viewer/demo-angular/',
				external: true,
			},
			{
				name: 'pptx-svelte-viewer',
				desc: 'The same editor built as a Svelte 5 component.',
				href: 'https://christophervr.github.io/pptx-viewer/demo-svelte/',
				external: true,
			},
			{
				name: 'pptx-vanilla-viewer',
				desc: 'Zero framework: one function call mounts the whole viewer.',
				href: 'https://christophervr.github.io/pptx-viewer/demo-vanilla/',
				external: true,
			},
			{
				name: 'pptx-viewer-core',
				desc: 'No UI at all. Parse, edit, convert, and save in Node, Bun, or the browser.',
				href: '/core/',
			},
		],
	},
	faq: {
		kicker: 'FAQ',
		title: 'Common questions.',
		items: [
			{
				q: 'Is it free to use commercially?',
				a: 'Yes. Everything is Apache-2.0 licensed: the core, all five UI packages, the MCP server, and the demos. There is no paid tier.',
			},
			{
				q: 'Do edited files reopen in PowerPoint?',
				a: 'Yes. Saving writes valid OpenXML with themes, masters, layouts, and OOXML Strict conformance preserved, so a deck loaded, edited, and saved here reopens cleanly in PowerPoint.',
			},
			{
				q: 'Does it need a server?',
				a: 'No. Parsing, rendering, editing, and saving all happen in the browser. The core also runs in Node.js and Bun for server-side or CLI work.',
			},
			{
				q: 'How are slides rendered?',
				a: 'As live HTML, CSS, and SVG rather than a canvas bitmap. Text stays selectable, zoom stays sharp, and screen readers work.',
			},
			{
				q: 'Does collaboration need infrastructure?',
				a: 'Not by default. The bundled transport is peer-to-peer (y-webrtc), which works from static hosting. For persistence and authentication you can point it at a y-websocket relay instead.',
				link: { text: 'Collaboration', href: '/react/collaboration' },
			},
			{
				q: 'Can it open password-protected files?',
				a: 'Yes. AES-128 and AES-256 agile encryption are supported for both opening and saving.',
			},
			{
				q: 'Which frameworks are supported?',
				a: 'React 19, Vue 3, Angular, Svelte 5, and a zero-framework vanilla build. Each package bundles the same core engine, so rendering is identical everywhere.',
			},
			{
				q: 'What are the limitations?',
				a: 'OLE objects are read-only and a few visual effects are approximated on screen. The limitations page lists exactly what to expect.',
				link: { text: 'Limitations', href: '/guide/limitations' },
			},
		],
	},
	finale: {
		kicker: 'Get started',
		title: '.pptx in. .pptx out.',
		sub: 'Add PowerPoint support to your app with one dependency. Apache-2.0 licensed, strict TypeScript, no native dependencies. Try the demo with one of your own decks, then follow the quick start.',
		quick: { text: 'Quick start', href: '/guide/quick-start' },
		github: 'View on GitHub',
		columns: [
			{
				title: 'Product',
				links: [
					{
						text: 'Live demo',
						href: 'https://christophervr.github.io/pptx-viewer/demo/',
						external: true,
					},
					{ text: 'Core engine', href: '/core/' },
					{ text: 'MCP server', href: '/packages/mcp' },
					{ text: 'Releases', href: '/releases/' },
				],
			},
			{
				title: 'Docs',
				links: [
					{ text: 'Introduction', href: '/guide/introduction' },
					{ text: 'Quick start', href: '/guide/quick-start' },
					{ text: 'Architecture', href: '/guide/architecture' },
					{ text: 'Limitations', href: '/guide/limitations' },
				],
			},
			{
				title: 'Community',
				links: [
					{ text: 'GitHub', href: 'https://github.com/ChristopherVR/pptx-viewer', external: true },
					{
						text: 'npm',
						href: 'https://www.npmjs.com/package/pptx-react-viewer',
						external: true,
					},
					{
						text: 'Issues',
						href: 'https://github.com/ChristopherVR/pptx-viewer/issues',
						external: true,
					},
					{
						text: 'License',
						href: 'https://github.com/ChristopherVR/pptx-viewer/blob/main/LICENSE',
						external: true,
					},
				],
			},
		],
		bottomLeft: '© 2026 Christopher van Rooyen · Apache-2.0',
		bottomRight: 'pptx-viewer · the PowerPoint engine for the web',
	},
};
