import type { PptxData } from 'pptx-viewer-core';

import type { EditorState } from '../editor/editor-state.svelte';
import type { PresentationLoader } from './presentation-loader.svelte';

/**
 * Assemble the live {@link PptxData} for the deck-JSON export (the "Export as
 * JSON" backstage card). Reads come off the same seams the AI bridge's deck
 * tools use: undoable document state from the editor, parse-time presentation
 * parts from the loader.
 */
export function buildDeckExportData(editor: EditorState, loader: PresentationLoader): PptxData {
	return {
		slides: editor.slides,
		width: loader.canvasSize.width,
		height: loader.canvasSize.height,
		theme: loader.presentationTheme,
		themeOptions: loader.themeOptions,
		tableStyleMap: loader.tableStyleMap,
		slideMasters: loader.slideMasters,
		notesMaster: loader.notesMaster,
		handoutMaster: loader.handoutMaster,
		embeddedFonts: loader.embeddedFonts,
		hasMacros: loader.hasMacros,
		hasDigitalSignatures: loader.hasDigitalSignatures,
		digitalSignatureCount: loader.digitalSignatureCount,
		isPasswordProtected: loader.isPasswordProtected,
		headerFooter: editor.headerFooter,
		presentationProperties: editor.presentationProperties,
		customShows: editor.customShows,
		sections: editor.sections,
		tags: editor.tagCollections,
		customProperties: editor.customProperties,
		coreProperties: editor.coreProperties,
		appProperties: editor.appProperties,
	};
}
