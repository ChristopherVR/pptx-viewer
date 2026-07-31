import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import type { CssStyleMap } from 'pptx-viewer-shared';
import { DEFAULT_TEXT_COLOR, buildTextBlockStyle } from 'pptx-viewer-shared';

/**
 * Text-block style for elements that carry text.
 *
 * A thin adapter over the shared {@link buildTextBlockStyle}, which React
 * renders from too. This used to be a hand-ported copy of React's builder, and
 * the copy had silently lost `a:normAutofit` (a shrink-to-fit title painted 43%
 * too large), `a:bodyPr/@wrap="none"` (a no-wrap line wrapped to three), the
 * default font declaration, the italic padding nudge and the body
 * margin/indent pair.
 *
 * `bodyLayout` adds the flex-column body box + the `a:bodyPr/@anchor`
 * justification this binding folds into the same element (React composes them
 * separately); `pxLengths` is required because the style string is serialised
 * verbatim and a bare number is not a CSS length.
 */
export function getTextBlockStyle(el: PptxElement): CssStyleMap {
	if (!hasTextProperties(el)) {
		return {};
	}
	return buildTextBlockStyle(el, {
		fallbackColor: DEFAULT_TEXT_COLOR,
		bodyLayout: true,
		pxLengths: true,
	});
}
