import type { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import type { PptxElement } from 'pptx-viewer-core';

import { getBevelLightingFilterDef } from './element-effect-defs';

/** Injectable bevel lighting `<filter>` descriptor: id + sanitized markup. */
export interface BevelLightingFilterDef {
	id: string;
	markup: SafeHtml;
}

/**
 * Resolve {@link BevelLightingFilterDef} for an element's `a:sp3d` bevel(s),
 * or `undefined` when it has neither a top nor a bottom bevel.
 *
 * Sanitizes the shared module's raw `filterMarkup` via `DomSanitizer` so the
 * template's `[innerHTML]` binding can render it: the FULL `<filter
 * id="…">…</filter>` element, unlike the fixed-shape soft-edge/duotone
 * filters the template hand-authors from typed fields. See
 * `getBevelLightingFilterDef`'s doc (`element-effect-defs.ts`) for why this
 * one injects raw markup instead.
 */
export function resolveBevelLightingFilter(
	element: PptxElement,
	sanitizer: DomSanitizer,
): BevelLightingFilterDef | undefined {
	const def = getBevelLightingFilterDef(element);
	return def
		? { id: def.id, markup: sanitizer.bypassSecurityTrustHtml(def.filterMarkup) }
		: undefined;
}
