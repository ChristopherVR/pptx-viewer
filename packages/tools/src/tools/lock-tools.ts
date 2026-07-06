import { setElementLocked } from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';
import { validateSlideIndex } from './helpers.js';

// ── setElementLockT ──────────────────────────────────────────────────────────

export interface SetElementLockParams {
	slideIndex: number;
	elementId: string;
	locked: boolean;
	noMove?: boolean;
	noResize?: boolean;
	noRotation?: boolean;
	noSelect?: boolean;
	noTextEdit?: boolean;
}

export function setElementLockT(
	ctx: ToolContext,
	params: SetElementLockParams,
): ToolResult<{ elementId: string; locked: boolean }> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	const idx = slide.elements.findIndex((e) => e.id === params.elementId);
	if (idx < 0) {
		throw new Error(`Element '${params.elementId}' not found on slide ${params.slideIndex}.`);
	}

	const extraLocks: Record<string, boolean> = {};
	if (params.noMove !== undefined) {
		extraLocks['noMove'] = params.noMove;
	}
	if (params.noResize !== undefined) {
		extraLocks['noResize'] = params.noResize;
	}
	if (params.noRotation !== undefined) {
		extraLocks['noRotation'] = params.noRotation;
	}
	if (params.noSelect !== undefined) {
		extraLocks['noSelect'] = params.noSelect;
	}
	if (params.noTextEdit !== undefined) {
		extraLocks['noTextEdit'] = params.noTextEdit;
	}

	const updated = setElementLocked(slide.elements[idx], params.locked, extraLocks);
	slide.elements[idx] = updated;

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { elementId: params.elementId, locked: params.locked },
	};
}
