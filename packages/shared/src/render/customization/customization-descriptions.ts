/**
 * One-line English descriptions for the customisation ids that have no UI
 * label of their own (panels, features, dialogs, toolbar buttons, shortcut
 * commands). Used by the generated docs reference; the `Record` types make a
 * missing description a compile error.
 *
 * @module render/customization/customization-descriptions
 */
import type { EditorKeyActionName } from '../editor-keymap';
import type { ToolbarButtonId } from '../toolbar-actions';
import type {
	ViewerDialogId,
	ViewerExportFormatId,
	ViewerFeatureId,
	ViewerPanelId,
} from './customization-types';

export const TOOLBAR_BUTTON_DESCRIPTIONS: Record<ToolbarButtonId, string> = {
	share: 'Share / collaboration button in the tab row and mobile toolbar.',
	broadcast: 'Broadcast (present online) button.',
	export: 'Export button and the File > Export page.',
	undo: 'Undo button in the quick-access strip.',
	redo: 'Redo button in the quick-access strip.',
	record: 'Record button and the Record ribbon tab.',
	notes: 'Notes toggle in the status bar.',
	fullscreen: 'Full-screen toggle.',
	zoom: 'The zoom cluster (zoom in, zoom out, fit).',
	navigation: 'The previous / next slide cluster.',
};

export const VIEWER_PANEL_DESCRIPTIONS: Record<ViewerPanelId, string> = {
	statusBar: 'The status bar under the canvas (slide counter, zoom, view buttons).',
	slidesPane: 'The slide thumbnail rail on the left.',
	inspector: 'The format / properties inspector on the right.',
	notes: 'The speaker-notes panel under the canvas.',
	quickAccessToolbar: 'The quick-access strip in the title bar (save, undo, redo, ...).',
	titleBar: 'The title bar above the ribbon (file name, quick access, account).',
};

export const VIEWER_FEATURE_DESCRIPTIONS: Record<ViewerFeatureId, string> = {
	ai: 'The AI assistant: toolbar toggle, chat panel, AI context-menu entries, AI Options page.',
	collaboration: 'Real-time collaboration: Share and Broadcast buttons, dialogs and File pages.',
	comments: 'Commenting: the Add Comment context-menu entry.',
	presentMode: 'Slide-show entry points: the Slide Show ribbon tab.',
	editPoints:
		'Edit Points: the Edit Points context-menu entry and the point-editing mode it opens.',
};

export const VIEWER_DIALOG_DESCRIPTIONS: Record<ViewerDialogId, string> = {
	options: 'File > Options (the Settings dialog) and the File tab entry that opens it.',
	share: 'The Share dialog, its toolbar button, File > Share page and card.',
	broadcast: 'The Broadcast dialog and its button.',
	print: 'The Print dialog, File > Print page and card.',
	export: 'File > Export page, its cards and the Export button.',
};

export const VIEWER_EXPORT_FORMAT_DESCRIPTIONS: Record<ViewerExportFormatId, string> = {
	pdf: 'Export to PDF.',
	png: 'Export the current slide as PNG.',
	video: 'Export the deck as a video.',
	gif: 'Export the deck as an animated GIF.',
	json: 'Export the parsed deck as JSON.',
	copyImage: 'Copy the current slide to the clipboard as an image.',
};

export const EDITOR_SHORTCUT_DESCRIPTIONS: Record<EditorKeyActionName, string> = {
	undo: 'Undo (Ctrl/Cmd+Z).',
	redo: 'Redo (Ctrl/Cmd+Y, Ctrl/Cmd+Shift+Z).',
	copy: 'Copy the selection (Ctrl/Cmd+C).',
	cut: 'Cut the selection (Ctrl/Cmd+X).',
	paste: 'Paste (Ctrl/Cmd+V).',
	duplicate: 'Duplicate the selection (Ctrl/Cmd+D).',
	delete: 'Delete the selection (Delete, Backspace).',
	selectAll: 'Select every element on the slide (Ctrl/Cmd+A).',
	group: 'Group the selection (Ctrl/Cmd+G).',
	ungroup: 'Ungroup (Ctrl/Cmd+Shift+G).',
	nudge: 'Move the selection with the arrow keys (disable only; not remappable).',
	prevSlide: 'Previous slide (ArrowLeft with nothing selected).',
	nextSlide: 'Next slide (ArrowRight with nothing selected).',
	escape: 'Escape: leave the current mode (disable only; not remappable).',
	find: 'Find (Ctrl/Cmd+F).',
	findReplace: 'Find and replace (Ctrl/Cmd+H).',
	toggleShortcuts: 'Keyboard-shortcut reference (?, Ctrl/Cmd+/).',
	alignLeft: 'Align text left (Ctrl/Cmd+L).',
	alignCenter: 'Center text (Ctrl/Cmd+E).',
	alignRight: 'Align text right (Ctrl/Cmd+R).',
	alignJustify: 'Justify text (Ctrl/Cmd+J).',
	increaseFontSize: 'Increase font size (Ctrl/Cmd+Shift+>).',
	decreaseFontSize: 'Decrease font size (Ctrl/Cmd+Shift+<).',
	copyFormat: 'Copy formatting (Ctrl/Cmd+Shift+C).',
	pasteFormat: 'Paste formatting (Ctrl/Cmd+Shift+V).',
	newSlide: 'New slide (Ctrl/Cmd+M).',
	hyperlink: 'Insert or edit a hyperlink (Ctrl/Cmd+K).',
	clearFormatting: 'Clear character formatting (Ctrl/Cmd+Space).',
	cycleSelectionNext: 'Select the next element (Tab).',
	cycleSelectionPrev: 'Select the previous element (Shift+Tab).',
	pasteSpecial: 'Paste Special (Ctrl/Cmd+Alt+V).',
};
