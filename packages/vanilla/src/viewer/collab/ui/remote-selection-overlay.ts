import type { PptxElement } from 'pptx-viewer-core';
import type { SanitizedPresence } from 'pptx-viewer-shared';
import { formatCursorLabel } from 'pptx-viewer-shared';

import { createEl } from '../../render';

/**
 * remote-selection-overlay.ts: presentational overlay that draws a coloured
 * rectangle around each element a remote collaborator has selected, labelled
 * with that peer's name in their colour (Google-Slides-style presence).
 * Vanilla port of the Vue `RemoteSelectionOverlay.vue` / React
 * `RemoteSelectionOverlay.tsx`.
 *
 * Owns no network/Yjs logic: the caller supplies the live
 * `SanitizedPresence[]` (from `store.get().remotePresences`, which already
 * excludes the local user), the active slide's elements, the active slide
 * index, and the current stage scale on every
 * {@link RemoteSelectionOverlay.update} call. Element geometry is unscaled
 * slide-space px multiplied by the stage scale here, matching how
 * `collaboration-cursors.ts` and `editor/selection-overlay.ts` position their
 * children inside the unscaled stage wrap. `pointer-events: none` throughout
 * so the overlay never intercepts stage input.
 */

export interface RemoteSelectionOverlay {
	/** Mount as a sibling of the rendered stage inside the stage wrap. */
	el: HTMLElement;
	update(
		presences: readonly SanitizedPresence[],
		elements: readonly PptxElement[],
		activeSlideIndex: number,
		scale: number,
	): void;
	destroy(): void;
}

/** Longest rendered peer name before truncation (matches the Vue overlay). */
const MAX_LABEL_CHARS = 20;

interface SelectionNode {
	root: HTMLElement;
	label: HTMLElement;
}

export function createRemoteSelectionOverlay(doc: Document): RemoteSelectionOverlay {
	const el = createEl(doc, 'div', 'pptxv-remote-selections');
	el.setAttribute('aria-hidden', 'true');
	el.dataset.exportIgnore = 'true';

	const nodes = new Map<string, SelectionNode>();

	function buildNode(key: string): SelectionNode {
		const root = createEl(doc, 'div', 'pptxv-remote-selection');
		root.dataset.selectionKey = key;
		const label = createEl(doc, 'span', 'pptxv-remote-selection-label');
		root.appendChild(label);
		el.appendChild(root);
		return { root, label };
	}

	return {
		el,
		update(presences, elements, activeSlideIndex, scale) {
			const elementById = new Map<string, PptxElement>();
			for (const element of elements) {
				elementById.set(element.id, element);
			}

			const seen = new Set<string>();
			for (const peer of presences) {
				if (peer.activeSlideIndex !== activeSlideIndex || !peer.selectedElementId) {
					continue;
				}
				const element = elementById.get(peer.selectedElementId);
				if (!element) {
					continue;
				}
				const key = `${peer.clientId}-${element.id}`;
				seen.add(key);
				let node = nodes.get(key);
				if (!node) {
					node = buildNode(key);
					nodes.set(key, node);
				}
				node.root.style.transform = `translate(${element.x * scale}px, ${element.y * scale}px)`;
				node.root.style.width = `${element.width * scale}px`;
				node.root.style.height = `${element.height * scale}px`;
				node.root.style.borderColor = peer.userColor;
				node.label.textContent = formatCursorLabel(peer.userName, MAX_LABEL_CHARS);
				node.label.style.backgroundColor = peer.userColor;
			}
			for (const [key, node] of nodes) {
				if (!seen.has(key)) {
					node.root.remove();
					nodes.delete(key);
				}
			}
		},
		destroy() {
			el.remove();
		},
	};
}
