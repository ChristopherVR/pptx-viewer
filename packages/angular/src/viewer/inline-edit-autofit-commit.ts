import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import type { NormAutofitShrinkResult } from '../internal/shared';
import {
	resolveInlineEditAutoFitHeight,
	resolveInlineEditNormAutofitShrink,
} from '../internal/shared';

/**
 * The exact composition `SlideCanvasComponent#commitText` performs to decide
 * whether the just-committed element should also resize its shape
 * (`a:spAutoFit`, "Resize shape to fit text"): find the element being edited,
 * and - only when it actually carries text properties - hand its text style
 * and current height, plus the live (still-mounted) editor `<textarea>`, to
 * the shared decision.
 *
 * Split out of the component so it is directly unit-testable without
 * TestBed, matching this file's siblings (`slide-canvas-context-menu.test.ts`
 * and friends already test extracted logic rather than the component).
 */
export function resolveCommitTextAutoFitHeight(
	elements: readonly PptxElement[],
	id: string,
	editor: HTMLTextAreaElement,
): number | undefined {
	const el = elements.find((e) => e.id === id);
	if (!el || !hasTextProperties(el)) {
		return undefined;
	}
	return resolveInlineEditAutoFitHeight(el.textStyle, el.height, editor);
}

/**
 * The `a:normAutofit` ("Shrink text on overflow") counterpart of
 * {@link resolveCommitTextAutoFitHeight}: find the element being edited and,
 * when it carries text properties, hand its text style, current height and
 * the live editor `<textarea>` to the shared decision so the font
 * scale/line-spacing reduction is recomputed on commit.
 */
export function resolveCommitTextNormAutofitShrink(
	elements: readonly PptxElement[],
	id: string,
	editor: HTMLTextAreaElement,
): NormAutofitShrinkResult {
	const el = elements.find((e) => e.id === id);
	if (!el || !hasTextProperties(el)) {
		return 'unchanged';
	}
	return resolveInlineEditNormAutofitShrink(el.textStyle, el.height, editor);
}
