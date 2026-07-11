import type { RemoteCursor } from 'pptx-viewer-shared';
import { formatCursorLabel } from 'pptx-viewer-shared';

import { createEl, createSvgEl, setSvgAttrs } from '../../render';

/**
 * collaboration-cursors.ts: presentational overlay that renders remote
 * collaborators' cursors above the slide stage. Vanilla port of the Vue
 * `CollaborationCursors.vue` / Angular `collaboration-cursors.component.ts`.
 *
 * Owns no network/Yjs logic: the caller supplies the live `RemoteCursor[]`
 * (from `store.get().cursors`) and the current stage scale on every
 * {@link CollaborationCursors.update} call. `x`/`y` are unscaled slide-space
 * px, matching how the selection overlay positions element boxes (see
 * `editor/selection-overlay.ts`). `pointer-events: none` throughout so the
 * overlay never intercepts stage input.
 */

export interface CollaborationCursors {
	/** Mount as a sibling of the rendered stage inside the stage wrap. */
	el: HTMLElement;
	update(cursors: readonly RemoteCursor[], scale: number): void;
	destroy(): void;
}

const POINTER_PATH = 'M0 0 L0 16 L4.5 12.5 L8 20 L10.5 19 L7 11.5 L12 11 Z';

interface CursorNode {
	root: HTMLElement;
	path: SVGPathElement;
	label: HTMLElement;
}

export function createCollaborationCursors(doc: Document): CollaborationCursors {
	const el = createEl(doc, 'div', 'pptxv-collab-cursors');
	el.setAttribute('aria-hidden', 'true');
	el.dataset.exportIgnore = 'true';

	const nodes = new Map<string | number, CursorNode>();

	function buildNode(clientId: number | string): CursorNode {
		const root = createEl(doc, 'div', 'pptxv-collab-cursor');
		root.dataset.clientId = String(clientId);
		const svg = createSvgEl(doc, 'svg', {
			width: 20,
			height: 22,
			viewBox: '0 0 20 22',
			focusable: 'false',
		});
		svg.setAttribute('class', 'pptxv-collab-pointer');
		const path = createSvgEl(doc, 'path', {
			d: POINTER_PATH,
			stroke: '#ffffff',
			'stroke-width': 1,
		});
		svg.appendChild(path);
		root.appendChild(svg);
		const label = createEl(doc, 'span', 'pptxv-collab-label');
		root.appendChild(label);
		el.appendChild(root);
		return { root, path, label };
	}

	return {
		el,
		update(cursors, scale) {
			const seen = new Set<string | number>();
			for (const cursor of cursors) {
				seen.add(cursor.clientId);
				let node = nodes.get(cursor.clientId);
				if (!node) {
					node = buildNode(cursor.clientId);
					nodes.set(cursor.clientId, node);
				}
				node.root.style.transform = `translate(${cursor.x * scale}px, ${cursor.y * scale}px)`;
				setSvgAttrs(node.path, { fill: cursor.color });
				node.label.textContent = formatCursorLabel(cursor.userName);
				node.label.style.backgroundColor = cursor.color;
			}
			for (const [clientId, node] of nodes) {
				if (!seen.has(clientId)) {
					node.root.remove();
					nodes.delete(clientId);
				}
			}
		},
		destroy() {
			el.remove();
		},
	};
}
