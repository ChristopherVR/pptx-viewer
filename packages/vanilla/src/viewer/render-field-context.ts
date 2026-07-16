import type { PptxSlide } from 'pptx-viewer-core';
import type { FieldSubstitutionContext } from 'pptx-viewer-shared';

import type { ViewerState } from './state';

/** Build the shared text-field substitutions for a rendered slide. */
export function buildRenderFieldContext(
	state: Pick<ViewerState, 'customProperties' | 'headerFooter'>,
	slide: PptxSlide,
): FieldSubstitutionContext {
	return {
		slideNumber: slide.slideNumber,
		dateTimeText: state.headerFooter.dateTimeText,
		dateFormat: state.headerFooter.dateFormat,
		footerText: state.headerFooter.footerText,
		headerText: state.headerFooter.headerText,
		customProperties: state.customProperties.map(({ name, value }) => ({
			name,
			value: String(value),
		})),
	};
}
