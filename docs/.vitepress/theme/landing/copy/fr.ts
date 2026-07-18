import type { LandingCopy } from './types';

export const fr: LandingCopy = {
	hero: {
		kicker: 'Open source · Apache-2.0 · TypeScript',
		titleTop: "L'edition .pptx,",
		titleAccent: 'prete a integrer.',
		sub: 'Visionneuse et editeur WYSIWYG PowerPoint open source pour React, Vue 3, Angular, Svelte 5 et JavaScript vanilla. Un coeur TypeScript headless charge, modifie et enregistre les fichiers .pptx ; les composants les affichent en HTML, CSS et SVG natifs.',
		start: { text: 'Commencer', href: '/fr/guide/introduction' },
		demo: 'Demo en direct',
		scroll: 'Defiler',
		frameCaption: 'sample-deck.pptx · en direct dans le navigateur',
		frameTry: 'Essayer',
		copyLabel: 'Copier',
		copiedLabel: 'Copie',
	},
	features: {
		kicker: 'Fonctionnalites',
		title: 'Ce que vous obtenez.',
		items: [
			{
				title: 'Rendu haute fidelite',
				copy: "Plus de 187 formes predefinies, 23 types de graphiques, SmartArt, animations, transitions morph, polices embarquees, metafichiers EMF et WMF et modeles 3D, tous dessines en HTML, CSS et SVG. Le texte reste selectionnable et les lecteurs d'ecran continuent de fonctionner.",
				link: { text: 'Rendu', href: '/fr/guide/architecture' },
			},
			{
				title: 'Edition WYSIWYG',
				copy: "Un ruban, des panneaux inspecteurs et la manipulation directe sur le canevas pour le texte, les formes, les tableaux, les graphiques et les SmartArt, avec un historique d'annulation complet. Les elements des masques et des dispositions sont eux aussi editables.",
				link: { text: 'Edition', href: '/react/getting-started' },
			},
			{
				title: 'Aller-retour sans perte',
				copy: "Le chargement produit un modele de donnees entierement type avec seize types d'elements. L'enregistrement ecrit un OpenXML valide en preservant themes, masques, dispositions et conformite OOXML Strict : un deck modifie se rouvre proprement dans PowerPoint.",
				link: { text: 'Chargement et enregistrement', href: '/core/loading' },
			},
			{
				title: 'Collaboration en temps reel',
				copy: 'Co-editez via un CRDT Yjs avec suivi de presence, fusion du texte au caractere pres et un transport pair-a-pair qui ne demande aucun serveur.',
				link: { text: 'Collaboration', href: '/react/collaboration' },
			},
			{
				title: 'Export',
				copy: "PNG, JPEG, SVG, PDF, GIF et video directement depuis le navigateur. L'export SVG fonctionne aussi en headless dans Node.js, sans DOM.",
				link: { text: 'Export', href: '/react/export' },
			},
			{
				title: 'Chiffrement',
				copy: 'Ouvrez et enregistrez des fichiers proteges par mot de passe avec le chiffrement agile AES-128 et AES-256.',
				link: { text: 'Chiffrement', href: '/core/encryption' },
			},
			{
				title: 'Construire et convertir',
				copy: 'Creez des decks par programmation avec le builder fluide, ou convertissez-les en Markdown propre ou en HTML positionne avec extraction des medias et notes du presentateur.',
				link: { text: 'API Builder', href: '/core/builder' },
			},
			{
				title: 'Localisation',
				copy: "Chaque libelle de l'interface passe par l'une des 1 600+ cles de traduction pptx.*, reliees a la bibliotheque i18n que votre application utilise deja : react-i18next, vue-i18n ou ngx-translate.",
				link: { text: 'Localisation', href: '/fr/guide/localization' },
			},
		],
	},
	agents: {
		kicker: 'Automatisation',
		title: '.pptx, edite par des agents.',
		copy: 'pptx-viewer-mcp expose plus de 50 outils PPTX avec des schemas Zod via le Model Context Protocol : Claude, Cursor et Copilot peuvent lire, modifier et convertir des presentations directement. Les memes fonctions tournent en headless dans Node, Bun ou en serverless, et une CLI couvre les conversions ponctuelles.',
		link: { text: 'MCP et outils', href: '/packages/mcp' },
	},
	quickstart: {
		kicker: 'Demarrage rapide',
		title: 'Affichez un deck en quinze lignes.',
		copy: 'Installez le package de votre framework, passez les octets .pptx bruts et donnez une hauteur au conteneur. Edition, presentation, collaboration et export sont a une prop pres.',
		docsLabel: 'Guide complet',
	},
	demos: {
		kicker: 'Demos',
		title: 'Voyez-le tourner.',
		copy: 'Chaque binding embarque une application demo complete, deployee depuis ce depot avec la documentation. Ouvrez-en une et glissez-y un de vos decks.',
		open: 'Ouvrir',
		cards: [
			{
				name: 'pptx-react-viewer',
				desc: "L'editeur complet en React 19 : ruban, inspecteur, collaboration, export.",
				href: 'https://christophervr.github.io/pptx-viewer/demo/',
				external: true,
			},
			{
				name: 'pptx-vue-viewer',
				desc: 'Le meme ensemble de fonctionnalites en Vue 3, pilote par props et evenements.',
				href: 'https://christophervr.github.io/pptx-viewer/demo-vue/',
				external: true,
			},
			{
				name: 'pptx-angular-viewer',
				desc: 'Un composant Angular standalone avec des entrees basees sur les signals.',
				href: 'https://christophervr.github.io/pptx-viewer/demo-angular/',
				external: true,
			},
			{
				name: 'pptx-svelte-viewer',
				desc: 'Le binding Svelte 5, runes comprises.',
				href: 'https://christophervr.github.io/pptx-viewer/demo-svelte/',
				external: true,
			},
			{
				name: 'pptx-vanilla-viewer',
				desc: 'Zero framework : un seul appel de fonction monte toute la visionneuse.',
				href: 'https://christophervr.github.io/pptx-viewer/demo-vanilla/',
				external: true,
			},
			{
				name: 'pptx-viewer-core',
				desc: 'Aucune UI. Analysez, modifiez, convertissez et enregistrez dans Node, Bun ou le navigateur.',
				href: '/core/',
			},
		],
	},
	faq: {
		kicker: 'FAQ',
		title: 'Questions frequentes.',
		items: [
			{
				q: 'Est-ce gratuit pour un usage commercial ?',
				a: "Oui. Tout est sous licence Apache-2.0 : le coeur, les cinq packages UI, le serveur MCP et les demos. Il n'y a pas d'offre payante.",
			},
			{
				q: 'Les fichiers modifies se rouvrent-ils dans PowerPoint ?',
				a: "Oui. L'enregistrement ecrit un OpenXML valide en preservant themes, masques, dispositions et conformite OOXML Strict : un deck charge, modifie et enregistre ici se rouvre proprement dans PowerPoint.",
			},
			{
				q: 'Faut-il un serveur ?',
				a: "Non. L'analyse, le rendu, l'edition et l'enregistrement se font dans le navigateur. Le coeur tourne aussi dans Node.js et Bun pour le travail cote serveur ou en CLI.",
			},
			{
				q: 'Comment les diapositives sont-elles rendues ?',
				a: "En HTML, CSS et SVG natifs plutot qu'en bitmap canvas. Le texte reste selectionnable, le zoom reste net et les lecteurs d'ecran fonctionnent.",
			},
			{
				q: 'La collaboration demande-t-elle une infrastructure ?',
				a: "Pas par defaut. Le transport fourni est pair-a-pair (y-webrtc) et fonctionne depuis un hebergement statique. Pour la persistance et l'authentification, vous pouvez le pointer vers un relais y-websocket.",
				link: { text: 'Collaboration', href: '/react/collaboration' },
			},
			{
				q: 'Peut-il ouvrir des fichiers proteges par mot de passe ?',
				a: "Oui. Le chiffrement agile AES-128 et AES-256 est pris en charge a l'ouverture comme a l'enregistrement.",
			},
			{
				q: 'Quels frameworks sont pris en charge ?',
				a: 'React 19, Vue 3, Angular, Svelte 5 et une version vanilla sans framework. Chaque package embarque le meme moteur, le rendu est donc identique partout.',
			},
			{
				q: 'Quelles sont les limites ?',
				a: "Les objets OLE sont en lecture seule et quelques effets visuels sont approximes a l'ecran. La page des limitations detaille exactement quoi attendre.",
				link: { text: 'Limitations', href: '/fr/guide/limitations' },
			},
		],
	},
	finale: {
		kicker: 'Commencer',
		title: '.pptx en entree. .pptx en sortie.',
		sub: 'Ajoutez la prise en charge de PowerPoint a votre application avec une seule dependance. Licence Apache-2.0, TypeScript strict, aucune dependance native. Essayez la demo avec un de vos decks, puis suivez le demarrage rapide.',
		quick: { text: 'Demarrage rapide', href: '/fr/guide/quick-start' },
		github: 'Voir sur GitHub',
		columns: [
			{
				title: 'Produit',
				links: [
					{
						text: 'Demo en direct',
						href: 'https://christophervr.github.io/pptx-viewer/demo/',
						external: true,
					},
					{ text: 'Moteur core', href: '/core/' },
					{ text: 'Serveur MCP', href: '/packages/mcp' },
					{ text: 'Versions', href: '/releases/' },
				],
			},
			{
				title: 'Docs',
				links: [
					{ text: 'Introduction', href: '/fr/guide/introduction' },
					{ text: 'Demarrage rapide', href: '/fr/guide/quick-start' },
					{ text: 'Architecture', href: '/fr/guide/architecture' },
					{ text: 'Limitations', href: '/fr/guide/limitations' },
				],
			},
			{
				title: 'Communaute',
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
						text: 'Licence',
						href: 'https://github.com/ChristopherVR/pptx-viewer/blob/main/LICENSE',
						external: true,
					},
				],
			},
		],
		bottomLeft: '© 2026 Christopher van Rooyen · Apache-2.0',
		bottomRight: 'pptx-viewer · le moteur PowerPoint pour le web',
	},
};
