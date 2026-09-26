import type { PptxThreeViewElement, ThreeViewSpec } from 'pptx-viewer-shared';
import { THREE_VIEW_TAG } from 'pptx-viewer-shared';

/**
 * Carry live `<pptx-three-view>`s across a stage rebuild.
 *
 * The Vanilla viewer rebuilds its whole stage DOM on every store change, and
 * an editor drag changes the store on every pointer move. A 3D chart or
 * SmartArt used to get a brand-new view each time, which reloaded its scene
 * (`loading` -> `ready`) dozens of times per drag and flickered blank. The
 * render controller now collects the outgoing stage's views, keyed by spec
 * (a position-only change keeps the spec, see `view-spec.ts` in shared), and
 * `mountThreeViewInto` takes a matching one instead of creating a new view.
 * The element keeps its scene when it is detached and re-attached within the
 * same task (`three-view/element.ts`).
 *
 * @module three-view-reuse
 */

let pool: Map<ThreeViewSpec, PptxThreeViewElement> | null = null;

/** The live views under `root`, keyed by their spec. */
export function collectThreeViews(root: ParentNode): Map<ThreeViewSpec, PptxThreeViewElement> {
	const views = new Map<ThreeViewSpec, PptxThreeViewElement>();
	for (const view of root.querySelectorAll<PptxThreeViewElement>(THREE_VIEW_TAG)) {
		if (view.spec && !views.has(view.spec)) {
			views.set(view.spec, view);
		}
	}
	return views;
}

/** Run `render` with `views` available to {@link takeReusableThreeView}. */
export function withReusableThreeViews<T>(
	views: Map<ThreeViewSpec, PptxThreeViewElement>,
	render: () => T,
): T {
	const previous = pool;
	pool = views;
	try {
		return render();
	} finally {
		pool = previous;
	}
}

/** Take (once) the outgoing stage's view for `spec`, if there is one. */
export function takeReusableThreeView(spec: ThreeViewSpec): PptxThreeViewElement | null {
	const view = pool?.get(spec) ?? null;
	if (view) {
		pool?.delete(spec);
	}
	return view;
}
