import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import { resolveInlineEditAutoFitHeight } from '../internal/shared';

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
