/**
 * i18next configuration for the pptx-viewer demo.
 *
 * The viewer components use react-i18next for UI labels. This
 * initialises a minimal i18n instance with English translations
 * and a fallback that derives display text from dotted keys
 * (e.g. "pptx.sections.addSlide" → "Add Slide").
 */
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

const i18nInstance = createInstance();

/**
 * Convert a dotted translation key to a human-readable label.
 * Takes the last segment and converts camelCase to Title Case.
 * e.g. "pptx.slideSorter.zoomIn" → "Zoom In"
 */
function keyToLabel(key: string): string {
	const last = key.split('.').pop() ?? key;
	return last
		.replace(/(?<lower>[a-z])(?<upper>[A-Z])/gu, '$<lower> $<upper>')
		.replace(/^./u, (c) => c.toUpperCase());
}

// Build a flat English resource from every known key namespace.
// For keys we don't explicitly define, the parseMissingKeyHandler
// will derive a readable label automatically.
const en = {
	translation: {
		// Status bar
		'pptx.statusBar.allSaved': 'All saved',
		'pptx.statusBar.unsavedChanges': 'Unsaved changes',
		'pptx.statusBar.slideOf': 'Slide {{current}} of {{total}}',
		'pptx.statusBar.noSlides': 'No slides',
		'pptx.statusBar.language': 'English (U.S.)',
		'pptx.statusBar.toggleNotes': 'Toggle notes',
		'pptx.statusBar.normalView': 'Normal view',
		'pptx.statusBar.slideSorter': 'Slide sorter',
		'pptx.statusBar.slideShow': 'Slide show',
		'pptx.statusBar.zoomIn': 'Zoom in',
		'pptx.statusBar.zoomOut': 'Zoom out',
		'pptx.statusBar.zoomToFit': 'Zoom to fit',

		// Autosave
		'pptx.autosave.saving': 'Saving…',
		'pptx.autosave.saved': 'Saved {{time}}',
		'pptx.autosave.error': 'Autosave error',
		'pptx.autosave.justNow': 'just now',
		'pptx.autosave.oneMinAgo': '1 min ago',
		'pptx.autosave.minutesAgo': '{{count}} min ago',

		// Toolbar
		'pptx.toolbar.toggleSlidesPanel': 'Toggle slides panel',
		'pptx.toolbar.undo': 'Undo',
		'pptx.toolbar.undoAction': 'Undo: {{action}}',
		'pptx.toolbar.redo': 'Redo',
		'pptx.toolbar.redoAction': 'Redo: {{action}}',
		'pptx.toolbar.comments': 'Comments',
		'pptx.toolbar.share': 'Share',
		'pptx.toolbar.sharingUsers': 'Sharing — {{count}} user(s) connected',
		'pptx.toolbar.sharingCount': 'Sharing ({{count}})',
		'pptx.toolbar.toggleInspector': 'Toggle inspector panel',
		'pptx.toolbar.settingsShortcuts': 'Settings & Shortcuts',
		'pptx.toolbar.settings': 'Settings',
		'pptx.toolbar.readOnly': 'Read-only',

		// Find & Replace
		'pptx.findReplace.title': 'Find & Replace',
		'pptx.findReplace.closeEscape': 'Close (Escape)',
		'pptx.findReplace.closeAriaLabel': 'Close find and replace',
		'pptx.findReplace.findPlaceholder': 'Find…',
		'pptx.findReplace.searchText': 'Search text',
		'pptx.findReplace.matchCase': 'Match case',
		'pptx.findReplace.toggleMatchCase': 'Toggle match case',
		'pptx.findReplace.previousMatch': 'Previous match',
		'pptx.findReplace.nextMatch': 'Next match',
		'pptx.findReplace.replacePlaceholder': 'Replace with…',
		'pptx.findReplace.replacementText': 'Replacement text',
		'pptx.findReplace.replaceCurrent': 'Replace current match',
		'pptx.findReplace.replace': 'Replace',
		'pptx.findReplace.replaceAllMatches': 'Replace all matches',
		'pptx.findReplace.replaceAll': 'Replace All',
		'pptx.findReplace.matchCount': '{{current}} of {{total}}',
		'pptx.findReplace.noMatches': 'No matches',

		// Arrange
		'pptx.arrange.align': 'Align {{direction}}',
		'pptx.arrange.copy': 'Copy',
		'pptx.arrange.cut': 'Cut',
		'pptx.arrange.paste': 'Paste',
		'pptx.arrange.formatPainter': 'Format Painter',
		'pptx.arrange.format': 'Format',
		'pptx.arrange.flipHorizontally': 'Flip horizontally',
		'pptx.arrange.flipH': 'Flip H',
		'pptx.arrange.flipVertically': 'Flip vertically',
		'pptx.arrange.flipV': 'Flip V',
		'pptx.arrange.sendBackward': 'Send backward',
		'pptx.arrange.bringForward': 'Bring forward',
		'pptx.arrange.sendToBack': 'Send to back',
		'pptx.arrange.back': 'Back',
		'pptx.arrange.bringToFront': 'Bring to front',
		'pptx.arrange.front': 'Front',
		'pptx.arrange.duplicate': 'Duplicate',
		'pptx.arrange.delete': 'Delete',

		// Accessibility
		'pptx.accessibility.title': 'Accessibility Checker',
		'pptx.accessibility.issueCount': '{{count}} issue(s)',
		'pptx.accessibility.closePanel': 'Close accessibility panel',
		'pptx.accessibility.close': 'Close',
		'pptx.accessibility.reduceMotion': 'Reduce motion',
		'pptx.accessibility.issuesList': 'Accessibility issues',
		'pptx.accessibility.noIssues': 'No accessibility issues found.',
		'pptx.accessibility.error': 'Error: ',
		'pptx.accessibility.warning': 'Warning: ',
		'pptx.accessibility.info': 'Info: ',

		// Animations
		'pptx.animations.previewTooltip': 'Preview animation on selected element',
		'pptx.animations.preview': 'Preview',
		'pptx.animations.addTooltip': 'Add animation to selected element',
		'pptx.animations.addAnimation': 'Add Animation',
		'pptx.animations.group.entrance': 'Entrance',
		'pptx.animations.group.emphasis': 'Emphasis',
		'pptx.animations.group.exit': 'Exit',
		'pptx.animations.preset.appear': 'Appear',
		'pptx.animations.preset.fadeIn': 'Fade In',
		'pptx.animations.preset.flyIn': 'Fly In',
		'pptx.animations.preset.pulse': 'Pulse',
		'pptx.animations.preset.spin': 'Spin',
		'pptx.animations.preset.disappear': 'Disappear',
		'pptx.animations.preset.fadeOut': 'Fade Out',
		'pptx.animations.applyAnimation': 'Apply {{name}} animation',
		'pptx.animations.removeTooltip': 'Remove animation from selected element',
		'pptx.animations.remove': 'Remove',
		'pptx.animations.openPanelTooltip': 'Open Animation Panel in Inspector',
		'pptx.animations.animationPanel': 'Animation Panel',

		// Comments
		'pptx.comments.addComment': 'Add Comment',
		'pptx.comments.noComments': 'No comments',
		'pptx.comments.author': 'Author',
		'pptx.comments.resolved': 'Resolved',
		'pptx.comments.clickToSelect': 'Click to select element',
		'pptx.comments.deletedElement': 'Deleted element',
		'pptx.comments.save': 'Save',
		'pptx.comments.cancel': 'Cancel',
		'pptx.comments.edit': 'Edit',
		'pptx.comments.reply': 'Reply',
		'pptx.comments.resolve': 'Resolve',
		'pptx.comments.unresolve': 'Unresolve',
		'pptx.comments.delete': 'Delete',
		'pptx.comments.commentingOn': 'Commenting on:',
		'pptx.comments.commentOnElement': 'Comment on {{element}}...',
		'pptx.comments.addCommentPlaceholder': 'Add a comment...',

		// Header & Footer
		'pptx.headerFooter.title': 'Header & Footer',
		'pptx.headerFooter.close': 'Close',
		'pptx.headerFooter.dateAndTime': 'Date and time',
		'pptx.headerFooter.slideNumber': 'Slide number',
		'pptx.headerFooter.footer': 'Footer',
		'pptx.headerFooter.footerPlaceholder': 'Enter footer text…',
		'pptx.headerFooter.applyToAll': 'Apply to All',
		'pptx.headerFooter.applyToCurrent': 'Apply to Current',

		// Collaboration
		'pptx.collaboration.status.connected': 'Connected',
		'pptx.collaboration.status.connecting': 'Connecting...',
		'pptx.collaboration.status.disconnected': 'Disconnected',
		'pptx.collaboration.status.error': 'Connection error',
		'pptx.collaboration.statusAriaLabel': 'Collaboration: {{status}}. {{count}} user(s) connected.',
		'pptx.collaboration.userCount': '{{count}} user(s)',
		'pptx.collaboration.youLabel': '{{name}} (you)',
		'pptx.collaboration.usersConnected': '{{count}} user(s) connected',
		'pptx.collaboration.moreUsers': '{{count}} more user(s)',
		'pptx.collaboration.retry': 'Retry',

		// Share dialog
		'pptx.share.title': 'Share Presentation',
		'pptx.share.collaborationActive': 'Collaboration Active',
		'pptx.share.closeDialog': 'Close dialog',
		'pptx.share.close': 'Close',
		'pptx.share.cancel': 'Cancel',
		'pptx.share.startSharing': 'Start Sharing',
		'pptx.share.stopSharing': 'Stop Sharing',
		'pptx.share.description':
			'Share this presentation for real-time collaboration. Other users can join using the session name to edit together with live cursors and synchronized changes.',
		'pptx.share.preconfiguredDescription':
			'Your administrator has configured collaboration settings.',
		'pptx.share.sessionName': 'Session Name',
		'pptx.share.sessionPlaceholder': 'e.g. session-abc123',
		'pptx.share.sessionHint':
			'Alphanumeric, hyphens, and underscores only. Share this name with collaborators.',
		'pptx.share.displayName': 'Your Display Name',
		'pptx.share.namePlaceholder': 'e.g. Alice',
		'pptx.share.serverLabel': 'Collaboration Server',
		'pptx.share.serverPlaceholder': 'wss://collab.example.com',
		'pptx.share.shareLink': 'Share Link',
		'pptx.share.copyLink': 'Copy share link',
		'pptx.share.copied': 'Copied',
		'pptx.share.copyUrl': 'Copy URL',
		'pptx.share.shareHint': 'Share this URL with others so they can join the session.',
		'pptx.share.room': 'Room:',
		'pptx.share.server': 'Server:',
		'pptx.share.connectedUsers': 'Connected Users',
		'pptx.share.you': '(you)',

		// Settings dialog
		'pptx.settings.title': 'Settings',
		'pptx.settings.general': 'General',
		'pptx.settings.keyboardShortcuts': 'Keyboard Shortcuts',
		'pptx.settings.closeSettings': 'Close settings',
		'pptx.settings.close': 'Close',
		'pptx.settings.autoSave': 'Auto-save',
		'pptx.settings.spellCheck': 'Spell check',
		'pptx.settings.showGrid': 'Show grid',
		'pptx.settings.showRulers': 'Show rulers',
		'pptx.settings.snapToGrid': 'Snap to grid',
		'pptx.settings.reducedMotion': 'Reduced motion',

		// Sections / slides pane
		'pptx.sections.slides': 'Slides',
		'pptx.sections.collapsePane': 'Collapse pane',
		'pptx.sections.addSlide': 'Add Slide',
		'pptx.sections.addSection': 'Add Section',
		'pptx.sections.defaultName': 'Untitled Section',
		'pptx.sections.rename': 'Rename',
		'pptx.sections.delete': 'Delete',
		'pptx.sections.moveUp': 'Move Up',
		'pptx.sections.moveDown': 'Move Down',
		'pptx.sections.addBefore': 'Add Section Before',
		'pptx.sections.addAfter': 'Add Section After',

		// Notes
		'pptx.notes.title': 'Notes',
		'pptx.notes.slideN': 'Slide {{n}}',
		'pptx.notes.noSlide': 'No slide selected',
		'pptx.notes.clickToAddNotes': 'Click to add notes',
		'pptx.notes.noNotes': 'No notes',

		// Slide sorter
		'pptx.slideSorter.title': 'Slide Sorter',
		'pptx.slideSorter.selectedCount': '{{count}} selected',
		'pptx.slideSorter.slideCount': '{{count}} slides',
		'pptx.slideSorter.close': 'Close',
		'pptx.slideSorter.zoomIn': 'Zoom In',
		'pptx.slideSorter.zoomOut': 'Zoom Out',
		'pptx.slideSorter.zoom': 'Zoom',

		// Grid / ruler
		'pptx.grid.grid': 'Grid',
		'pptx.grid.toggleGrid': 'Toggle Grid',
		'pptx.grid.snapToGrid': 'Snap to Grid',
		'pptx.grid.snapToShape': 'Snap to Shape',
		'pptx.ruler.rulers': 'Rulers',
		'pptx.ruler.toggleRulers': 'Toggle Rulers',

		// Field insertion
		'pptx.field.field': 'Field',
		'pptx.field.insertField': 'Insert Field',
		'pptx.field.slideNumber': 'Slide Number',
		'pptx.field.dateTime': 'Date/Time',
		'pptx.field.header': 'Header',
		'pptx.field.footer': 'Footer',

		// Masters
		'pptx.master.master': 'Master',
		'pptx.master.layout': 'Layout',
		'pptx.master.noMasters': 'No masters',
		'pptx.master.title': 'Slide Master',

		// Print
		'pptx.print.title': 'Print',
		'pptx.print.printButton': 'Print',

		// Export
		'pptx.export.processing': 'Processing…',
		'pptx.export.cancel': 'Cancel',

		// Version history
		'pptx.versionHistory.title': 'Version History',
		'pptx.versionHistory.noVersions': 'No versions',
		'pptx.versionHistory.restore': 'Restore',

		// Presenter
		'pptx.presenter.speakerNotes': 'Speaker Notes',
		'pptx.presenter.nextSlidePreview': 'Next Slide',
		'pptx.presenter.noNotes': 'No notes for this slide',
		'pptx.presenter.endPresentation': 'End Presentation',

		// Presentation mode
		'pptx.presentation.pen': 'Pen',
		'pptx.presentation.highlighter': 'Highlighter',
		'pptx.presentation.eraser': 'Eraser',
		'pptx.presentation.laserPointer': 'Laser Pointer',

		// Selection pane
		'pptx.selectionPane.title': 'Selection Pane',
		'pptx.selectionPane.empty': 'No elements',
		'pptx.selectionPane.show': 'Show',
		'pptx.selectionPane.hide': 'Hide',
		'pptx.selectionPane.close': 'Close',

		// Inspector
		'pptx.inspector.element': 'Element',
		'pptx.inspector.noSlideSelected': 'No slide selected',

		// Broadcast
		'pptx.broadcast.title': 'Broadcast Slide Show',
		'pptx.broadcast.broadcasting': 'Broadcasting Live',
		'pptx.broadcast.description':
			'Start a live broadcast so viewers can follow your presentation in real-time. Viewers will automatically see the slide you are presenting.',
		'pptx.broadcast.sessionName': 'Broadcast Session',
		'pptx.broadcast.displayName': 'Presenter Name',
		'pptx.broadcast.serverLabel': 'Collaboration Server',
		'pptx.broadcast.hint':
			'Viewers can join using the link shown after starting. They will follow your slides automatically.',
		'pptx.broadcast.startBroadcast': 'Start Broadcast',
		'pptx.broadcast.stopBroadcast': 'Stop Broadcast',
		'pptx.broadcast.viewerLink': 'Viewer Link',
		'pptx.broadcast.copyLink': 'Copy viewer link',
		'pptx.broadcast.shareHint': 'Share this URL with your audience so they can follow along.',
		'pptx.broadcast.viewers': 'Viewers',
		'pptx.broadcast.viewerCount': '{{count}} viewer(s)',

		// Encrypted
		'pptx.encryptedFile.title': 'Encrypted File',
		'pptx.encryptedFile.message': 'This file is encrypted.',
		'pptx.encryptedFile.instructions': 'Enter the password to open it.',
	},
};

i18nInstance.use(initReactI18next).init({
	resources: { en },
	lng: 'en',
	fallbackLng: 'en',
	interpolation: {
		escapeValue: false, // React already escapes
	},
	// For any key not explicitly defined, derive display text from the key
	parseMissingKeyHandler: (key: string) => keyToLabel(key),
	// Suppress "missing key" warnings in console
	missingKeyHandler: false,
});

export default i18nInstance;
