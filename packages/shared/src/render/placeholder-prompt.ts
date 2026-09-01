/**
 * placeholder-prompt.ts: whether an empty inherited placeholder's greyed-out
 * hint text ("Click to add title") should be shown, and how.
 *
 * Core resolves `element.promptText` for every empty placeholder regardless of
 * where the deck is being rendered, because the prompt is inheritance metadata,
 * not a viewer concern. Only the editor stage is meant to show it: PowerPoint
 * never prints or presents a placeholder hint, and a viewer that reused its
 * editor renderer for Present Mode leaked the hint onto the audience screen.
 * This module is the one place that decides "show it here or not", so every
 * binding's editor, present, export and thumbnail surfaces agree.
 *
 * Framework-agnostic: no React, Vue, Angular, Svelte or DOM imports.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

/**
 * The surfaces a slide can be rendered onto. Only `'edit'` ever shows a
 * placeholder prompt:
 * - `'present'`: Present Mode / slide show playback. The audience must never
 *   see an authoring hint.
 * - `'export'`: PNG/PDF/video export and print. The rendered output must match
 *   what an audience (or a printed handout) would see.
 * - `'thumbnail'`: the slide sorter / navigator rail. A blank placeholder in
 *   the thumbnail matches the blank placeholder the export produces.
 */
export type PlaceholderPromptMode = 'edit' | 'present' | 'export' | 'thumbnail';

/** The prompt text to render and the muted style to render it with. */
export interface PlaceholderPromptDescriptor {
	readonly text: string;
	readonly style: Readonly<Record<string, string>>;
}

/**
 * The muted style every binding's editor uses for placeholder prompt text.
 * Mirrors React's inline style in `text-paragraph-render.tsx`.
 */
const PLACEHOLDER_PROMPT_STYLE: Readonly<Record<string, string>> = {
	opacity: '0.5',
	color: '#888888',
	pointerEvents: 'none',
};

/**
 * Whether `element` already carries real, user-entered (or inherited-string)
 * text that should be rendered instead of the placeholder hint.
 *
 * Mirrors the check every binding's paragraph builder already makes: any
 * non-empty `textSegments` render as themselves regardless of content, and a
 * flat `text` string (the pre-segment fallback) counts too.
 */
function hasRealText(element: PptxElement): boolean {
	if (!hasTextProperties(element)) {
		return false;
	}
	if (element.textSegments && element.textSegments.length > 0) {
		return true;
	}
	return Boolean(element.text);
}

/**
 * Decide whether to show an element's inherited placeholder prompt, and with
 * what text/style, for the given render surface.
 *
 * Returns `null`:
 * - outside `'edit'` mode (Present, export, thumbnail never show the hint);
 * - when the element has no text properties at all;
 * - when the element already has real text (the hint would be redundant and,
 *   worse, would render underneath or instead of the user's own content);
 * - when core resolved no `promptText` for this element (not an empty
 *   inherited placeholder).
 */
export function placeholderPromptDescriptor(
	element: PptxElement,
	mode: PlaceholderPromptMode,
): PlaceholderPromptDescriptor | null {
	if (mode !== 'edit') {
		return null;
	}
	if (!hasTextProperties(element)) {
		return null;
	}
	if (hasRealText(element)) {
		return null;
	}
	const promptText = element.promptText;
	if (!promptText) {
		return null;
	}
	return { text: promptText, style: PLACEHOLDER_PROMPT_STYLE };
}
