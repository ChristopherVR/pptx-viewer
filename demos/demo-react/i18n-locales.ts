import type { TranslationKey } from 'pptx-react-viewer/i18n';
import { translationsEn } from 'pptx-react-viewer/i18n';

/**
 * French and Spanish resource bundles for the demo's language picker.
 *
 * Each dictionary starts from `translationsEn` (so every one of the 1,600+
 * `TranslationKey`s is covered and the type below catches typos) and
 * overrides the high-visibility core: status bar, toolbar, find/replace,
 * arrange, accessibility, animations, comments, header/footer, collaboration,
 * share/settings dialogs, sections, notes, slide sorter, grid/ruler, fields,
 * masters, print, export, version history, presenter, presentation mode,
 * selection pane, inspector, broadcast, encrypted-file, and the shared
 * `common.*` vocabulary. Less common inspector/dialog panels not yet
 * overridden here simply keep their English text rather than breaking or
 * showing a raw key - see the Localization guide for how to extend either
 * dictionary further, or contribute a complete translation upstream.
 */

export const translationsFr: Record<TranslationKey, string> = {
	...translationsEn,

	// Status bar
	'pptx.statusBar.allSaved': 'Tout est enregistré',
	'pptx.statusBar.unsavedChanges': 'Modifications non enregistrées',
	'pptx.statusBar.slideOf': 'Diapositive {{current}} sur {{total}}',
	'pptx.statusBar.noSlides': 'Aucune diapositive',
	'pptx.statusBar.language': 'Français',
	'pptx.statusBar.toggleNotes': 'Afficher/Masquer les notes',
	'pptx.statusBar.normalView': 'Affichage normal',
	'pptx.statusBar.slideSorter': 'Mode Trieuse',
	'pptx.statusBar.slideShow': 'Diaporama',
	'pptx.statusBar.zoomIn': 'Zoom avant',
	'pptx.statusBar.zoomOut': 'Zoom arrière',
	'pptx.statusBar.zoomToFit': 'Ajuster au zoom',

	// Autosave
	'pptx.autosave.saving': 'Enregistrement...',
	'pptx.autosave.saved': 'Enregistré {{time}}',
	'pptx.autosave.error': "Erreur d'enregistrement automatique",
	'pptx.autosave.justNow': "à l'instant",
	'pptx.autosave.oneMinAgo': 'il y a 1 min',
	'pptx.autosave.minutesAgo': 'il y a {{count}} min',

	// Toolbar
	'pptx.toolbar.toggleSlidesPanel': 'Afficher/Masquer le volet des diapositives',
	'pptx.toolbar.undo': 'Annuler',
	'pptx.toolbar.undoAction': 'Annuler : {{action}}',
	'pptx.toolbar.redo': 'Rétablir',
	'pptx.toolbar.redoAction': 'Rétablir : {{action}}',
	'pptx.toolbar.comments': 'Commentaires',
	'pptx.toolbar.share': 'Partager',
	'pptx.toolbar.sharingUsers': 'Partage en cours : {{count}} utilisateur(s) connecté(s)',
	'pptx.toolbar.sharingCount': 'Partage ({{count}})',
	'pptx.toolbar.toggleInspector': "Afficher/Masquer le panneau d'inspection",
	'pptx.toolbar.settingsShortcuts': 'Paramètres et raccourcis',
	'pptx.toolbar.settings': 'Paramètres',
	'pptx.toolbar.readOnly': 'Lecture seule',

	// Find & Replace
	'pptx.findReplace.title': 'Rechercher et remplacer',
	'pptx.findReplace.closeEscape': 'Fermer (Échap)',
	'pptx.findReplace.closeAriaLabel': 'Fermer la recherche et le remplacement',
	'pptx.findReplace.findPlaceholder': 'Rechercher...',
	'pptx.findReplace.searchText': 'Texte à rechercher',
	'pptx.findReplace.matchCase': 'Respecter la casse',
	'pptx.findReplace.toggleMatchCase': 'Activer/Désactiver le respect de la casse',
	'pptx.findReplace.previousMatch': 'Occurrence précédente',
	'pptx.findReplace.nextMatch': 'Occurrence suivante',
	'pptx.findReplace.replacePlaceholder': 'Remplacer par...',
	'pptx.findReplace.replacementText': 'Texte de remplacement',
	'pptx.findReplace.replaceCurrent': "Remplacer l'occurrence actuelle",
	'pptx.findReplace.replace': 'Remplacer',
	'pptx.findReplace.replaceAllMatches': 'Remplacer toutes les occurrences',
	'pptx.findReplace.replaceAll': 'Tout remplacer',
	'pptx.findReplace.matchCount': '{{current}} sur {{total}}',
	'pptx.findReplace.noMatches': 'Aucune occurrence',

	// Arrange
	'pptx.arrange.align': 'Aligner {{direction}}',
	'pptx.arrange.copy': 'Copier',
	'pptx.arrange.cut': 'Couper',
	'pptx.arrange.paste': 'Coller',
	'pptx.arrange.formatPainter': 'Reproduire la mise en forme',
	'pptx.arrange.format': 'Format',
	'pptx.arrange.flipHorizontally': 'Retourner horizontalement',
	'pptx.arrange.flipH': 'Retourn. H',
	'pptx.arrange.flipVertically': 'Retourner verticalement',
	'pptx.arrange.flipV': 'Retourn. V',
	'pptx.arrange.sendBackward': 'Reculer',
	'pptx.arrange.bringForward': 'Avancer',
	'pptx.arrange.sendToBack': "Mettre à l'arrière-plan",
	'pptx.arrange.back': 'Arrière-plan',
	'pptx.arrange.bringToFront': 'Mettre au premier plan',
	'pptx.arrange.front': 'Premier plan',
	'pptx.arrange.duplicate': 'Dupliquer',
	'pptx.arrange.delete': 'Supprimer',

	// Accessibility
	'pptx.accessibility.title': "Vérificateur d'accessibilité",
	'pptx.accessibility.issueCount': '{{count}} problème(s)',
	'pptx.accessibility.closePanel': "Fermer le panneau d'accessibilité",
	'pptx.accessibility.close': 'Fermer',
	'pptx.accessibility.reduceMotion': 'Réduire les animations',
	'pptx.accessibility.issuesList': "Problèmes d'accessibilité",
	'pptx.accessibility.noIssues': "Aucun problème d'accessibilité détecté.",
	'pptx.accessibility.error': 'Erreur : ',
	'pptx.accessibility.warning': 'Avertissement : ',
	'pptx.accessibility.info': 'Info : ',

	// Animations
	'pptx.animations.previewTooltip': "Aperçu de l'animation sur l'élément sélectionné",
	'pptx.animations.preview': 'Aperçu',
	'pptx.animations.addTooltip': "Ajouter une animation à l'élément sélectionné",
	'pptx.animations.addAnimation': 'Ajouter une animation',
	'pptx.animations.group.entrance': 'Ouverture',
	'pptx.animations.group.emphasis': 'Accentuation',
	'pptx.animations.group.exit': 'Fermeture',
	'pptx.animations.preset.appear': 'Apparaître',
	'pptx.animations.preset.fadeIn': 'Fondu entrant',
	'pptx.animations.preset.flyIn': 'Entrée en volant',
	'pptx.animations.preset.pulse': 'Pulsation',
	'pptx.animations.preset.spin': 'Rotation',
	'pptx.animations.preset.disappear': 'Disparaître',
	'pptx.animations.preset.fadeOut': 'Fondu sortant',
	'pptx.animations.applyAnimation': "Appliquer l'animation {{name}}",
	'pptx.animations.removeTooltip': "Supprimer l'animation de l'élément sélectionné",
	'pptx.animations.remove': 'Supprimer',
	'pptx.animations.openPanelTooltip': "Ouvrir le panneau Animation dans l'inspecteur",
	'pptx.animations.animationPanel': 'Panneau Animation',

	// Comments
	'pptx.comments.addComment': 'Ajouter un commentaire',
	'pptx.comments.noComments': 'Aucun commentaire',
	'pptx.comments.author': 'Auteur',
	'pptx.comments.resolved': 'Résolu',
	'pptx.comments.clickToSelect': "Cliquer pour sélectionner l'élément",
	'pptx.comments.deletedElement': 'Élément supprimé',
	'pptx.comments.save': 'Enregistrer',
	'pptx.comments.cancel': 'Annuler',
	'pptx.comments.edit': 'Modifier',
	'pptx.comments.reply': 'Répondre',
	'pptx.comments.resolve': 'Résoudre',
	'pptx.comments.unresolve': 'Rouvrir',
	'pptx.comments.delete': 'Supprimer',
	'pptx.comments.commentingOn': 'Commentaire sur :',
	'pptx.comments.commentOnElement': 'Commenter {{element}}...',
	'pptx.comments.addCommentPlaceholder': 'Ajouter un commentaire...',

	// Header & Footer
	'pptx.headerFooter.title': 'En-tête et pied de page',
	'pptx.headerFooter.close': 'Fermer',
	'pptx.headerFooter.dateAndTime': 'Date et heure',
	'pptx.headerFooter.slideNumber': 'Numéro de diapositive',
	'pptx.headerFooter.footer': 'Pied de page',
	'pptx.headerFooter.footerPlaceholder': 'Saisir le texte du pied de page...',
	'pptx.headerFooter.applyToAll': 'Appliquer à tout',
	'pptx.headerFooter.applyToCurrent': 'Appliquer à la diapositive actuelle',

	// Collaboration
	'pptx.collaboration.status.connected': 'Connecté',
	'pptx.collaboration.status.connecting': 'Connexion...',
	'pptx.collaboration.status.disconnected': 'Déconnecté',
	'pptx.collaboration.status.error': 'Erreur de connexion',
	'pptx.collaboration.statusAriaLabel':
		'Collaboration : {{status}}. {{count}} utilisateur(s) connecté(s).',
	'pptx.collaboration.userCount': '{{count}} utilisateur(s)',
	'pptx.collaboration.youLabel': '{{name}} (vous)',
	'pptx.collaboration.usersConnected': '{{count}} utilisateur(s) connecté(s)',
	'pptx.collaboration.moreUsers': '{{count}} utilisateur(s) supplémentaire(s)',
	'pptx.collaboration.retry': 'Réessayer',

	// Share dialog
	'pptx.share.title': 'Partager la présentation',
	'pptx.share.collaborationActive': 'Collaboration active',
	'pptx.share.closeDialog': 'Fermer la boîte de dialogue',
	'pptx.share.close': 'Fermer',
	'pptx.share.cancel': 'Annuler',
	'pptx.share.startSharing': 'Démarrer le partage',
	'pptx.share.stopSharing': 'Arrêter le partage',
	'pptx.share.description':
		"Partagez cette présentation pour collaborer en temps réel. D'autres utilisateurs peuvent la rejoindre à l'aide du nom de session pour modifier ensemble avec des curseurs en direct et des modifications synchronisées.",
	'pptx.share.preconfiguredDescription':
		'Votre administrateur a configuré les paramètres de collaboration.',
	'pptx.share.sessionName': 'Nom de la session',
	'pptx.share.sessionPlaceholder': 'ex. session-abc123',
	'pptx.share.sessionHint':
		'Lettres, chiffres, tirets et underscores uniquement. Partagez ce nom avec vos collaborateurs.',
	'pptx.share.displayName': "Votre nom d'affichage",
	'pptx.share.namePlaceholder': 'ex. Alice',
	'pptx.share.serverLabel': 'Serveur de collaboration',
	'pptx.share.serverPlaceholder': 'wss://collab.example.com',
	'pptx.share.serverHint':
		"Saisissez l'URL WebSocket d'un serveur y-websocket. Utilisez une URL sécurisée wss:// lors du partage depuis une page https://.",
	'pptx.share.shareLink': 'Lien de partage',
	'pptx.share.copyLink': 'Copier le lien de partage',
	'pptx.share.copied': 'Copié',
	'pptx.share.copyUrl': "Copier l'URL",
	'pptx.share.shareHint':
		"Partagez cette URL avec d'autres personnes pour qu'elles puissent rejoindre la session.",
	'pptx.share.room': 'Salle :',
	'pptx.share.server': 'Serveur :',
	'pptx.share.connectedUsers': 'Utilisateurs connectés',
	'pptx.share.you': '(vous)',
	'pptx.share.connectionError':
		"Impossible de joindre le serveur de collaboration. Vérifiez l'URL du serveur : il doit s'agir d'un serveur y-websocket accessible, et d'une URL sécurisée wss:// lors du partage depuis une page https://.",

	// Settings dialog
	'pptx.settings.title': 'Paramètres',
	'pptx.settings.general': 'Général',
	'pptx.settings.keyboardShortcuts': 'Raccourcis clavier',
	'pptx.settings.closeSettings': 'Fermer les paramètres',
	'pptx.settings.close': 'Fermer',
	'pptx.settings.autoSave': 'Enregistrement automatique',
	'pptx.settings.spellCheck': 'Vérification orthographique',
	'pptx.settings.showGrid': 'Afficher le quadrillage',
	'pptx.settings.showRulers': 'Afficher les règles',
	'pptx.settings.snapToGrid': 'Aligner sur le quadrillage',
	'pptx.settings.reducedMotion': 'Animations réduites',

	// Sections / slides pane
	'pptx.sections.slides': 'Diapositives',
	'pptx.sections.collapsePane': 'Réduire le volet',
	'pptx.sections.addSlide': 'Ajouter une diapositive',
	'pptx.sections.addSection': 'Ajouter une section',
	'pptx.sections.defaultName': 'Section sans titre',
	'pptx.sections.rename': 'Renommer',
	'pptx.sections.delete': 'Supprimer',
	'pptx.sections.moveUp': 'Déplacer vers le haut',
	'pptx.sections.moveDown': 'Déplacer vers le bas',
	'pptx.sections.addBefore': 'Ajouter une section avant',
	'pptx.sections.addAfter': 'Ajouter une section après',

	// Notes
	'pptx.notes.title': 'Notes',
	'pptx.notes.slideN': 'Diapositive {{n}}',
	'pptx.notes.noSlide': 'Aucune diapositive sélectionnée',
	'pptx.notes.clickToAddNotes': 'Cliquer pour ajouter des notes',
	'pptx.notes.noNotes': 'Aucune note',

	// Slide sorter
	'pptx.slideSorter.title': 'Trieuse de diapositives',
	'pptx.slideSorter.selectedCount': '{{count}} sélectionnée(s)',
	'pptx.slideSorter.slideCount': '{{count}} diapositives',
	'pptx.slideSorter.close': 'Fermer',
	'pptx.slideSorter.zoomIn': 'Zoom avant',
	'pptx.slideSorter.zoomOut': 'Zoom arrière',
	'pptx.slideSorter.zoom': 'Zoom',

	// Grid / ruler
	'pptx.grid.grid': 'Quadrillage',
	'pptx.grid.toggleGrid': 'Afficher/Masquer le quadrillage',
	'pptx.grid.snapToGrid': 'Aligner sur le quadrillage',
	'pptx.grid.snapToShape': 'Aligner sur la forme',
	'pptx.ruler.rulers': 'Règles',
	'pptx.ruler.toggleRulers': 'Afficher/Masquer les règles',

	// Field insertion
	'pptx.field.field': 'Champ',
	'pptx.field.format': 'Format',
	'pptx.field.insertField': 'Insérer un champ',
	'pptx.field.slideNumber': 'Numéro de diapositive',
	'pptx.field.dateTime': 'Date/Heure',
	'pptx.field.header': 'En-tête',
	'pptx.field.footer': 'Pied de page',

	// Masters
	'pptx.master.master': 'Masque',
	'pptx.master.layout': 'Disposition',
	'pptx.master.noMasters': 'Aucun masque',
	'pptx.master.title': 'Masque des diapositives',

	// Print
	'pptx.print.title': 'Imprimer',
	'pptx.print.printButton': 'Imprimer',

	// Export
	'pptx.export.processing': 'Traitement en cours...',
	'pptx.export.cancel': 'Annuler',

	// Version history
	'pptx.versionHistory.title': 'Historique des versions',
	'pptx.versionHistory.noVersions': 'Aucune version',
	'pptx.versionHistory.restore': 'Restaurer',

	// Presenter
	'pptx.presenter.speakerNotes': 'Notes du présentateur',
	'pptx.presenter.nextSlidePreview': 'Diapositive suivante',
	'pptx.presenter.noNotes': 'Aucune note pour cette diapositive',
	'pptx.presenter.endPresentation': 'Terminer la présentation',

	// Presentation mode
	'pptx.presentation.pen': 'Stylo',
	'pptx.presentation.highlighter': 'Surligneur',
	'pptx.presentation.eraser': 'Gomme',
	'pptx.presentation.laserPointer': 'Pointeur laser',

	// Selection pane
	'pptx.selectionPane.title': 'Volet Sélection',
	'pptx.selectionPane.empty': 'Aucun élément',
	'pptx.selectionPane.show': 'Afficher',
	'pptx.selectionPane.hide': 'Masquer',
	'pptx.selectionPane.close': 'Fermer',

	// Inspector
	'pptx.inspector.element': 'Élément',
	'pptx.inspector.noSlideSelected': 'Aucune diapositive sélectionnée',

	// Broadcast
	'pptx.broadcast.title': 'Diffuser le diaporama',
	'pptx.broadcast.broadcasting': 'Diffusion en direct',
	'pptx.broadcast.description':
		'Démarrez une diffusion en direct pour que les spectateurs puissent suivre votre présentation en temps réel. Ils verront automatiquement la diapositive que vous présentez.',
	'pptx.broadcast.sessionName': 'Session de diffusion',
	'pptx.broadcast.displayName': 'Nom du présentateur',
	'pptx.broadcast.serverLabel': 'Serveur de collaboration',
	'pptx.broadcast.hint':
		'Les spectateurs peuvent rejoindre via le lien affiché après le démarrage. Ils suivront automatiquement vos diapositives.',
	'pptx.broadcast.startBroadcast': 'Démarrer la diffusion',
	'pptx.broadcast.stopBroadcast': 'Arrêter la diffusion',
	'pptx.broadcast.viewerLink': 'Lien spectateur',
	'pptx.broadcast.copyLink': 'Copier le lien spectateur',
	'pptx.broadcast.shareHint':
		"Partagez cette URL avec votre public pour qu'il puisse suivre la présentation.",
	'pptx.broadcast.viewers': 'Spectateurs',
	'pptx.broadcast.viewerCount': '{{count}} spectateur(s)',

	// Encrypted
	'pptx.encryptedFile.title': 'Fichier chiffré',
	'pptx.encryptedFile.message': 'Ce fichier est chiffré.',
	'pptx.encryptedFile.instructions': "Saisissez le mot de passe pour l'ouvrir.",

	// Common (shared verb/label vocabulary reused across dialogs and panels)
	'common.close': 'Fermer',
	'common.cancel': 'Annuler',
	'common.apply': 'Appliquer',
	'common.delete': 'Supprimer',
	'common.done': 'Terminé',
	'common.loading': 'Chargement...',
	'common.ok': 'OK',
	'common.remove': 'Supprimer',
	'common.reset': 'Réinitialiser',
	'common.save': 'Enregistrer',
};

