/**
 * smart-art-inline-edit.ts: pure logic for on-canvas SmartArt node text editing.
 *
 * The Angular SmartArt renderer lets a user double-click a rendered node to edit
 * its text directly on the diagram. Everything that can be expressed as a pure
 * function lives here so it can be unit-tested in plain vitest (the Angular
 * package's vitest setup has no Angular compiler, so component/TestBed tests are
 * not available). The component
 * (`smart-art-renderer.component.ts`) stays thin: it owns only the edit-state
 * signal, the positioned `<textarea>`, and the call into the existing commit
 * path (`EditorStateService.updateElement`, the same channel the inspector's
 * `SmartArtPropertiesComponent` commits through, so undo/redo + save round-trip
 * are shared).
 *
 * The commit itself reuses the framework-agnostic core op
 * `updateSmartArtNodeText` (re-exported via `editor-insert.ts`).
 *
 * @module angular-viewer/smart-art-inline-edit
 */

import type { PptxElement, PptxSlide, PptxSmartArtData } from 'pptx-viewer-core';

import type { RenderedNode } from '../internal/shared';
import { updateSmartArtNodeText } from './editor-insert';

/**
 * An axis-aligned box in element-local (viewBox) pixel coordinates, used to
 * position the inline `<textarea>` over a node. Because the SmartArt `<svg>`
 * uses a `viewBox` of `0 0 width height` matching the element's pixel size and
 * fills the element 100%, these coordinates are also the element-local CSS
 * pixels for the overlaid editor.
 */
export interface NodeEditBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** The node currently being edited on the canvas, or `null`. */
export interface InlineEditState {
	/** SmartArt data-model node id (matches `PptxSmartArtNode.id`). */
	nodeId: string;
	/** Positioned editor box in element-local pixels. */
	box: NodeEditBox;
	/** Seed text shown when the editor opens (the node's current text). */
	text: string;
}

/**
 * Extract the SmartArt data-model node id from a rendered node's `key`.
 *
 * Every per-family computer in the shared layout engine builds node keys as
 * `${elementId}-${familyTag}-${nodeId}-${index}` (see
 * `smartart-layout-families*.ts`). The node id can itself contain hyphens, so we
 * strip the known `${elementId}-${familyTag}-` prefix and the trailing
 * `-${index}` rather than splitting on `-`.
 *
 * @returns The node id, or `null` when the key does not match the expected shape.
 */
export function nodeIdFromKey(key: string, elementId: string): string | null {
	const prefix = `${elementId}-`;
	if (!key.startsWith(prefix)) {
		return null;
	}
	// Drop the elementId prefix, then the family tag (first remaining segment).
	const afterElement = key.slice(prefix.length);
	const dashAfterFamily = afterElement.indexOf('-');
	if (dashAfterFamily < 0) {
		return null;
	}
	const afterFamily = afterElement.slice(dashAfterFamily + 1);
	// Strip the trailing numeric index segment.
	const match = afterFamily.match(/^(?<base>.*)-(?<index>\d+)$/u);
	const base = match?.groups?.base;
	if (!base || base.length === 0) {
		return null;
	}
	return base;
}

/**
 * Compute the editor box (element-local pixels) for any rendered node kind.
 *
 * - rect / polygon nodes expose their bounding box (polygon via its computed
 *   `textX`/`textY` centre plus a derived span from its points).
 * - circle nodes are squared to their diameter centred on `cx`/`cy`.
 */
export function nodeEditBox(node: RenderedNode): NodeEditBox {
	if (node.kind === 'rect') {
		return { x: node.x, y: node.y, width: node.width, height: node.height };
	}
	if (node.kind === 'circle') {
		return {
			x: node.cx - node.r,
			y: node.cy - node.r,
			width: node.r * 2,
			height: node.r * 2,
		};
	}
	// polygon: derive a bounding box from its `points` string.
	return polygonBox(node.points, node.textX, node.textY);
}

/** Bounding box of an SVG polygon `points` string (`"x,y x,y …"`). */
function polygonBox(points: string, fallbackCx: number, fallbackCy: number): NodeEditBox {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const pair of points.trim().split(/\s+/u)) {
		const [xs, ys] = pair.split(',');
		const x = Number(xs);
		const y = Number(ys);
		if (!Number.isFinite(x) || !Number.isFinite(y)) {
			continue;
		}
		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x);
		maxY = Math.max(maxY, y);
	}
	if (!Number.isFinite(minX)) {
		// Degenerate points: fall back to a small box around the text centre.
		return { x: fallbackCx - 20, y: fallbackCy - 10, width: 40, height: 20 };
	}
	return { x: minX, y: minY, width: maxX - minX || 1, height: maxY - minY || 1 };
}

/**
 * Build the {@link InlineEditState} for a node the user has chosen to edit.
 *
 * @param node      - The rendered node (carries geometry + key).
 * @param elementId - The owning SmartArt element id (for key parsing).
 * @param rawText   - The node's full, untruncated text (rendered text may be
 *                    truncated with an ellipsis; the editor must seed the real
 *                    text). When omitted, falls back to the rendered text.
 * @returns The edit state, or `null` when the node id cannot be resolved.
 */
export function beginNodeEdit(
	node: RenderedNode,
	elementId: string,
	rawText?: string,
): InlineEditState | null {
	const nodeId = nodeIdFromKey(node.key, elementId);
	if (nodeId === null) {
		return null;
	}
	return {
		nodeId,
		box: nodeEditBox(node),
		text: rawText ?? node.text,
	};
}

/**
 * Commit an edited node's text into the SmartArt data model.
 *
 * Returns the original data unchanged when the text is identical to the current
 * node text (so the caller can skip a no-op history entry); the core op always
 * allocates a fresh object, hence the explicit equality short-circuit here.
 * Otherwise returns a new immutable `PptxSmartArtData` produced by the same core
 * op (`updateSmartArtNodeText`) the inspector commits through, so editing on the
 * canvas and editing in the panel share one undo/redo + save round-trip path.
 *
 * Note: like the core op, this updates the top-level `data.nodes` array (the
 * flat `parentId`-linked model the inspector edits); it does not recurse into
 * nested `children` arrays.
 */
export function commitNodeText(
	data: PptxSmartArtData,
	nodeId: string,
	text: string,
): PptxSmartArtData {
	const current = data.nodes.find((n) => n.id === nodeId);
	// Unknown id (e.g. the synthetic radial "centre" sentinel) or unchanged text:
	// skip so the caller records no spurious history entry.
	if (!current || current.text === text) {
		return data;
	}
	return updateSmartArtNodeText(data, nodeId, text);
}

/**
 * Find the index of the slide that owns an element id (searching group children
 * recursively), or -1 when none does.
 *
 * The renderer is mounted deep in the canvas tree and does not receive the
 * active slide index; it resolves the index from the editor's slide array so it
 * can commit through `EditorStateService.updateElement(slideIndex, id, patch)`,
 * the same call the inspector uses.
 */
export function findSlideIndexByElementId(slides: readonly PptxSlide[], id: string): number {
	for (let i = 0; i < slides.length; i++) {
		if (containsElementId(slides[i].elements, id)) {
			return i;
		}
	}
	return -1;
}

/** Whether an element id appears anywhere in an element tree (groups recurse). */
function containsElementId(elements: readonly PptxElement[], id: string): boolean {
	for (const el of elements) {
		if (el.id === id) {
			return true;
		}
		if (el.type === 'group' && el.children && containsElementId(el.children, id)) {
			return true;
		}
	}
	return false;
}
