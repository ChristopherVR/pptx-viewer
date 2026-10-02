import type { NotesInlineCommand, NotesParagraphCommand } from './notes';

/**
 * Shared model for the speaker-notes formatting toolbar (`pptx-ui-notes-toolbar`).
 *
 * The toolbar owns the buttons, their order, icons, labels, enabled state and
 * the hyperlink popover. Hosts own the contenteditable editor, selection-based
 * edits, history, printing and persistence, and route typed intents to them.
 */

export type NotesToolbarTranslate = (
	key: string,
	params?: Record<string, string | number>,
) => string;

/** Public button ids, in canonical order. */
export type NotesToolbarControlId =
	| 'bold'
	| 'italic'
	| 'underline'
	| 'strike'
	| 'bullet'
	| 'numbered'
	| 'indent'
	| 'outdent'
	| 'link'
	| 'print'
	| 'toggleRich';

export interface NotesToolbarViewState {
	/** True while the rich (contenteditable) surface is active. Drives the mode button label. */
	rich: boolean;
	/** Enables the formatting buttons. False in the plain editor, where they cannot act. */
	canFormat: boolean;
	/** Shows the Print button. */
	showPrint: boolean;
	/** Disables every button, for example while no slide is selected. */
	disabled?: boolean;
	/** Host translator; keys are the canonical `pptx.notes.*` set. Omitted: keys are shown. */
	translate?: NotesToolbarTranslate;
}

export type NotesToolbarIntent =
	| { kind: 'inline'; command: NotesInlineCommand }
	| { kind: 'paragraph'; command: NotesParagraphCommand }
	/** Emitted when the link popover is submitted; `url` is already normalised. */
	| { kind: 'link'; url: string; text: string }
	| { kind: 'print' }
	| { kind: 'toggle-rich' };

export const NOTES_TOOLBAR_DEFAULT_STATE: NotesToolbarViewState = {
	rich: true,
	canFormat: true,
	showPrint: true,
};