export const translationsEs: Record<TranslationKey, string> = {
	...translationsEn,

	// Status bar
	'pptx.statusBar.allSaved': 'Todo guardado',
	'pptx.statusBar.unsavedChanges': 'Cambios sin guardar',
	'pptx.statusBar.slideOf': 'Diapositiva {{current}} de {{total}}',
	'pptx.statusBar.noSlides': 'Sin diapositivas',
	'pptx.statusBar.language': 'Español',
	'pptx.statusBar.toggleNotes': 'Mostrar/Ocultar notas',
	'pptx.statusBar.normalView': 'Vista normal',
	'pptx.statusBar.slideSorter': 'Clasificador de diapositivas',
	'pptx.statusBar.slideShow': 'Presentación',
	'pptx.statusBar.zoomIn': 'Acercar',
	'pptx.statusBar.zoomOut': 'Alejar',
	'pptx.statusBar.zoomToFit': 'Ajustar zoom',

	// Autosave
	'pptx.autosave.saving': 'Guardando...',
	'pptx.autosave.saved': 'Guardado {{time}}',
	'pptx.autosave.error': 'Error de guardado automático',
	'pptx.autosave.justNow': 'ahora mismo',
	'pptx.autosave.oneMinAgo': 'hace 1 min',
	'pptx.autosave.minutesAgo': 'hace {{count}} min',

	// Toolbar
	'pptx.toolbar.toggleSlidesPanel': 'Mostrar/Ocultar el panel de diapositivas',
	'pptx.toolbar.undo': 'Deshacer',
	'pptx.toolbar.undoAction': 'Deshacer: {{action}}',
	'pptx.toolbar.redo': 'Rehacer',
	'pptx.toolbar.redoAction': 'Rehacer: {{action}}',
	'pptx.toolbar.comments': 'Comentarios',
	'pptx.toolbar.share': 'Compartir',
	'pptx.toolbar.sharingUsers': 'Compartiendo: {{count}} usuario(s) conectado(s)',
	'pptx.toolbar.sharingCount': 'Compartir ({{count}})',
	'pptx.toolbar.toggleInspector': 'Mostrar/Ocultar el panel de inspección',
	'pptx.toolbar.settingsShortcuts': 'Configuración y atajos',
	'pptx.toolbar.settings': 'Configuración',
	'pptx.toolbar.readOnly': 'Solo lectura',

	// Find & Replace
	'pptx.findReplace.title': 'Buscar y reemplazar',
	'pptx.findReplace.closeEscape': 'Cerrar (Esc)',
	'pptx.findReplace.closeAriaLabel': 'Cerrar buscar y reemplazar',
	'pptx.findReplace.findPlaceholder': 'Buscar...',
	'pptx.findReplace.searchText': 'Texto de búsqueda',
	'pptx.findReplace.matchCase': 'Coincidir mayúsculas y minúsculas',
	'pptx.findReplace.toggleMatchCase': 'Alternar coincidencia de mayúsculas y minúsculas',
	'pptx.findReplace.previousMatch': 'Coincidencia anterior',
	'pptx.findReplace.nextMatch': 'Siguiente coincidencia',
	'pptx.findReplace.replacePlaceholder': 'Reemplazar con...',
	'pptx.findReplace.replacementText': 'Texto de reemplazo',
	'pptx.findReplace.replaceCurrent': 'Reemplazar coincidencia actual',
	'pptx.findReplace.replace': 'Reemplazar',
	'pptx.findReplace.replaceAllMatches': 'Reemplazar todas las coincidencias',
	'pptx.findReplace.replaceAll': 'Reemplazar todo',
	'pptx.findReplace.matchCount': '{{current}} de {{total}}',
	'pptx.findReplace.noMatches': 'Sin coincidencias',

	// Arrange
	'pptx.arrange.align': 'Alinear {{direction}}',
	'pptx.arrange.copy': 'Copiar',
	'pptx.arrange.cut': 'Cortar',
	'pptx.arrange.paste': 'Pegar',
	'pptx.arrange.formatPainter': 'Copiar formato',
	'pptx.arrange.format': 'Formato',
	'pptx.arrange.flipHorizontally': 'Voltear horizontalmente',
	'pptx.arrange.flipH': 'Voltear H',
	'pptx.arrange.flipVertically': 'Voltear verticalmente',
	'pptx.arrange.flipV': 'Voltear V',
	'pptx.arrange.sendBackward': 'Enviar atrás',
	'pptx.arrange.bringForward': 'Traer adelante',
	'pptx.arrange.sendToBack': 'Enviar al fondo',
	'pptx.arrange.back': 'Fondo',
	'pptx.arrange.bringToFront': 'Traer al frente',
	'pptx.arrange.front': 'Frente',
	'pptx.arrange.duplicate': 'Duplicar',
	'pptx.arrange.delete': 'Eliminar',

	// Accessibility
	'pptx.accessibility.title': 'Comprobador de accesibilidad',
	'pptx.accessibility.issueCount': '{{count}} problema(s)',
	'pptx.accessibility.closePanel': 'Cerrar el panel de accesibilidad',
	'pptx.accessibility.close': 'Cerrar',
	'pptx.accessibility.reduceMotion': 'Reducir animaciones',
	'pptx.accessibility.issuesList': 'Problemas de accesibilidad',
	'pptx.accessibility.noIssues': 'No se encontraron problemas de accesibilidad.',
	'pptx.accessibility.error': 'Error: ',
	'pptx.accessibility.warning': 'Advertencia: ',
	'pptx.accessibility.info': 'Info: ',

	// Animations
	'pptx.animations.previewTooltip': 'Previsualizar animación en el elemento seleccionado',
	'pptx.animations.preview': 'Vista previa',
	'pptx.animations.addTooltip': 'Añadir animación al elemento seleccionado',
	'pptx.animations.addAnimation': 'Añadir animación',
	'pptx.animations.group.entrance': 'Entrada',
	'pptx.animations.group.emphasis': 'Énfasis',
	'pptx.animations.group.exit': 'Salida',
	'pptx.animations.preset.appear': 'Aparecer',
	'pptx.animations.preset.fadeIn': 'Aparición gradual',
	'pptx.animations.preset.flyIn': 'Entrada volando',
	'pptx.animations.preset.pulse': 'Pulso',
	'pptx.animations.preset.spin': 'Girar',
	'pptx.animations.preset.disappear': 'Desaparecer',
	'pptx.animations.preset.fadeOut': 'Desvanecimiento',
	'pptx.animations.applyAnimation': 'Aplicar animación {{name}}',
	'pptx.animations.removeTooltip': 'Quitar animación del elemento seleccionado',
	'pptx.animations.remove': 'Quitar',
	'pptx.animations.openPanelTooltip': 'Abrir el panel de animación en el inspector',
	'pptx.animations.animationPanel': 'Panel de animación',

	// Comments
	'pptx.comments.addComment': 'Añadir comentario',
	'pptx.comments.noComments': 'Sin comentarios',
	'pptx.comments.author': 'Autor',
	'pptx.comments.resolved': 'Resuelto',
	'pptx.comments.clickToSelect': 'Haga clic para seleccionar el elemento',
	'pptx.comments.deletedElement': 'Elemento eliminado',
	'pptx.comments.save': 'Guardar',
	'pptx.comments.cancel': 'Cancelar',
	'pptx.comments.edit': 'Editar',
	'pptx.comments.reply': 'Responder',
	'pptx.comments.resolve': 'Resolver',
	'pptx.comments.unresolve': 'Reabrir',
	'pptx.comments.delete': 'Eliminar',
	'pptx.comments.commentingOn': 'Comentando en:',
	'pptx.comments.commentOnElement': 'Comentar sobre {{element}}...',
	'pptx.comments.addCommentPlaceholder': 'Añadir un comentario...',

	// Header & Footer
	'pptx.headerFooter.title': 'Encabezado y pie de página',
	'pptx.headerFooter.close': 'Cerrar',
	'pptx.headerFooter.dateAndTime': 'Fecha y hora',
	'pptx.headerFooter.slideNumber': 'Número de diapositiva',
	'pptx.headerFooter.footer': 'Pie de página',
	'pptx.headerFooter.footerPlaceholder': 'Escriba el texto del pie de página...',
	'pptx.headerFooter.applyToAll': 'Aplicar a todo',
	'pptx.headerFooter.applyToCurrent': 'Aplicar a la actual',

	// Collaboration
	'pptx.collaboration.status.connected': 'Conectado',
	'pptx.collaboration.status.connecting': 'Conectando...',
	'pptx.collaboration.status.disconnected': 'Desconectado',
	'pptx.collaboration.status.error': 'Error de conexión',
	'pptx.collaboration.statusAriaLabel':
		'Colaboración: {{status}}. {{count}} usuario(s) conectado(s).',
	'pptx.collaboration.userCount': '{{count}} usuario(s)',
	'pptx.collaboration.youLabel': '{{name}} (tú)',
	'pptx.collaboration.usersConnected': '{{count}} usuario(s) conectado(s)',
	'pptx.collaboration.moreUsers': '{{count}} usuario(s) más',
	'pptx.collaboration.retry': 'Reintentar',

	// Share dialog
	'pptx.share.title': 'Compartir presentación',
	'pptx.share.collaborationActive': 'Colaboración activa',
	'pptx.share.closeDialog': 'Cerrar cuadro de diálogo',
	'pptx.share.close': 'Cerrar',
	'pptx.share.cancel': 'Cancelar',
	'pptx.share.startSharing': 'Iniciar uso compartido',
	'pptx.share.stopSharing': 'Detener uso compartido',
	'pptx.share.description':
		'Comparta esta presentación para colaborar en tiempo real. Otros usuarios pueden unirse con el nombre de la sesión para editar juntos con cursores en vivo y cambios sincronizados.',
	'pptx.share.preconfiguredDescription': 'Su administrador ha configurado la colaboración.',
	'pptx.share.sessionName': 'Nombre de la sesión',
	'pptx.share.sessionPlaceholder': 'p. ej. session-abc123',
	'pptx.share.sessionHint':
		'Solo letras, números, guiones y guiones bajos. Comparta este nombre con sus colaboradores.',
	'pptx.share.displayName': 'Su nombre para mostrar',
	'pptx.share.namePlaceholder': 'p. ej. Alicia',
	'pptx.share.serverLabel': 'Servidor de colaboración',
	'pptx.share.serverPlaceholder': 'wss://collab.example.com',
	'pptx.share.serverHint':
		'Introduzca la URL WebSocket de un servidor y-websocket. Use una URL segura wss:// al compartir desde una página https://.',
	'pptx.share.shareLink': 'Enlace para compartir',
	'pptx.share.copyLink': 'Copiar enlace para compartir',
	'pptx.share.copied': 'Copiado',
	'pptx.share.copyUrl': 'Copiar URL',
	'pptx.share.shareHint':
		'Comparta esta URL con otras personas para que puedan unirse a la sesión.',
	'pptx.share.room': 'Sala:',
	'pptx.share.server': 'Servidor:',
	'pptx.share.connectedUsers': 'Usuarios conectados',
	'pptx.share.you': '(tú)',
	'pptx.share.connectionError':
		'No se pudo conectar con el servidor de colaboración. Compruebe la URL del servidor: debe ser un servidor y-websocket accesible, y una URL segura wss:// al compartir desde una página https://.',

	// Settings dialog
	'pptx.settings.title': 'Configuración',
	'pptx.settings.general': 'General',
	'pptx.settings.keyboardShortcuts': 'Atajos de teclado',
	'pptx.settings.closeSettings': 'Cerrar configuración',
	'pptx.settings.close': 'Cerrar',
	'pptx.settings.autoSave': 'Guardado automático',
	'pptx.settings.spellCheck': 'Revisión ortográfica',
	'pptx.settings.showGrid': 'Mostrar cuadrícula',
	'pptx.settings.showRulers': 'Mostrar reglas',
	'pptx.settings.snapToGrid': 'Ajustar a la cuadrícula',
	'pptx.settings.reducedMotion': 'Animaciones reducidas',

	// Sections / slides pane
	'pptx.sections.slides': 'Diapositivas',
	'pptx.sections.collapsePane': 'Contraer panel',
	'pptx.sections.addSlide': 'Añadir diapositiva',
	'pptx.sections.addSection': 'Añadir sección',
	'pptx.sections.defaultName': 'Sección sin título',
	'pptx.sections.rename': 'Cambiar nombre',
	'pptx.sections.delete': 'Eliminar',
	'pptx.sections.moveUp': 'Subir',
	'pptx.sections.moveDown': 'Bajar',
	'pptx.sections.addBefore': 'Añadir sección antes',
	'pptx.sections.addAfter': 'Añadir sección después',

	// Notes
	'pptx.notes.title': 'Notas',
	'pptx.notes.slideN': 'Diapositiva {{n}}',
	'pptx.notes.noSlide': 'Ninguna diapositiva seleccionada',
	'pptx.notes.clickToAddNotes': 'Haga clic para añadir notas',
	'pptx.notes.noNotes': 'Sin notas',

	// Slide sorter
	'pptx.slideSorter.title': 'Clasificador de diapositivas',
	'pptx.slideSorter.selectedCount': '{{count}} seleccionada(s)',
	'pptx.slideSorter.slideCount': '{{count}} diapositivas',
	'pptx.slideSorter.close': 'Cerrar',
	'pptx.slideSorter.zoomIn': 'Acercar',
	'pptx.slideSorter.zoomOut': 'Alejar',
	'pptx.slideSorter.zoom': 'Zoom',

	// Grid / ruler
	'pptx.grid.grid': 'Cuadrícula',
	'pptx.grid.toggleGrid': 'Mostrar/Ocultar cuadrícula',
	'pptx.grid.snapToGrid': 'Ajustar a la cuadrícula',
	'pptx.grid.snapToShape': 'Ajustar a la forma',
	'pptx.ruler.rulers': 'Reglas',
	'pptx.ruler.toggleRulers': 'Mostrar/Ocultar reglas',

	// Field insertion
	'pptx.field.field': 'Campo',
	'pptx.field.format': 'Formato',
	'pptx.field.insertField': 'Insertar campo',
	'pptx.field.slideNumber': 'Número de diapositiva',
	'pptx.field.dateTime': 'Fecha/Hora',
	'pptx.field.header': 'Encabezado',
	'pptx.field.footer': 'Pie de página',

	// Masters
	'pptx.master.master': 'Patrón',
	'pptx.master.layout': 'Diseño',
	'pptx.master.noMasters': 'Sin patrones',
	'pptx.master.title': 'Patrón de diapositivas',

	// Print
	'pptx.print.title': 'Imprimir',
	'pptx.print.printButton': 'Imprimir',

	// Export
	'pptx.export.processing': 'Procesando...',
	'pptx.export.cancel': 'Cancelar',

	// Version history
	'pptx.versionHistory.title': 'Historial de versiones',
	'pptx.versionHistory.noVersions': 'Sin versiones',
	'pptx.versionHistory.restore': 'Restaurar',

	// Presenter
	'pptx.presenter.speakerNotes': 'Notas del orador',
	'pptx.presenter.nextSlidePreview': 'Siguiente diapositiva',
	'pptx.presenter.noNotes': 'Sin notas para esta diapositiva',
	'pptx.presenter.endPresentation': 'Finalizar presentación',

	// Presentation mode
	'pptx.presentation.pen': 'Bolígrafo',
	'pptx.presentation.highlighter': 'Resaltador',
	'pptx.presentation.eraser': 'Borrador',
	'pptx.presentation.laserPointer': 'Puntero láser',

	// Selection pane
	'pptx.selectionPane.title': 'Panel de selección',
	'pptx.selectionPane.empty': 'Sin elementos',
	'pptx.selectionPane.show': 'Mostrar',
	'pptx.selectionPane.hide': 'Ocultar',
	'pptx.selectionPane.close': 'Cerrar',

	// Inspector
	'pptx.inspector.element': 'Elemento',
	'pptx.inspector.noSlideSelected': 'Ninguna diapositiva seleccionada',

	// Broadcast
	'pptx.broadcast.title': 'Transmitir presentación',
	'pptx.broadcast.broadcasting': 'Transmitiendo en vivo',
	'pptx.broadcast.description':
		'Inicie una transmisión en vivo para que los espectadores puedan seguir su presentación en tiempo real. Verán automáticamente la diapositiva que está presentando.',
	'pptx.broadcast.sessionName': 'Sesión de transmisión',
	'pptx.broadcast.displayName': 'Nombre del presentador',
	'pptx.broadcast.serverLabel': 'Servidor de colaboración',
	'pptx.broadcast.hint':
		'Los espectadores pueden unirse mediante el enlace mostrado tras iniciar. Seguirán sus diapositivas automáticamente.',
	'pptx.broadcast.startBroadcast': 'Iniciar transmisión',
	'pptx.broadcast.stopBroadcast': 'Detener transmisión',
	'pptx.broadcast.viewerLink': 'Enlace del espectador',
	'pptx.broadcast.copyLink': 'Copiar enlace del espectador',
	'pptx.broadcast.shareHint':
		'Comparta esta URL con su audiencia para que puedan seguir la presentación.',
	'pptx.broadcast.viewers': 'Espectadores',
	'pptx.broadcast.viewerCount': '{{count}} espectador(es)',

	// Encrypted
	'pptx.encryptedFile.title': 'Archivo cifrado',
	'pptx.encryptedFile.message': 'Este archivo está cifrado.',
	'pptx.encryptedFile.instructions': 'Introduzca la contraseña para abrirlo.',

	// Common (shared verb/label vocabulary reused across dialogs and panels)
	'common.close': 'Cerrar',
	'common.cancel': 'Cancelar',
	'common.apply': 'Aplicar',
	'common.delete': 'Eliminar',
	'common.done': 'Hecho',
	'common.loading': 'Cargando...',
	'common.ok': 'Aceptar',
	'common.remove': 'Quitar',
	'common.reset': 'Restablecer',
	'common.save': 'Guardar',
};
