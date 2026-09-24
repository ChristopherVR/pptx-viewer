/**
 * JSX intrinsic-element typing for `<pptx-three-view>` (defined by
 * `defineThreeViewElement()` in `packages/shared/src/three-view/element.ts`).
 *
 * Declares only that the tag exists and what DOM element its `ref` resolves
 * to; the element's own properties (`spec`, `interactive`, `selectedPart`,
 * `textStyle`) are set imperatively by `ThreeView.tsx`, not passed as JSX
 * attributes (a custom element only reflects string/boolean attributes, not
 * arbitrary objects). This keeps the JSX usage in `ThreeView.tsx` free of an
 * `any`/`as` escape hatch.
 */
import type { PptxThreeViewElement } from 'pptx-viewer-shared';
import type * as React from 'react';

declare module 'react' {
	namespace JSX {
		interface IntrinsicElements {
			'pptx-three-view': React.DetailedHTMLProps<
				React.HTMLAttributes<PptxThreeViewElement>,
				PptxThreeViewElement
			>;
		}
	}
}
