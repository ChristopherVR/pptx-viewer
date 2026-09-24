/**
 * The Ctrl/Cmd chord tables for {@link ../render/editor-keymap}: clipboard/history
 * (undo, copy, paste, duplicate, group, new slide, ...) and PowerPoint's text
 * commands (paragraph alignment, font-size ladder, format painter, hyperlink
 * dialog, clear-character-formatting), plus Ctrl/Cmd+B/I/U.
 *
 * Split into its own module purely to keep `editor-keymap.ts` under this
 * repo's file-size limit; the modules are one logical unit and
 * `editor-keymap.ts` is where their combined behaviour is documented and
 * tested.
 *
 * @module render/editor-keymap-chords
 */

import type { EditorKeyInput, EditorKeyResult } from './editor-keymap';

/**
 * Resolve a plain Ctrl/Cmd chord (clipboard, history, selection, grouping,
 * new slide): the commands that stay gated behind `mapEditorKey`'s typing
 * gate, unlike {@link resolveLiveFormatChord}'s text commands.
 */
export function resolveChord(
	key: string,
	shiftKey: boolean,
	hasSelection: boolean,
): EditorKeyResult | null {
	switch (key.toLowerCase()) {
		case 'z':
			return { action: shiftKey ? 'redo' : 'undo' };
		case 'y':
			return { action: 'redo' };
		case 'c':
			return hasSelection ? { action: 'copy' } : null;
		case 'x':
			return hasSelection ? { action: 'cut' } : null;
		case 'v':
			return { action: 'paste' };
		case 'd':
			return hasSelection ? { action: 'duplicate' } : null;
		case 'a':
			return { action: 'selectAll' };
		case 'g':
			// Shift+Ctrl+G is PowerPoint's ungroup; both need something selected.
			return hasSelection ? { action: shiftKey ? 'ungroup' : 'group' } : null;
		case 'm':
			return { action: 'newSlide' };
		default:
			return null;
	}
}

/**
 * Resolve the Ctrl/Cmd chords that must survive `mapEditorKey`'s typing
 * gate: paragraph alignment, PowerPoint's font-size ladder, format painter
 * copy/paste, the hyperlink dialog and clear-character-formatting. Kept
 * separate from {@link resolveChord} because the caller applies a different,
 * narrower guard to whatever this returns (see `mapEditorKey`).
 *
 * The `>`/`<` cases also match the unshifted `.`/`,` so a layout or synthetic
 * event that reports the base key (rather than the shifted glyph) still
 * resolves, as long as `shiftKey` is set; `]`/`[` need no Shift at all,
 * PowerPoint's second, single-key spelling of the same two commands.
 */
export function resolveLiveFormatChord(key: string, shiftKey: boolean): EditorKeyResult | null {
	switch (key) {
		case '>':
		case '.':
			return shiftKey ? { action: 'increaseFontSize' } : null;
		case '<':
		case ',':
			return shiftKey ? { action: 'decreaseFontSize' } : null;
		case ']':
			return { action: 'increaseFontSize' };
		case '[':
			return { action: 'decreaseFontSize' };
		default:
			break;
	}
	switch (key.toLowerCase()) {
		case 'l':
			return { action: 'alignLeft' };
		case 'e':
			return { action: 'alignCenter' };
		case 'r':
			return { action: 'alignRight' };
		case 'j':
			return { action: 'alignJustify' };
		case 'k':
			return { action: 'hyperlink' };
		case ' ':
			return { action: 'clearFormatting' };
		case 'c':
			return shiftKey ? { action: 'copyFormat' } : null;
		case 'v':
			return shiftKey ? { action: 'pasteFormat' } : null;
		default:
			return null;
	}
}

// ---------------------------------------------------------------------------
// Inline text formatting (bold / italic / underline)
// ---------------------------------------------------------------------------

/** A character-level formatting property toggled by Ctrl/Cmd+B/I/U. */
export type InlineTextFormatProperty = 'bold' | 'italic' | 'underline';

/**
 * Resolve Ctrl/Cmd+B/I/U while text is under active edit.
 *
 * This is deliberately NOT part of `mapEditorKey`: that map's typing gate
 * exists precisely to keep shortcuts out of text fields, while
 * bold/italic/underline are exactly the shortcuts a user reaches for with the
 * caret already inside a run of text, so a host calls this directly from its
 * inline text editor's own key handler instead. React, Vue and Angular each
 * hand-derived this same three-way switch inside their inline text editors;
 * it lives here once so Svelte, Vanilla and any future binding do not
 * hand-port it a fourth and fifth time.
 */
export function mapInlineTextFormatKey(input: EditorKeyInput): InlineTextFormatProperty | null {
	if (!(input.ctrlKey || input.metaKey) || input.shiftKey || input.altKey) {
		return null;
	}
	switch (input.key.toLowerCase()) {
		case 'b':
			return 'bold';
		case 'i':
			return 'italic';
		case 'u':
			return 'underline';
		default:
			return null;
	}
}
