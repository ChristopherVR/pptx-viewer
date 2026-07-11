import type { LandingCopy } from './types';

export const de: LandingCopy = {
	hero: {
		kicker: 'Open Source · Apache-2.0 · TypeScript',
		titleTop: 'Die PowerPoint-Engine',
		titleAccent: 'fur das Web.',
		sub: 'Laden, rendern, bearbeiten und speichern Sie .pptx-Dateien im Browser oder in Node.js. Erhaltlich als headless TypeScript-Kern und als fertige Komponenten fur React, Vue 3, Angular, Svelte 5 und Vanilla JavaScript.',
		start: { text: 'Loslegen', href: '/de/guide/introduction' },
		demo: 'Live-Demo offnen',
		scroll: 'Scrollen',
		frameCaption: 'sample-deck.pptx · live im Browser',
		frameTry: 'Ausprobieren',
	},
	statement: {
		kicker: 'Rendering',
		line1: 'Folien werden als HTML, CSS und SVG gerendert.',
		line2Pre: 'Text bleibt ',
		line2Em: 'markierbar',
		line2Post: ', der Zoom bleibt scharf,',
		line3: 'und gespeicherte Dateien offnen sich sauber in PowerPoint.',
	},
	panels: [
		{
			kicker: 'Rendering',
			title: 'Deckt die gesamte OpenXML-Funktionsflache ab.',
			copy: 'Uber 187 vordefinierte Formen, 23 Diagrammtypen, SmartArt, Animationen, Morph-Ubergange, EMF- und WMF-Metadateien, eingebettete Schriften und 3D-Modelle werden mit HTML, CSS und SVG gezeichnet. Keine Canvas-Rasterung: Text bleibt markierbar und Screenreader funktionieren weiter.',
			link: { text: 'So funktioniert das Rendering', href: '/de/guide/architecture' },
		},
		{
			kicker: 'Datenmodell',
			title: 'Laden, andern, zuruckspeichern.',
			copy: 'Das Laden einer .pptx-Datei erzeugt ein vollstandig typisiertes PptxData-Modell mit sechzehn Elementtypen. Themes, Master, Layouts und OOXML-Strict-Konformitat uberstehen den Roundtrip: Ein bearbeitetes Deck offnet sich sauber in PowerPoint.',
			link: { text: 'Laden und Parsen', href: '/core/loading' },
		},
		{
			kicker: 'Frameworks',
			title: 'Eine Engine. Jedes Framework, oder keines.',
			copy: 'Der Viewer steht als fertige Komponente fur React, Vue 3, Angular und Svelte 5 bereit, dazu eine frameworkfreie Vanilla-JavaScript-Variante. Jedes Paket bundelt die Engine: Eine einzige Abhangigkeit liefert uberall dasselbe Rendering, inklusive Prasentationsmodus, Bearbeitung und Export.',
			link: { text: 'Framework wahlen', href: '/de/guide/installation' },
		},
		{
			kicker: 'Automatisierung',
			title: 'Headless, per CLI oder uber MCP.',
			copy: 'pptx-viewer-mcp stellt uber 50 PPTX-Tools mit Zod-Schemata als MCP-Server bereit: Claude, Cursor und Copilot konnen Prasentationen direkt lesen, bearbeiten und konvertieren. Dieselben Funktionen lassen sich aus eigenem Code in Node, Bun oder Serverless-Umgebungen aufrufen.',
			link: { text: 'MCP und Tools', href: '/packages/mcp' },
		},
	],
	bento: {
		kicker: 'Ausserdem enthalten',
		tiles: [
			{
				title: 'Echtzeit-Kollaboration',
				copy: 'Gemeinsames Bearbeiten uber ein Yjs-CRDT mit Prasenzanzeige, zeichengenauem Text-Merge und einem serverlosen P2P-Transport.',
				href: '/react/collaboration',
			},
			{
				title: 'Verschlusselung',
				copy: 'Offnen und speichern Sie passwortgeschutzte Dateien mit agiler AES-128- und AES-256-Verschlusselung.',
				href: '/core/encryption',
			},
			{
				title: 'Export',
				copy: 'PNG, JPEG, SVG, PDF, GIF und Video direkt aus dem Browser. SVG-Export lauft auch headless in Node.js ohne DOM.',
				href: '/react/export',
			},
			{
				title: 'Markdown-Konvertierung',
				copy: 'Wandeln Sie Decks in sauberes Markdown oder positioniertes HTML um, mit Medienextraktion, Notizen und Metadaten.',
				href: '/core/converter',
			},
			{
				title: 'Builder-API',
				copy: 'Erstellen Sie Prasentationen programmatisch: Text, Formen, Bilder, Tabellen und Diagramme ohne rohes OpenXML.',
				href: '/core/builder',
			},
			{
				title: 'Grenzen',
				copy: 'OLE-Objekte sind schreibgeschutzt und manche visuellen Effekte werden am Bildschirm angenahert. Die Seite zu den Grenzen listet genau auf, was zu erwarten ist.',
				href: '/de/guide/limitations',
			},
			{
				title: 'Lokalisierung',
				copy: 'Jedes UI-Label lauft uber einen pptx.*-Ubersetzungsschlussel (uber 1.600), angebunden an die i18n-Bibliothek Ihrer App: react-i18next, vue-i18n oder ngx-translate. Ein englisches Worterbuch liegt jedem Paket bei, und diese Dokumentation gibt es auf Englisch, Franzosisch, Spanisch und Deutsch.',
				href: '/de/guide/localization',
				wide: true,
			},
		],
	},
	stack: {
		kicker: 'Stack wahlen',
		title: 'Ein Paket installieren.',
		copyPre:
			'Jedes UI-Paket bundelt die Engine, eine einzige Abhangigkeit genugt. Unsicher, welches passt? ',
		copyCode: 'npx @christophervr/pptx-viewer',
		copyPost: ' hilft bei der Auswahl.',
		packages: [
			{
				name: 'pptx-react-viewer',
				desc: 'Viewer + WYSIWYG-Editor fur React 19',
				href: '/react/getting-started',
				external: false,
			},
			{
				name: 'pptx-vue-viewer',
				desc: 'Derselbe Funktionsumfang fur Vue 3',
				href: 'https://www.npmjs.com/package/pptx-vue-viewer',
				external: true,
			},
			{
				name: 'pptx-angular-viewer',
				desc: 'Derselbe Funktionsumfang fur Angular',
				href: 'https://www.npmjs.com/package/pptx-angular-viewer',
				external: true,
			},
			{
				name: 'pptx-vanilla-viewer',
				desc: 'Dieselbe Engine, frameworkfrei, reines DOM',
				href: '/vanilla/',
				external: false,
			},
			{
				name: 'pptx-svelte-viewer',
				desc: 'Derselbe Funktionsumfang fur Svelte 5',
				href: '/svelte/',
				external: false,
			},
			{
				name: 'pptx-viewer-core',
				desc: 'Headless-Engine: Parsen, Bearbeiten, Konvertieren, Verschlusseln',
				href: '/core/',
				external: false,
			},
			{
				name: 'pptx-viewer-mcp',
				desc: 'Uber 50 MCP-Tools, CLI, Kollaborations-Codec',
				href: '/packages/mcp',
				external: false,
			},
		],
	},
	finale: {
		kicker: 'Loslegen',
		title: 'Bringen Sie PowerPoint in Ihre App.',
		sub: 'Apache-2.0-lizenziert, striktes TypeScript, keine nativen Abhangigkeiten. Testen Sie die Demo mit eigenen Decks und folgen Sie dann dem Schnellstart.',
		quick: { text: 'Schnellstart', href: '/de/guide/quick-start' },
		github: 'Auf GitHub ansehen',
		footLeft: 'pptx-viewer · die PowerPoint-Engine fur das Web',
		footRight: 'Apache-2.0 · striktes TypeScript · keine nativen Abhangigkeiten',
	},
};
