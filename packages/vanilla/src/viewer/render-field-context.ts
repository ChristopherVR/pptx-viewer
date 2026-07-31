import type { PptxSlide } from 'pptx-viewer-core';
import type { FieldSubstitutionContext } from 'pptx-viewer-shared';
import { buildFieldSubstitutionContext } from 'pptx-viewer-shared';

import type { ViewerState } from './state';

/**
 * Build the OOXML field substitutions for ONE rendered slide.
 *
 * Assembly (including the `slidetitle` scan, which this binding used to omit
 * entirely, leaving title fields stuck on their authored placeholder) lives in
 * `pptx-viewer-shared` so all five bindings produce the same context; this
 * module is only the state -> shared adapter.
 *
 * Called per stage rather than once per deck: the slide number and title are
 * per-slide, so a thumbnail or an export capture must pass the slide it is
 * actually painting.
 */
export function buildRenderFieldContext(
	state: Pick<ViewerState, 'customProperties' | 'headerFooter'>,
	slide: PptxSlide,
): FieldSubstitutionContext {
	return buildFieldSubstitutionContext({
		headerFooter: state.headerFooter,
		customProperties: state.customProperties,
		slide,
	});
}
