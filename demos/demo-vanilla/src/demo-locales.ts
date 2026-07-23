/**
 * Demo-shell string translations (file picker / dropzone, sample-deck loader,
 * and the floating picker tooltips). These keys are not part of the
 * pptx-vanilla-viewer TranslationKey set and are therefore kept in a separate
 * dictionary that is registered alongside each language's viewer bundle in
 * demo-i18n.ts. Text mirrors demos/demo-vue/src/demo-locales.ts, minus
 * the collaboration-join strings (the vanilla binding has no collaboration
 * yet), plus the sample-deck strings the viewer-only demos add.
 */

export const demoStringsEn = {
	'demo.dropzone.hint': 'Drop a .pptx file here or click to browse',
	'demo.dropzone.processed': 'The file is processed entirely in the browser',
	'demo.dropzone.newPresentation': 'or create a New Presentation',
	'demo.dropzone.creating': 'Creating...',
	'demo.dropzone.uploadAriaLabel': 'Upload PPTX file',
	'demo.viewer.loadError': 'Failed to load the presentation',
	'demo.pickers.switchTheme': 'Switch theme',
	'demo.pickers.switchLanguage': 'Switch language',
	'demo.export.png': 'Export PNG',
	'demo.export.pdf': 'Export PDF',
	'demo.export.gif': 'Export animated GIF',
	'demo.export.video': 'Export WebM video',
	'demo.export.print': 'Print',
};

export const demoStringsFr = {
	'demo.dropzone.hint': 'Deposez un fichier .pptx ici ou cliquez pour parcourir',
	'demo.dropzone.processed': 'Le fichier est traite entierement dans le navigateur',
	'demo.dropzone.newPresentation': 'ou creer une nouvelle presentation',
	'demo.dropzone.creating': 'Creation en cours...',
	'demo.dropzone.uploadAriaLabel': 'Telecharger un fichier PPTX',
	'demo.viewer.loadError': 'Echec du chargement de la presentation',
	'demo.pickers.switchTheme': 'Changer de theme',
	'demo.pickers.switchLanguage': 'Changer de langue',
	'demo.export.png': 'Exporter en PNG',
	'demo.export.pdf': 'Exporter en PDF',
	'demo.export.gif': 'Exporter en GIF anime',
	'demo.export.video': 'Exporter en video WebM',
	'demo.export.print': 'Imprimer',
};

export const demoStringsEs = {
	'demo.dropzone.hint': 'Suelte un archivo .pptx aqui o haga clic para explorar',
	'demo.dropzone.processed': 'El archivo se procesa completamente en el navegador',
	'demo.dropzone.newPresentation': 'o crear una nueva presentacion',
	'demo.dropzone.creating': 'Creando...',
	'demo.dropzone.uploadAriaLabel': 'Subir archivo PPTX',
	'demo.viewer.loadError': 'No se pudo cargar la presentacion',
	'demo.pickers.switchTheme': 'Cambiar tema',
	'demo.pickers.switchLanguage': 'Cambiar idioma',
	'demo.export.png': 'Exportar a PNG',
	'demo.export.pdf': 'Exportar a PDF',
	'demo.export.gif': 'Exportar GIF animado',
	'demo.export.video': 'Exportar video WebM',
	'demo.export.print': 'Imprimir',
};

export const demoStringsDe = {
	'demo.dropzone.hint': 'PPTX-Datei hier ablegen oder zum Durchsuchen klicken',
	'demo.dropzone.processed': 'Die Datei wird vollstandig im Browser verarbeitet',
	'demo.dropzone.newPresentation': 'oder eine neue Prasentation erstellen',
	'demo.dropzone.creating': 'Wird erstellt...',
	'demo.dropzone.uploadAriaLabel': 'PPTX-Datei hochladen',
	'demo.viewer.loadError': 'Prasentation konnte nicht geladen werden',
	'demo.pickers.switchTheme': 'Design wechseln',
	'demo.pickers.switchLanguage': 'Sprache wechseln',
	'demo.export.png': 'Als PNG exportieren',
	'demo.export.pdf': 'Als PDF exportieren',
	'demo.export.gif': 'Als animiertes GIF exportieren',
	'demo.export.video': 'Als WebM-Video exportieren',
	'demo.export.print': 'Drucken',
};
