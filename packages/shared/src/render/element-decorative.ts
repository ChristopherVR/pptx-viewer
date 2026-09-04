/**
 * element-decorative.ts - PowerPoint's "Mark as decorative" flag (issue G16).
 *
 * Extracted from `accessibility.ts` (already over this repo's 300-line file
 * budget) so this addition doesn't grow that file further.
 */
import type { PptxElement } from 'pptx-viewer-core';

/**
 * Whether an element carries PowerPoint's "Mark as decorative" flag
 * (`p:cNvPr/a:extLst`'s `adec:decorative` vendor extension).
 *
 * A decorative element should be skipped entirely by assistive technology
 * (empty accessible name, no semantic role, `aria-hidden`), the same way
 * PowerPoint's own screen-reader and exporter behaviour treats it. An
 * actionable element (a click/hover action attached) still wins: PowerPoint's
 * own Alt Text pane disables "Mark as decorative" once an action is
 * attached, since a clickable object cannot be purely decorative.
 */
export function isElementMarkedDecorative(element: PptxElement): boolean {
	return 'isDecorative' in element && element.isDecorative === true;
}
