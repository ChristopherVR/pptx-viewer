import type { PptxElement } from 'pptx-viewer-core';

import type { ViewerMode } from '../types';
import { cloneElementForPaste } from './element-clipboard';

export interface ElementInsertionTarget {
	canEdit: boolean;
	mode: ViewerMode;
	hasActiveSlide: boolean;
	editTemplateMode: boolean;
}

/** Prepare a caller-owned model for insertion into an ordinary editable slide. */
export function prepareElementForInsertion(
	element: PptxElement,
	target: ElementInsertionTarget,
): PptxElement | undefined {
	if (
		!target.canEdit ||
		target.mode !== 'edit' ||
		!target.hasActiveSlide ||
		target.editTemplateMode
	) {
		return undefined;
	}
	return cloneElementForPaste(element, { offsetX: 0, offsetY: 0 });
}
