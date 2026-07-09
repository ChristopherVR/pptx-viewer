import type { LandingCopy } from './types';

export const es: LandingCopy = {
	hero: {
		kicker: 'Open source · Apache-2.0 · TypeScript',
		titleTop: 'El motor de PowerPoint',
		titleAccent: 'para la web.',
		sub: 'Carga, renderiza, edita y guarda archivos .pptx en el navegador o en Node.js. Disponible como nucleo TypeScript headless y como componentes de visor/editor para React, Vue 3 y Angular.',
		start: { text: 'Empezar', href: '/es/guide/introduction' },
		demo: 'Abrir la demo',
		scroll: 'Desplazar',
		frameCaption: 'sample-deck.pptx · en vivo en el navegador',
		frameTry: 'Probar',
	},
	statement: {
		kicker: 'Renderizado',
		line1: 'Las diapositivas se renderizan como HTML, CSS y SVG.',
		line2Pre: 'El texto sigue siendo ',
		line2Em: 'seleccionable',
		line2Post: ', el zoom se mantiene nitido,',
		line3: 'y los archivos guardados se reabren sin problemas en PowerPoint.',
	},
	panels: [
		{
			kicker: 'Renderizado',
			title: 'Cubre toda la superficie de OpenXML.',
			copy: 'Mas de 187 formas predefinidas, 23 tipos de graficos, SmartArt, animaciones, transiciones morph, metarchivos EMF y WMF, fuentes incrustadas y modelos 3D se dibujan con HTML, CSS y SVG. No hay rasterizacion en canvas: el texto sigue siendo seleccionable y los lectores de pantalla siguen funcionando.',
			link: { text: 'Como funciona el renderizado', href: '/es/guide/architecture' },
		},
		{
			kicker: 'Modelo de datos',
			title: 'Cargalo, cambialo, guardalo.',
			copy: 'Cargar un archivo .pptx produce un modelo PptxData completamente tipado con dieciseis tipos de elementos. Temas, patrones, disenos y la conformidad OOXML Strict sobreviven al viaje de ida y vuelta: un deck editado se reabre limpiamente en PowerPoint.',
			link: { text: 'Carga y analisis', href: '/core/loading' },
		},
		{
			kicker: 'Frameworks',
			title: 'Un motor. React, Vue y Angular.',
			copy: 'El visor y el editor WYSIWYG se integran como componentes listos para usar en React, Vue 3 y Angular. Cada paquete incluye el motor: una sola dependencia ofrece las mismas funciones en todos los frameworks, incluidos el modo presentador, la exportacion y la colaboracion en tiempo real.',
			link: { text: 'Elige un framework', href: '/es/guide/installation' },
		},
		{
			kicker: 'Automatizacion',
			title: 'Usalo headless, desde la CLI o por MCP.',
			copy: 'pptx-viewer-mcp expone mas de 50 herramientas PPTX con esquemas Zod como servidor MCP: Claude, Cursor y Copilot pueden leer, editar y convertir presentaciones directamente. Las mismas funciones se pueden llamar desde tu propio codigo en Node, Bun o entornos serverless.',
			link: { text: 'MCP y herramientas', href: '/packages/mcp' },
		},
	],
	bento: {
		kicker: 'Tambien incluido',
		tiles: [
			{
				title: 'Colaboracion en tiempo real',
				copy: 'Coedita mediante un CRDT de Yjs con presencia, fusion de texto a nivel de caracter y un transporte P2P sin servidor.',
				href: '/react/collaboration',
			},
			{
				title: 'Cifrado',
				copy: 'Abre y guarda archivos protegidos con contrasena mediante cifrado agil AES-128 y AES-256.',
				href: '/core/encryption',
			},
			{
				title: 'Exportacion',
				copy: 'PNG, JPEG, SVG, PDF, GIF y video desde el navegador. La exportacion SVG tambien funciona en Node.js sin DOM.',
				href: '/react/export',
			},
			{
				title: 'Conversion a Markdown',
				copy: 'Convierte los decks en Markdown limpio o HTML posicionado, con extraccion de medios, notas del orador y metadatos.',
				href: '/core/converter',
			},
			{
				title: 'API Builder',
				copy: 'Crea presentaciones por codigo: texto, formas, imagenes, tablas y graficos sin tocar OpenXML en bruto.',
				href: '/core/builder',
			},
			{
				title: 'Limitaciones',
				copy: 'Los objetos OLE son de solo lectura y algunos efectos visuales se aproximan en pantalla. La pagina de limitaciones detalla exactamente que esperar.',
				href: '/es/guide/limitations',
			},
			{
				title: 'Localizacion',
				copy: 'Cada etiqueta de la interfaz pasa por una clave de traduccion pptx.* (mas de 1.600), conectada a la biblioteca i18n de tu aplicacion: react-i18next, vue-i18n o ngx-translate. Cada paquete incluye un diccionario en ingles, y esta documentacion esta disponible en ingles, frances, espanol y aleman.',
				href: '/es/guide/localization',
				wide: true,
			},
		],
	},
	stack: {
		kicker: 'Elige tu stack',
		title: 'Instala un solo paquete.',
		copyPre:
			'Cada paquete de UI incluye el motor, asi que basta con una sola dependencia. No sabes cual elegir? ',
		copyCode: 'npx @christophervr/pptx-viewer',
		copyPost: ' te guia paso a paso.',
		packages: [
			{
				name: 'pptx-react-viewer',
				desc: 'Visor + editor WYSIWYG para React 19',
				href: '/react/getting-started',
				external: false,
			},
			{
				name: 'pptx-vue-viewer',
				desc: 'Las mismas funciones para Vue 3',
				href: 'https://www.npmjs.com/package/pptx-vue-viewer',
				external: true,
			},
			{
				name: 'pptx-angular-viewer',
				desc: 'Las mismas funciones para Angular',
				href: 'https://www.npmjs.com/package/pptx-angular-viewer',
				external: true,
			},
			{
				name: 'pptx-viewer-core',
				desc: 'Motor headless: analisis, edicion, conversion, cifrado',
				href: '/core/',
				external: false,
			},
			{
				name: 'pptx-viewer-mcp',
				desc: 'Mas de 50 herramientas MCP, CLI, codec de colaboracion',
				href: '/packages/mcp',
				external: false,
			},
		],
	},
	finale: {
		kicker: 'Para empezar',
		title: 'Anade PowerPoint a tu aplicacion.',
		sub: 'Licencia Apache-2.0, TypeScript estricto, sin dependencias nativas. Prueba la demo con tus propios decks y sigue la guia de inicio rapido.',
		quick: { text: 'Inicio rapido', href: '/es/guide/quick-start' },
		github: 'Ver en GitHub',
		footLeft: 'pptx-viewer · el motor de PowerPoint para la web',
		footRight: 'Apache-2.0 · TypeScript estricto · sin dependencias nativas',
	},
};
