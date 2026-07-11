import type { LandingCopy } from './types';

export const fr: LandingCopy = {
	hero: {
		kicker: 'Open source · Apache-2.0 · TypeScript',
		titleTop: 'Le moteur PowerPoint',
		titleAccent: 'pour le web.',
		sub: 'Chargez, affichez, modifiez et enregistrez des fichiers .pptx dans le navigateur ou Node.js. Disponible en coeur TypeScript headless et en composants integres pour React, Vue 3, Angular, Svelte 5 et JavaScript vanilla.',
		start: { text: 'Commencer', href: '/fr/guide/introduction' },
		demo: 'Ouvrir la demo',
		scroll: 'Defiler',
		frameCaption: 'sample-deck.pptx · en direct dans le navigateur',
		frameTry: 'Essayer',
	},
	statement: {
		kicker: 'Rendu',
		line1: 'Les diapositives sont rendues en HTML, CSS et SVG.',
		line2Pre: 'Le texte reste ',
		line2Em: 'selectionnable',
		line2Post: ', le zoom reste net,',
		line3: 'et les fichiers enregistres se rouvrent dans PowerPoint.',
	},
	panels: [
		{
			kicker: 'Rendu',
			title: 'Couvre toute la surface fonctionnelle OpenXML.',
			copy: "187+ formes predefinies, 23 types de graphiques, SmartArt, animations, transitions morph, metafichiers EMF et WMF, polices embarquees et modeles 3D sont dessines en HTML, CSS et SVG. Aucune rasterisation canvas : le texte reste selectionnable et les lecteurs d'ecran continuent de fonctionner.",
			link: { text: 'Fonctionnement du rendu', href: '/fr/guide/architecture' },
		},
		{
			kicker: 'Modele de donnees',
			title: 'Chargez, modifiez, reenregistrez.',
			copy: "Le chargement d'un fichier .pptx produit un modele PptxData entierement type avec seize types d'elements. Themes, masques, dispositions et conformite OOXML Strict survivent a l'aller-retour : un deck modifie se rouvre proprement dans PowerPoint.",
			link: { text: 'Chargement et analyse', href: '/core/loading' },
		},
		{
			kicker: 'Frameworks',
			title: 'Un seul moteur. Tous les frameworks, ou aucun.',
			copy: "La visionneuse s'integre comme composant pret a l'emploi pour React, Vue 3, Angular et Svelte 5, plus une version JavaScript vanilla sans framework. Chaque paquet embarque le moteur : une seule dependance donne le meme rendu partout, mode presentateur, edition et export compris.",
			link: { text: 'Choisir un framework', href: '/fr/guide/installation' },
		},
		{
			kicker: 'Automatisation',
			title: 'Utilisable en headless, en CLI ou via MCP.',
			copy: 'pptx-viewer-mcp expose plus de 50 outils PPTX avec schemas Zod sous forme de serveur MCP : Claude, Cursor et Copilot peuvent lire, modifier et convertir des presentations directement. Les memes fonctions sont appelables depuis votre propre code en Node, Bun ou serverless.',
			link: { text: 'MCP et outils', href: '/packages/mcp' },
		},
	],
	bento: {
		kicker: 'Egalement inclus',
		tiles: [
			{
				title: 'Collaboration en temps reel',
				copy: 'Coeditez via un CRDT Yjs avec suivi de presence, fusion du texte au caractere pres et un transport P2P sans serveur.',
				href: '/react/collaboration',
			},
			{
				title: 'Chiffrement',
				copy: 'Ouvrez et enregistrez des fichiers proteges par mot de passe avec le chiffrement agile AES-128 et AES-256.',
				href: '/core/encryption',
			},
			{
				title: 'Export',
				copy: "PNG, JPEG, SVG, PDF, GIF et video depuis le navigateur. L'export SVG fonctionne aussi en Node.js sans DOM.",
				href: '/react/export',
			},
			{
				title: 'Conversion Markdown',
				copy: 'Transformez les decks en Markdown propre ou en HTML positionne, avec extraction des medias, notes du presentateur et metadonnees.',
				href: '/core/converter',
			},
			{
				title: 'API Builder',
				copy: "Creez des presentations par programmation : texte, formes, images, tableaux et graphiques sans toucher a l'OpenXML brut.",
				href: '/core/builder',
			},
			{
				title: 'Limitations',
				copy: "Les objets OLE sont en lecture seule et certains effets visuels sont approximes a l'ecran. La page des limitations liste exactement ce qu'il faut attendre.",
				href: '/fr/guide/limitations',
			},
			{
				title: 'Localisation',
				copy: "Chaque libelle de l'interface passe par une cle de traduction pptx.* (plus de 1 600), branchee sur la bibliotheque i18n de votre application : react-i18next, vue-i18n ou ngx-translate. Un dictionnaire anglais est fourni avec chaque paquet, et cette documentation existe en anglais, francais, espagnol et allemand.",
				href: '/fr/guide/localization',
				wide: true,
			},
		],
	},
	stack: {
		kicker: 'Choisissez votre stack',
		title: 'Installez un seul paquet.',
		copyPre: 'Chaque paquet UI embarque le moteur : une seule dependance suffit. Vous hesitez ? ',
		copyCode: 'npx @christophervr/pptx-viewer',
		copyPost: ' vous guide.',
		packages: [
			{
				name: 'pptx-react-viewer',
				desc: 'Visionneuse + editeur WYSIWYG pour React 19',
				href: '/react/getting-started',
				external: false,
			},
			{
				name: 'pptx-vue-viewer',
				desc: 'Les memes fonctionnalites pour Vue 3',
				href: 'https://www.npmjs.com/package/pptx-vue-viewer',
				external: true,
			},
			{
				name: 'pptx-angular-viewer',
				desc: 'Les memes fonctionnalites pour Angular',
				href: 'https://www.npmjs.com/package/pptx-angular-viewer',
				external: true,
			},
			{
				name: 'pptx-vanilla-viewer',
				desc: 'Le meme moteur, sans framework, DOM pur',
				href: '/vanilla/',
				external: false,
			},
			{
				name: 'pptx-svelte-viewer',
				desc: 'Les memes fonctionnalites pour Svelte 5',
				href: '/svelte/',
				external: false,
			},
			{
				name: 'pptx-viewer-core',
				desc: 'Moteur headless : analyse, edition, conversion, chiffrement',
				href: '/core/',
				external: false,
			},
			{
				name: 'pptx-viewer-mcp',
				desc: 'Plus de 50 outils MCP, CLI, codec de collaboration',
				href: '/packages/mcp',
				external: false,
			},
		],
	},
	finale: {
		kicker: 'Pour commencer',
		title: 'Ajoutez PowerPoint a votre application.',
		sub: 'Licence Apache-2.0, TypeScript strict, aucune dependance native. Essayez la demo avec vos propres decks, puis suivez le guide de demarrage.',
		quick: { text: 'Demarrage rapide', href: '/fr/guide/quick-start' },
		github: 'Voir sur GitHub',
		footLeft: 'pptx-viewer · le moteur PowerPoint pour le web',
		footRight: 'Apache-2.0 · TypeScript strict · aucune dependance native',
	},
};
