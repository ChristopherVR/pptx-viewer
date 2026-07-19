import type { LandingCopy } from './types';

export const es: LandingCopy = {
	hero: {
		kicker: 'Open source · Apache-2.0 · TypeScript',
		titleTop: 'Edicion .pptx,',
		titleAccent: 'lista para integrar.',
		sub: 'Visor y editor WYSIWYG de PowerPoint de codigo abierto para React, Vue 3, Angular, Svelte 5 y JavaScript vanilla. Un nucleo TypeScript headless carga, edita y guarda archivos .pptx; los componentes los muestran como HTML, CSS y SVG nativos.',
		start: { text: 'Empezar', href: '/es/guide/' },
		demo: 'Demo en vivo',
		scroll: 'Desplazar',
		frameCaption: 'sample-deck.pptx · en vivo en el navegador',
		frameTry: 'Probar',
		copyLabel: 'Copiar',
		copiedLabel: 'Copiado',
	},
	features: {
		kicker: 'Funciones',
		title: 'Lo que obtienes.',
		items: [
			{
				title: 'Renderizado de alta fidelidad',
				copy: 'Mas de 187 formas predefinidas, 23 tipos de graficos, SmartArt, animaciones, transiciones morph, fuentes incrustadas, metarchivos EMF y WMF y modelos 3D, todos dibujados como HTML, CSS y SVG. El texto sigue siendo seleccionable y los lectores de pantalla siguen funcionando.',
				link: { text: 'Renderizado', href: '/es/guide/architecture' },
			},
			{
				title: 'Edicion WYSIWYG',
				copy: 'Una cinta, paneles inspectores y manipulacion directa en el lienzo para texto, formas, tablas, graficos y SmartArt, con historial de deshacer completo. Los elementos de patrones y disenos tambien son editables.',
				link: { text: 'Edicion', href: '/react/getting-started' },
			},
			{
				title: 'Guardado de ida y vuelta',
				copy: 'La carga produce un modelo de datos completamente tipado con dieciseis tipos de elementos. El guardado escribe OpenXML valido conservando temas, patrones, disenos y la conformidad OOXML Strict, asi que un deck editado se reabre limpio en PowerPoint.',
				link: { text: 'Carga y guardado', href: '/core/loading' },
			},
			{
				title: 'Colaboracion en tiempo real',
				copy: 'Coedita a traves de un CRDT de Yjs con presencia, fusion de texto a nivel de caracter y un transporte entre pares que no necesita servidor.',
				link: { text: 'Colaboracion', href: '/react/collaboration' },
			},
			{
				title: 'Exportacion',
				copy: 'PNG, JPEG, SVG, PDF, GIF y video directamente desde el navegador. La exportacion SVG tambien funciona en headless en Node.js, sin DOM.',
				link: { text: 'Exportacion', href: '/react/export' },
			},
			{
				title: 'Cifrado',
				copy: 'Abre y guarda archivos protegidos con contrasena mediante cifrado agile AES-128 y AES-256.',
				link: { text: 'Cifrado', href: '/core/encryption' },
			},
			{
				title: 'Construir y convertir',
				copy: 'Crea decks por codigo con el builder fluido, o conviertelos a Markdown limpio o HTML posicionado con extraccion de medios y notas del orador.',
				link: { text: 'API Builder', href: '/core/builder' },
			},
			{
				title: 'Localizacion',
				copy: 'Cada etiqueta de la interfaz se resuelve a traves de una de las mas de 1.600 claves de traduccion pptx.*, conectadas a la libreria i18n que tu aplicacion ya usa: react-i18next, vue-i18n o ngx-translate.',
				link: { text: 'Localizacion', href: '/es/guide/localization' },
			},
		],
	},
	agents: {
		kicker: 'Automatizacion',
		title: '.pptx, editado por agentes.',
		copy: 'pptx-viewer-mcp expone mas de 50 herramientas PPTX con esquemas Zod sobre el Model Context Protocol, de modo que Claude, Cursor y Copilot pueden leer, editar y convertir presentaciones directamente. Las mismas funciones corren en headless en Node, Bun o entornos serverless, y una CLI cubre las conversiones puntuales.',
		link: { text: 'MCP y herramientas', href: '/packages/mcp' },
	},
	quickstart: {
		kicker: 'Inicio rapido',
		title: 'Renderiza un deck en quince lineas.',
		copy: 'Instala el paquete de tu framework, pasa los bytes .pptx sin procesar y dale una altura al contenedor. Edicion, presentacion, colaboracion y exportacion estan a una prop de distancia.',
		docsLabel: 'Guia completa',
	},
	demos: {
		kicker: 'Demo en vivo',
		title: 'Pruebalo aqui mismo.',
		copy: 'Este es el editor real ejecutandose en tu navegador: la misma aplicacion demo desplegada que obtendrias de npm, incrustada en vivo. Cambia de framework, o divide la vista y mira como dos aplicaciones independientes coeditan un mismo deck.',
		frameworkLabel: 'Framework',
		soloTab: 'Editor',
		collabTab: 'Colaboracion',
		guestPicker: 'Invitado',
		load: 'Cargar la demo en vivo',
		loading: 'Cargando el editor',
		openFull: 'Abrir la aplicacion',
		hostLabel: 'Anfitrion',
		guestLabel: 'Invitado',
		soloHint:
			'Todo se ejecuta en el cliente: el analisis, el renderizado, la edicion y el guardado ocurren en esta pestana, y el deck nunca sale de tu navegador. Abre la aplicacion completa para arrastrar un deck tuyo.',
		collabHint:
			'Dos aplicaciones independientes comparten un mismo deck mediante una sesion CRDT sin servidor (y-webrtc, par a par). Arrastra una forma o edita texto en un panel y mira como el otro lo sigue, incluso entre frameworks distintos.',
	},
	faq: {
		kicker: 'FAQ',
		title: 'Preguntas frecuentes.',
		items: [
			{
				q: 'Es gratis para uso comercial?',
				a: 'Si. Todo tiene licencia Apache-2.0: el nucleo, los cinco paquetes de UI, el servidor MCP y las demos. No hay un plan de pago.',
			},
			{
				q: 'Los archivos editados se reabren en PowerPoint?',
				a: 'Si. El guardado escribe OpenXML valido conservando temas, patrones, disenos y la conformidad OOXML Strict, asi que un deck cargado, editado y guardado aqui se reabre limpio en PowerPoint.',
			},
			{
				q: 'Necesita un servidor?',
				a: 'No. El analisis, el renderizado, la edicion y el guardado ocurren en el navegador. El nucleo tambien corre en Node.js y Bun para trabajo del lado del servidor o por CLI.',
			},
			{
				q: 'Como se renderizan las diapositivas?',
				a: 'Como HTML, CSS y SVG nativos en lugar de un bitmap de canvas. El texto sigue siendo seleccionable, el zoom se mantiene nitido y los lectores de pantalla funcionan.',
			},
			{
				q: 'La colaboracion necesita infraestructura?',
				a: 'Por defecto, no. El transporte incluido es entre pares (y-webrtc) y funciona desde hosting estatico. Para persistencia y autenticacion puedes apuntarlo a un relay y-websocket.',
				link: { text: 'Colaboracion', href: '/react/collaboration' },
			},
			{
				q: 'Puede abrir archivos protegidos con contrasena?',
				a: 'Si. El cifrado agile AES-128 y AES-256 esta soportado tanto al abrir como al guardar.',
			},
			{
				q: 'Que frameworks estan soportados?',
				a: 'React 19, Vue 3, Angular, Svelte 5 y una version vanilla sin framework. Cada paquete incluye el mismo motor, asi que el renderizado es identico en todos.',
			},
			{
				q: 'Cuales son las limitaciones?',
				a: 'Los objetos OLE son de solo lectura y algunos efectos visuales se aproximan en pantalla. La pagina de limitaciones detalla exactamente que esperar.',
				link: { text: 'Limitaciones', href: '/es/guide/limitations' },
			},
		],
	},
	finale: {
		kicker: 'Empezar',
		title: '.pptx entra. .pptx sale.',
		sub: 'Anade soporte de PowerPoint a tu aplicacion con una sola dependencia. Licencia Apache-2.0, TypeScript estricto, sin dependencias nativas. Prueba la demo con uno de tus decks y despues sigue el inicio rapido.',
		quick: { text: 'Inicio rapido', href: '/es/guide/quick-start' },
		github: 'Ver en GitHub',
		columns: [
			{
				title: 'Producto',
				links: [
					{
						text: 'Demo en vivo',
						href: 'https://christophervr.github.io/pptx-viewer/demo/',
						external: true,
					},
					{ text: 'Motor core', href: '/core/' },
					{ text: 'Servidor MCP', href: '/packages/mcp' },
					{ text: 'Versiones', href: '/releases/' },
				],
			},
			{
				title: 'Docs',
				links: [
					{ text: 'Introduccion', href: '/es/guide/introduction' },
					{ text: 'Inicio rapido', href: '/es/guide/quick-start' },
					{ text: 'Arquitectura', href: '/es/guide/architecture' },
					{ text: 'Limitaciones', href: '/es/guide/limitations' },
				],
			},
			{
				title: 'Comunidad',
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
						text: 'Licencia',
						href: 'https://github.com/ChristopherVR/pptx-viewer/blob/main/LICENSE',
						external: true,
					},
				],
			},
		],
		bottomLeft: '© 2026 Christopher van Rooyen · Apache-2.0',
		bottomRight: 'pptx-viewer · el motor PowerPoint para la web',
	},
};
