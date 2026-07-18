import type { LandingCopy } from './types';

export const de: LandingCopy = {
	hero: {
		kicker: 'Open Source · Apache-2.0 · TypeScript',
		titleTop: '.pptx-Bearbeitung,',
		titleAccent: 'zum Einbetten.',
		sub: 'Open-Source-PowerPoint-Viewer und WYSIWYG-Editor fur React, Vue 3, Angular, Svelte 5 und Vanilla JavaScript. Ein headless TypeScript-Kern ladt, bearbeitet und speichert .pptx-Dateien; die Komponenten rendern sie als natives HTML, CSS und SVG.',
		start: { text: 'Loslegen', href: '/de/guide/' },
		demo: 'Live-Demo',
		scroll: 'Scrollen',
		frameCaption: 'sample-deck.pptx · live im Browser',
		frameTry: 'Ausprobieren',
		copyLabel: 'Kopieren',
		copiedLabel: 'Kopiert',
	},
	features: {
		kicker: 'Funktionen',
		title: 'Was Sie bekommen.',
		items: [
			{
				title: 'Originalgetreues Rendering',
				copy: 'Uber 187 vordefinierte Formen, 23 Diagrammtypen, SmartArt, Animationen, Morph-Ubergange, eingebettete Schriften, EMF- und WMF-Metadateien und 3D-Modelle, alle als HTML, CSS und SVG gezeichnet. Text bleibt markierbar und Screenreader funktionieren weiter.',
				link: { text: 'Rendering', href: '/de/guide/architecture' },
			},
			{
				title: 'WYSIWYG-Bearbeitung',
				copy: 'Ein Menuband, Inspektor-Panels und direkte Manipulation auf der Leinwand fur Text, Formen, Tabellen, Diagramme und SmartArt, mit vollstandiger Undo-Historie. Auch Master- und Layout-Elemente sind bearbeitbar.',
				link: { text: 'Bearbeitung', href: '/react/getting-started' },
			},
			{
				title: 'Verlustfreier Roundtrip',
				copy: 'Das Laden erzeugt ein voll typisiertes Datenmodell mit sechzehn Elementtypen. Das Speichern schreibt gultiges OpenXML mit intakten Themes, Mastern, Layouts und OOXML-Strict-Konformitat, sodass sich ein bearbeitetes Deck sauber in PowerPoint offnet.',
				link: { text: 'Laden und Speichern', href: '/core/loading' },
			},
			{
				title: 'Echtzeit-Kollaboration',
				copy: 'Gemeinsames Bearbeiten uber ein Yjs-CRDT mit Prasenzanzeige, zeichengenauem Text-Merge und einem Peer-to-Peer-Transport, der keinen Server braucht.',
				link: { text: 'Kollaboration', href: '/react/collaboration' },
			},
			{
				title: 'Export',
				copy: 'PNG, JPEG, SVG, PDF, GIF und Video direkt aus dem Browser. Der SVG-Export lauft auch headless in Node.js, ganz ohne DOM.',
				link: { text: 'Export', href: '/react/export' },
			},
			{
				title: 'Verschlusselung',
				copy: 'Offnen und speichern Sie passwortgeschutzte Dateien mit agiler AES-128- und AES-256-Verschlusselung.',
				link: { text: 'Verschlusselung', href: '/core/encryption' },
			},
			{
				title: 'Erstellen und konvertieren',
				copy: 'Erstellen Sie Decks programmatisch mit dem fluent Builder, oder konvertieren Sie sie in sauberes Markdown oder positioniertes HTML mit Medienextraktion und Vortragsnotizen.',
				link: { text: 'Builder-API', href: '/core/builder' },
			},
			{
				title: 'Lokalisierung',
				copy: 'Jedes UI-Label lauft uber einen von 1.600+ pptx.*-Ubersetzungsschlusseln, verbunden mit der i18n-Bibliothek, die Ihre App bereits nutzt: react-i18next, vue-i18n oder ngx-translate.',
				link: { text: 'Lokalisierung', href: '/de/guide/localization' },
			},
		],
	},
	agents: {
		kicker: 'Automatisierung',
		title: '.pptx, bearbeitet von Agenten.',
		copy: 'pptx-viewer-mcp stellt uber das Model Context Protocol 50+ PPTX-Werkzeuge mit Zod-Schemas bereit, sodass Claude, Cursor und Copilot Prasentationen direkt lesen, bearbeiten und konvertieren konnen. Dieselben Funktionen laufen headless in Node, Bun oder Serverless-Umgebungen, und eine CLI deckt einmalige Konvertierungen ab.',
		link: { text: 'MCP und Werkzeuge', href: '/packages/mcp' },
	},
	quickstart: {
		kicker: 'Schnellstart',
		title: 'Ein Deck in funfzehn Zeilen.',
		copy: 'Installieren Sie das Paket fur Ihr Framework, ubergeben Sie die rohen .pptx-Bytes und geben Sie dem Container eine Hohe. Bearbeitung, Prasentation, Kollaboration und Export sind nur eine Prop entfernt.',
		docsLabel: 'Vollstandige Anleitung',
	},
	demos: {
		kicker: 'Demos',
		title: 'Sehen Sie es laufen.',
		copy: 'Jedes Binding bringt eine vollstandige Demo-App mit, die zusammen mit der Dokumentation aus diesem Repository deployt wird. Offnen Sie eine und ziehen Sie ein eigenes Deck hinein.',
		open: 'Offnen',
		cards: [
			{
				name: 'pptx-react-viewer',
				desc: 'Der komplette Editor in React 19: Menuband, Inspektor, Kollaboration, Export.',
				href: 'https://christophervr.github.io/pptx-viewer/demo/',
				external: true,
			},
			{
				name: 'pptx-vue-viewer',
				desc: 'Derselbe Funktionsumfang in Vue 3, gesteuert uber Props und Events.',
				href: 'https://christophervr.github.io/pptx-viewer/demo-vue/',
				external: true,
			},
			{
				name: 'pptx-angular-viewer',
				desc: 'Eine Standalone-Angular-Komponente mit signalbasierten Inputs.',
				href: 'https://christophervr.github.io/pptx-viewer/demo-angular/',
				external: true,
			},
			{
				name: 'pptx-svelte-viewer',
				desc: 'Derselbe Editor als Svelte-5-Komponente.',
				href: 'https://christophervr.github.io/pptx-viewer/demo-svelte/',
				external: true,
			},
			{
				name: 'pptx-vanilla-viewer',
				desc: 'Null Framework: ein einziger Funktionsaufruf montiert den ganzen Viewer.',
				href: 'https://christophervr.github.io/pptx-viewer/demo-vanilla/',
				external: true,
			},
			{
				name: 'pptx-viewer-core',
				desc: 'Ganz ohne UI. Parsen, bearbeiten, konvertieren und speichern in Node, Bun oder im Browser.',
				href: '/core/',
			},
		],
	},
	faq: {
		kicker: 'FAQ',
		title: 'Haufige Fragen.',
		items: [
			{
				q: 'Ist die kommerzielle Nutzung kostenlos?',
				a: 'Ja. Alles steht unter Apache-2.0-Lizenz: der Kern, alle funf UI-Pakete, der MCP-Server und die Demos. Es gibt keine Bezahlstufe.',
			},
			{
				q: 'Offnen sich bearbeitete Dateien wieder in PowerPoint?',
				a: 'Ja. Das Speichern schreibt gultiges OpenXML mit erhaltenen Themes, Mastern, Layouts und OOXML-Strict-Konformitat, sodass sich ein hier geladenes, bearbeitetes und gespeichertes Deck sauber in PowerPoint offnet.',
			},
			{
				q: 'Braucht es einen Server?',
				a: 'Nein. Parsen, Rendern, Bearbeiten und Speichern passieren im Browser. Der Kern lauft auch in Node.js und Bun fur serverseitige oder CLI-Arbeit.',
			},
			{
				q: 'Wie werden Folien gerendert?',
				a: 'Als natives HTML, CSS und SVG statt als Canvas-Bitmap. Text bleibt markierbar, der Zoom bleibt scharf und Screenreader funktionieren.',
			},
			{
				q: 'Braucht die Kollaboration Infrastruktur?',
				a: 'Standardmassig nicht. Der mitgelieferte Transport ist Peer-to-Peer (y-webrtc) und funktioniert von statischem Hosting aus. Fur Persistenz und Authentifizierung konnen Sie ihn auf ein y-websocket-Relay zeigen lassen.',
				link: { text: 'Kollaboration', href: '/react/collaboration' },
			},
			{
				q: 'Kann es passwortgeschutzte Dateien offnen?',
				a: 'Ja. Agile AES-128- und AES-256-Verschlusselung wird beim Offnen wie beim Speichern unterstutzt.',
			},
			{
				q: 'Welche Frameworks werden unterstutzt?',
				a: 'React 19, Vue 3, Angular, Svelte 5 und ein frameworkfreier Vanilla-Build. Jedes Paket bundelt denselben Kern, das Rendering ist also uberall identisch.',
			},
			{
				q: 'Was sind die Grenzen?',
				a: 'OLE-Objekte sind schreibgeschutzt und einige visuelle Effekte werden auf dem Bildschirm angenahert. Die Seite zu den Einschrankungen listet genau auf, was zu erwarten ist.',
				link: { text: 'Einschrankungen', href: '/de/guide/limitations' },
			},
		],
	},
	finale: {
		kicker: 'Loslegen',
		title: '.pptx rein. .pptx raus.',
		sub: 'Fugen Sie Ihrer App PowerPoint-Unterstutzung mit einer einzigen Abhangigkeit hinzu. Apache-2.0-lizenziert, striktes TypeScript, keine nativen Abhangigkeiten. Testen Sie die Demo mit einem eigenen Deck und folgen Sie dann dem Schnellstart.',
		quick: { text: 'Schnellstart', href: '/de/guide/quick-start' },
		github: 'Auf GitHub ansehen',
		columns: [
			{
				title: 'Produkt',
				links: [
					{
						text: 'Live-Demo',
						href: 'https://christophervr.github.io/pptx-viewer/demo/',
						external: true,
					},
					{ text: 'Core-Engine', href: '/core/' },
					{ text: 'MCP-Server', href: '/packages/mcp' },
					{ text: 'Releases', href: '/releases/' },
				],
			},
			{
				title: 'Docs',
				links: [
					{ text: 'Einfuhrung', href: '/de/guide/introduction' },
					{ text: 'Schnellstart', href: '/de/guide/quick-start' },
					{ text: 'Architektur', href: '/de/guide/architecture' },
					{ text: 'Einschrankungen', href: '/de/guide/limitations' },
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
						text: 'Lizenz',
						href: 'https://github.com/ChristopherVR/pptx-viewer/blob/main/LICENSE',
						external: true,
					},
				],
			},
		],
		bottomLeft: '© 2026 Christopher van Rooyen · Apache-2.0',
		bottomRight: 'pptx-viewer · die PowerPoint-Engine fur das Web',
	},
};
