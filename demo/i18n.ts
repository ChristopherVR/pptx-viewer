/**
 * i18next configuration for the pptx-viewer demo.
 *
 * The viewer components use react-i18next for UI labels. This
 * initialises a minimal i18n instance with English translations
 * and a fallback that derives display text from dotted keys
 * (e.g. "pptx.sections.addSlide" → "Add Slide").
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

/**
 * Convert a dotted translation key to a human-readable label.
 * Takes the last segment and converts camelCase to Title Case.
 * e.g. "pptx.slideSorter.zoomIn" → "Zoom In"
 */
function keyToLabel(key: string): string {
	const last = key.split(".").pop() ?? key;
	return last
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/^./, (c) => c.toUpperCase());
}

// Build a flat English resource from every known key namespace.
// For keys we don't explicitly define, the parseMissingKeyHandler
// will derive a readable label automatically.
const en = {
	translation: {
		// Status bar
		"pptx.statusBar.allSaved": "All saved",
		"pptx.statusBar.unsavedChanges": "Unsaved changes",

		// Autosave
		"pptx.autosave.saving": "Saving…",
		"pptx.autosave.saved": "Saved {{time}}",
		"pptx.autosave.error": "Autosave error",

		// Sections / slides pane
		"pptx.sections.slides": "Slides",
		"pptx.sections.collapsePane": "Collapse pane",
		"pptx.sections.addSlide": "Add Slide",
		"pptx.sections.addSection": "Add Section",
		"pptx.sections.defaultName": "Untitled Section",
		"pptx.sections.rename": "Rename",
		"pptx.sections.delete": "Delete",
		"pptx.sections.moveUp": "Move Up",
		"pptx.sections.moveDown": "Move Down",
		"pptx.sections.addBefore": "Add Section Before",
		"pptx.sections.addAfter": "Add Section After",

		// Notes
		"pptx.notes.title": "Notes",
		"pptx.notes.slideN": "Slide {{n}}",
		"pptx.notes.noSlide": "No slide selected",
		"pptx.notes.clickToAddNotes": "Click to add notes",
		"pptx.notes.noNotes": "No notes",

		// Slide sorter
		"pptx.slideSorter.title": "Slide Sorter",
		"pptx.slideSorter.selectedCount": "{{count}} selected",
		"pptx.slideSorter.slideCount": "{{count}} slides",
		"pptx.slideSorter.close": "Close",
		"pptx.slideSorter.zoomIn": "Zoom In",
		"pptx.slideSorter.zoomOut": "Zoom Out",
		"pptx.slideSorter.zoom": "Zoom",

		// Grid / ruler
		"pptx.grid.grid": "Grid",
		"pptx.grid.toggleGrid": "Toggle Grid",
		"pptx.grid.snapToGrid": "Snap to Grid",
		"pptx.grid.snapToShape": "Snap to Shape",
		"pptx.ruler.rulers": "Rulers",
		"pptx.ruler.toggleRulers": "Toggle Rulers",

		// Field insertion
		"pptx.field.field": "Field",
		"pptx.field.insertField": "Insert Field",
		"pptx.field.slideNumber": "Slide Number",
		"pptx.field.dateTime": "Date/Time",
		"pptx.field.header": "Header",
		"pptx.field.footer": "Footer",

		// Masters
		"pptx.master.master": "Master",
		"pptx.master.layout": "Layout",
		"pptx.master.noMasters": "No masters",
		"pptx.master.title": "Slide Master",

		// Print
		"pptx.print.title": "Print",
		"pptx.print.printButton": "Print",

		// Export
		"pptx.export.processing": "Processing…",
		"pptx.export.cancel": "Cancel",

		// Version history
		"pptx.versionHistory.title": "Version History",
		"pptx.versionHistory.noVersions": "No versions",
		"pptx.versionHistory.restore": "Restore",

		// Presenter
		"pptx.presenter.speakerNotes": "Speaker Notes",
		"pptx.presenter.nextSlidePreview": "Next Slide",
		"pptx.presenter.noNotes": "No notes for this slide",
		"pptx.presenter.endPresentation": "End Presentation",

		// Presentation mode
		"pptx.presentation.pen": "Pen",
		"pptx.presentation.highlighter": "Highlighter",
		"pptx.presentation.eraser": "Eraser",
		"pptx.presentation.laserPointer": "Laser Pointer",

		// Selection pane
		"pptx.selectionPane.title": "Selection Pane",
		"pptx.selectionPane.empty": "No elements",
		"pptx.selectionPane.show": "Show",
		"pptx.selectionPane.hide": "Hide",
		"pptx.selectionPane.close": "Close",

		// Inspector
		"pptx.inspector.element": "Element",
		"pptx.inspector.noSlideSelected": "No slide selected",

		// Comments
		"pptx.comments.addComment": "Add Comment",
		"pptx.comments.noComments": "No comments",

		// Encrypted
		"pptx.encryptedFile.title": "Encrypted File",
		"pptx.encryptedFile.message": "This file is encrypted.",
		"pptx.encryptedFile.instructions": "Enter the password to open it.",
	},
};

i18n.use(initReactI18next).init({
	resources: { en },
	lng: "en",
	fallbackLng: "en",
	interpolation: {
		escapeValue: false, // React already escapes
	},
	// For any key not explicitly defined, derive display text from the key
	parseMissingKeyHandler: (key: string) => keyToLabel(key),
	// Suppress "missing key" warnings in console
	missingKeyHandler: false,
});

export default i18n;
