import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
	title: 'pptx-viewer',
	description:
		'Parse, edit, render, and convert Microsoft PowerPoint (.pptx) files in the browser and Node.js - a TypeScript SDK with React, Vue 3, and Angular viewer components.',
	lang: 'en-US',

	// Deployed to https://christophervr.github.io/pptx-viewer/
	base: '/pptx-viewer/',

	lastUpdated: true,
	cleanUrls: true,
	ignoreDeadLinks: true,

	locales: {
		root: {
			label: 'English',
			lang: 'en-US',
		},
		fr: {
			label: 'Français',
			lang: 'fr-FR',
			link: '/fr/',
			themeConfig: {
				nav: [
					{ text: 'Guide', link: '/fr/guide/introduction', activeMatch: '/fr/guide/' },
					{ text: 'Guide utilisateur', link: '/user/', activeMatch: '/user/' },
					{
						text: 'Packages',
						items: [
							{ text: 'Core (pptx-viewer-core)', link: '/core/' },
							{ text: 'React (pptx-react-viewer)', link: '/react/' },
							{
								text: 'Vue 3 (pptx-vue-viewer)',
								link: 'https://www.npmjs.com/package/pptx-vue-viewer',
							},
							{
								text: 'Angular (pptx-angular-viewer)',
								link: 'https://www.npmjs.com/package/pptx-angular-viewer',
							},
							{ text: 'MCP et outils', link: '/packages/mcp' },
						],
					},
					{ text: 'Contribuer', link: '/contributing/development', activeMatch: '/contributing/' },
					{ text: 'Versions', link: '/releases/', activeMatch: '/releases/' },
					{
						text: 'Ressources',
						items: [
							{ text: 'Notes de version', link: '/releases/' },
							{
								text: 'npm: pptx-viewer-core',
								link: 'https://www.npmjs.com/package/pptx-viewer-core',
							},
							{
								text: 'npm: pptx-react-viewer',
								link: 'https://www.npmjs.com/package/pptx-react-viewer',
							},
							{
								text: 'npm: pptx-vue-viewer',
								link: 'https://www.npmjs.com/package/pptx-vue-viewer',
							},
						],
					},
				],
			},
		},
		es: {
			label: 'Español',
			lang: 'es-ES',
			link: '/es/',
			themeConfig: {
				nav: [
					{ text: 'Guia', link: '/es/guide/introduction', activeMatch: '/es/guide/' },
					{ text: 'Guia de usuario', link: '/user/', activeMatch: '/user/' },
					{
						text: 'Paquetes',
						items: [
							{ text: 'Core (pptx-viewer-core)', link: '/core/' },
							{ text: 'React (pptx-react-viewer)', link: '/react/' },
							{
								text: 'Vue 3 (pptx-vue-viewer)',
								link: 'https://www.npmjs.com/package/pptx-vue-viewer',
							},
							{
								text: 'Angular (pptx-angular-viewer)',
								link: 'https://www.npmjs.com/package/pptx-angular-viewer',
							},
							{ text: 'MCP y herramientas', link: '/packages/mcp' },
						],
					},
					{ text: 'Contribuir', link: '/contributing/development', activeMatch: '/contributing/' },
					{ text: 'Versiones', link: '/releases/', activeMatch: '/releases/' },
					{
						text: 'Recursos',
						items: [
							{ text: 'Notas de version', link: '/releases/' },
							{
								text: 'npm: pptx-viewer-core',
								link: 'https://www.npmjs.com/package/pptx-viewer-core',
							},
							{
								text: 'npm: pptx-react-viewer',
								link: 'https://www.npmjs.com/package/pptx-react-viewer',
							},
							{
								text: 'npm: pptx-vue-viewer',
								link: 'https://www.npmjs.com/package/pptx-vue-viewer',
							},
						],
					},
				],
			},
		},
		de: {
			label: 'Deutsch',
			lang: 'de-DE',
			link: '/de/',
			themeConfig: {
				nav: [
					{ text: 'Anleitung', link: '/de/guide/introduction', activeMatch: '/de/guide/' },
					{ text: 'Benutzerhandbuch', link: '/user/', activeMatch: '/user/' },
					{
						text: 'Pakete',
						items: [
							{ text: 'Core (pptx-viewer-core)', link: '/core/' },
							{ text: 'React (pptx-react-viewer)', link: '/react/' },
							{
								text: 'Vue 3 (pptx-vue-viewer)',
								link: 'https://www.npmjs.com/package/pptx-vue-viewer',
							},
							{
								text: 'Angular (pptx-angular-viewer)',
								link: 'https://www.npmjs.com/package/pptx-angular-viewer',
							},
							{ text: 'MCP und Werkzeuge', link: '/packages/mcp' },
						],
					},
					{ text: 'Mitwirken', link: '/contributing/development', activeMatch: '/contributing/' },
					{ text: 'Versionen', link: '/releases/', activeMatch: '/releases/' },
					{
						text: 'Ressourcen',
						items: [
							{ text: 'Versionshinweise', link: '/releases/' },
							{
								text: 'npm: pptx-viewer-core',
								link: 'https://www.npmjs.com/package/pptx-viewer-core',
							},
							{
								text: 'npm: pptx-react-viewer',
								link: 'https://www.npmjs.com/package/pptx-react-viewer',
							},
							{
								text: 'npm: pptx-vue-viewer',
								link: 'https://www.npmjs.com/package/pptx-vue-viewer',
							},
						],
					},
				],
			},
		},
	},

	head: [
		['meta', { name: 'theme-color', content: '#d35400' }],
		['meta', { property: 'og:type', content: 'website' }],
		['meta', { property: 'og:title', content: 'pptx-viewer documentation' }],
		[
			'meta',
			{
				property: 'og:description',
				content:
					'Parse, edit, render, and convert PowerPoint (.pptx) files in TypeScript - SDK with React, Vue 3, and Angular viewer components.',
			},
		],
	],

	themeConfig: {
		// https://vitepress.dev/reference/default-theme-config
		nav: [
			{ text: 'Guide', link: '/guide/introduction', activeMatch: '/guide/' },
			{ text: 'User Guide', link: '/user/', activeMatch: '/user/' },
			{
				text: 'Packages',
				items: [
					{ text: 'Core (pptx-viewer-core)', link: '/core/' },
					{ text: 'React (pptx-react-viewer)', link: '/react/' },
					{
						text: 'Vue 3 (pptx-vue-viewer)',
						link: 'https://www.npmjs.com/package/pptx-vue-viewer',
					},
					{
						text: 'Angular (pptx-angular-viewer)',
						link: 'https://www.npmjs.com/package/pptx-angular-viewer',
					},
					{ text: 'MCP & Tools', link: '/packages/mcp' },
				],
			},
			{ text: 'Contributing', link: '/contributing/development', activeMatch: '/contributing/' },
			{ text: 'Releases', link: '/releases/', activeMatch: '/releases/' },
			{
				text: 'Resources',
				items: [
					{
						text: 'Release Notes',
						link: '/releases/',
					},
					{ text: 'npm: pptx-viewer-core', link: 'https://www.npmjs.com/package/pptx-viewer-core' },
					{
						text: 'npm: pptx-react-viewer',
						link: 'https://www.npmjs.com/package/pptx-react-viewer',
					},
					{ text: 'npm: pptx-vue-viewer', link: 'https://www.npmjs.com/package/pptx-vue-viewer' },
				],
			},
		],

		sidebar: {
			'/guide/': [
				{
					text: 'Introduction',
					items: [
						{ text: 'What is pptx-viewer?', link: '/guide/introduction' },
						{ text: 'Installation', link: '/guide/installation' },
						{ text: 'Quick Start', link: '/guide/quick-start' },
					],
				},
				{
					text: 'Concepts',
					items: [
						{ text: 'Architecture', link: '/guide/architecture' },
						{ text: 'Core Concepts', link: '/guide/concepts' },
						{ text: 'The PptxData Model', link: '/guide/data-model' },
						{ text: 'Localization (i18n)', link: '/guide/localization' },
						{ text: 'Limitations', link: '/guide/limitations' },
					],
				},
			],

			'/user/': [
				{
					text: 'User Guide',
					items: [
						{ text: 'Overview', link: '/user/' },
						{ text: 'Viewing Presentations', link: '/user/viewing' },
						{ text: 'Editing Slides', link: '/user/editing' },
						{ text: 'Presenting', link: '/user/presenting' },
						{ text: 'Exporting', link: '/user/exporting' },
						{ text: 'Collaboration', link: '/user/collaboration' },
						{ text: 'Keyboard Shortcuts', link: '/user/shortcuts' },
					],
				},
			],

			'/core/': [
				{
					text: 'Core Engine',
					items: [
						{ text: 'Overview', link: '/core/' },
						{ text: 'Loading & Parsing', link: '/core/loading' },
						{ text: 'The Builder API', link: '/core/builder' },
						{ text: 'Editing Programmatically', link: '/core/editing' },
						{ text: 'Saving & Round-tripping', link: '/core/saving' },
					],
				},
				{
					text: 'Conversion & Export',
					items: [
						{ text: 'Markdown Converter', link: '/core/converter' },
						{ text: 'SVG Export', link: '/core/svg-export' },
					],
				},
				{
					text: 'Advanced',
					items: [
						{ text: 'Encryption', link: '/core/encryption' },
						{ text: 'Geometry Engine', link: '/core/geometry' },
						{ text: 'CLI', link: '/core/cli' },
					],
				},
			],

			'/react/': [
				{
					text: 'React Viewer',
					items: [
						{ text: 'Overview', link: '/react/' },
						{ text: 'Getting Started', link: '/react/getting-started' },
						{ text: 'Component Props', link: '/react/props' },
						{ text: 'Imperative Handle', link: '/react/handle' },
					],
				},
				{
					text: 'Customisation',
					items: [
						{ text: 'Theming', link: '/react/theming' },
						{ text: 'Hooks', link: '/react/hooks' },
						{ text: 'Export', link: '/react/export' },
						{ text: 'Collaboration', link: '/react/collaboration' },
					],
				},
			],

			'/packages/': [
				{
					text: 'Supporting Packages',
					items: [{ text: 'MCP & Tools', link: '/packages/mcp' }],
				},
			],

			'/contributing/': [
				{
					text: 'Contributing',
					items: [
						{ text: 'Development', link: '/contributing/development' },
						{ text: 'Adding an Element Type', link: '/contributing/adding-element-type' },
					],
				},
			],

			'/releases/': [
				{
					text: 'Release Notes',
					items: [
						{ text: 'Overview', link: '/releases/' },
						{ text: 'pptx-viewer-core', link: '/releases/core' },
						{ text: 'pptx-react-viewer', link: '/releases/react' },
						{ text: 'pptx-vue-viewer', link: '/releases/vue' },
						{ text: 'pptx-angular-viewer', link: '/releases/angular' },
						{ text: 'pptx-viewer-mcp', link: '/releases/mcp' },
						{ text: '@christophervr/pptx-viewer (CLI)', link: '/releases/cli' },
					],
				},
			],
		},

		socialLinks: [{ icon: 'github', link: 'https://github.com/ChristopherVR/pptx-viewer' }],

		editLink: {
			pattern: 'https://github.com/ChristopherVR/pptx-viewer/edit/main/docs/:path',
			text: 'Edit this page on GitHub',
		},

		search: {
			provider: 'local',
		},

		footer: {
			message: 'Released under the Apache-2.0 License.',
			copyright: 'Copyright © 2025-present ChristopherVR',
		},
	},
});
