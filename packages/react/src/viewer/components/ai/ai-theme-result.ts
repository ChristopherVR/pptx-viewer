/**
 * Detect a theme tool result that was APPLIED immediately (not staged), so the
 * transcript can render an inline "Applied: ... (Undo)" confirmation instead of
 * a generic tool card. Theme edits go straight through bridge.applyTheme, so the
 * result carries a `summary` and a `previous` snapshot for the Undo action.
 */
import type { PptxTheme } from 'pptx-viewer-core';

import type { RenderableToolPart } from './ai-message-parts';

const THEME_TOOLS = new Set(['apply_theme_preset', 'update_theme_colors', 'update_theme_fonts']);

export interface AppliedThemeInfo {
	summary: string;
	previous: Partial<PptxTheme>;
}

/** Extract applied-theme info from a tool part, or null when it is not one. */
export function appliedThemeFromPart(part: RenderableToolPart): AppliedThemeInfo | null {
	if (!THEME_TOOLS.has(part.toolName) || part.state !== 'output-available') {
		return null;
	}
	const out = part.output as
		| { applied?: boolean; summary?: string; previous?: Partial<PptxTheme> }
		| undefined;
	if (!out?.applied) {
		return null;
	}
	return { summary: out.summary ?? 'Theme updated', previous: out.previous ?? {} };
}
