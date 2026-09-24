/**
 * Export support for `<pptx-three-view>`.
 *
 * A 3D view draws into a 2D canvas inside the element's shadow root. Neither
 * raster export path can see it: the `foreignObject` path serialises a
 * `cloneNode(true)` copy (a clone never carries a shadow root, and a custom
 * element does not upgrade inside an SVG image), and html2canvas captures its
 * own clone of the document. Both would draw the slotted 2D fallback instead.
 *
 * So before capture every binding (1) waits for the views under the capture
 * root to settle ({@link settleThreeViews}), and (2) swaps each cloned view
 * for a light-DOM `<img>` of the live view's pixels
 * ({@link snapshotThreeViewsIntoClone}). A view that never reached `ready`
 * (no `three`, no WebGL, scene failed) keeps its 2D fallback, which is exactly
 * what the slide showed on screen.
 *
 * @module three-view/export-snapshot
 */
import { THREE_VIEW_MARKER_ATTR, THREE_VIEW_TAG } from './element';
import type { PptxThreeViewElement } from './element';
import type { ThreeViewState } from './types';

/** Longest {@link settleThreeViews} waits for a view still loading, in ms. */
export const THREE_VIEW_SETTLE_TIMEOUT_MS = 4000;

/** Attribute marking the `<img>` a snapshot left in a clone. */
export const THREE_VIEW_SNAPSHOT_ATTR = 'data-three-view-snapshot';

/** Live views, and html2canvas's `<div>` re-creations of them, carry the marker. */
const VIEW_SELECTOR = `${THREE_VIEW_TAG}, [${THREE_VIEW_MARKER_ATTR}]`;

function viewsUnder(root: ParentNode): PptxThreeViewElement[] {
	const views = [...root.querySelectorAll<HTMLElement>(VIEW_SELECTOR)];
	const self = root as Partial<Element>;
	if (typeof self.matches === 'function' && self.matches(VIEW_SELECTOR)) {
		views.unshift(root as unknown as HTMLElement);
	}
	return views as PptxThreeViewElement[];
}

function isSettled(view: PptxThreeViewElement): boolean {
	const state = (view.state ?? view.getAttribute('data-state')) as ThreeViewState | null;
	if (state === 'loading') {
		return false;
	}
	// `idle` with a spec means the element has not connected / started yet.
	return !(state === 'idle' && view.spec);
}

/**
 * Resolve once every `<pptx-three-view>` under `root` has finished loading
 * (ready, unavailable, error, or no spec), or after `timeoutMs`. Then draws
 * each ready view once so its canvas holds a current frame.
 */
export async function settleThreeViews(
	root: ParentNode,
	timeoutMs: number = THREE_VIEW_SETTLE_TIMEOUT_MS,
): Promise<void> {
	const pending = viewsUnder(root).filter((view) => !isSettled(view));
	if (pending.length > 0) {
		await new Promise<void>((resolve) => {
			const timer = setTimeout(done, timeoutMs);
			const onState = (): void => {
				if (pending.every(isSettled)) {
					done();
				}
			};
			function done(): void {
				clearTimeout(timer);
				for (const view of pending) {
					view.removeEventListener('pptx-three-state', onState);
				}
				resolve();
			}
			for (const view of pending) {
				view.addEventListener('pptx-three-state', onState);
			}
			onState();
		});
	}
	for (const view of viewsUnder(root)) {
		if (view.state === 'ready') {
			view.flush?.();
		}
	}
}

function snapshotDataUrl(view: PptxThreeViewElement): string | null {
	if (view.state !== 'ready') {
		return null;
	}
	view.flush?.();
	const canvas = view.canvas;
	if (!canvas || canvas.width === 0 || canvas.height === 0) {
		return null;
	}
	try {
		return canvas.toDataURL('image/png');
	} catch {
		// A tainted canvas (cross-origin texture) cannot be read: keep the fallback.
		return null;
	}
}

const FILL_CSS = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;';

/**
 * A light-DOM copy of the view's overlay layer: the chart chrome (title,
 * legend, axes) and projected data labels a scene draws as DOM over its
 * canvas. It lives in the shadow root, so a clone would otherwise lose it and
 * the export would show bare marks.
 */
function overlayCopy(original: PptxThreeViewElement, doc: Document): HTMLElement | null {
	const overlay = original.shadowRoot?.querySelector('.overlay');
	if (!overlay || overlay.childNodes.length === 0) {
		return null;
	}
	const copy = doc.createElement('div');
	copy.setAttribute(THREE_VIEW_SNAPSHOT_ATTR, 'overlay');
	copy.style.cssText = `${FILL_CSS}pointer-events:none;`;
	for (const child of overlay.childNodes) {
		copy.appendChild(doc.importNode(child, true));
	}
	return copy;
}

/**
 * Replace every `<pptx-three-view>` in `cloneRoot` with the live view's
 * current pixels plus a copy of its DOM overlay. `originalRoot` is the live
 * tree `cloneRoot` was cloned from; views are paired in document order, so
 * call this BEFORE anything removes nodes from the clone. Views that are not
 * ready are left alone (their slotted 2D fallback is what gets captured).
 *
 * Serves both raster paths: the `foreignObject` path passes its own
 * `cloneNode(true)` copy, and html2canvas passes the element it cloned into
 * its capture iframe (see `export/html2canvas-clone.ts`).
 */
export function snapshotThreeViewsIntoClone(originalRoot: ParentNode, cloneRoot: ParentNode): void {
	const originals = viewsUnder(originalRoot);
	const clones = viewsUnder(cloneRoot);
	const count = Math.min(originals.length, clones.length);
	for (let i = 0; i < count; i++) {
		const original = originals[i];
		const clone = clones[i] as HTMLElement;
		const url = snapshotDataUrl(original);
		if (!url) {
			continue;
		}
		const doc = clone.ownerDocument;
		const img = doc.createElement('img');
		img.setAttribute(THREE_VIEW_SNAPSHOT_ATTR, 'true');
		img.setAttribute('src', url);
		img.setAttribute('alt', '');
		img.style.cssText = FILL_CSS;
		const overlay = overlayCopy(original, doc);
		const layers: Node[] = overlay ? [img, overlay] : [img];
		clone.replaceChildren(...layers);
		// html2canvas re-creates the host as a <div> WITH a cloned shadow root,
		// which would paint instead of the light children: empty it too.
		clone.shadowRoot?.replaceChildren(...layers.map((layer) => layer.cloneNode(true)));
		// The clone never upgrades (no shadow root, no :host rule), so pin the
		// box the live element had.
		const width = (original as HTMLElement).clientWidth;
		const height = (original as HTMLElement).clientHeight;
		clone.style.display = 'block';
		clone.style.position = 'relative';
		if (width > 0 && height > 0) {
			clone.style.width = `${width}px`;
			clone.style.height = `${height}px`;
		}
	}
}
