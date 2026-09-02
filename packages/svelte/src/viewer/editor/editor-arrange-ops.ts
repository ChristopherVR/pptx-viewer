import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { AlignEdge, DistributeAxis } from 'pptx-viewer-shared';
import {
	alignElements,
	distributeElements,
	generateElementId,
	groupElements,
	makeCloneId,
	mapSlideElements,
	ungroupElements,
} from 'pptx-viewer-shared';

/**
 * Pure, multi-select-aware arrange mutations for the Home tab's Arrange
 * group: align / distribute / flip / group / ungroup. The bounding-box maths
 * (`alignElements`, `distributeElements`) and grouping (`groupElements`,
 * `ungroupElements`) are the shared, framework-agnostic operations from
 * `pptx-viewer-shared`; this module lifts them to the slide-array shape
 * `EditorState` stores and to the ordered `selection.ids` list the toolbar
 * reads (mirrors `editor-mutations.ts` / `editor-zorder.ts`).
 */

/** Align every selected element to a common edge (needs >= 2 ids). Null when a no-op. */
export function alignSelectedOnSlide(
	slides: readonly PptxSlide[],
	slideIndex: number,
	ids: readonly string[],
	edge: AlignEdge,
): PptxSlide[] | null {
	let changed = false;
	const next = mapSlideElements(slides, slideIndex, (elements) => {
		const targets = elements.filter((el) => ids.includes(el.id));
		const positions = alignElements(targets, edge);
		if (positions.size === 0) {
			return elements;
		}
		changed = true;
		return elements.map((el) => {
			const pos = positions.get(el.id);
			return pos ? { ...el, x: pos.x ?? el.x, y: pos.y ?? el.y } : el;
		});
	});
	return changed ? next : null;
}

/** Distribute the selected elements evenly along an axis (needs >= 3 ids). Null when a no-op. */
export function distributeSelectedOnSlide(
	slides: readonly PptxSlide[],
	slideIndex: number,
	ids: readonly string[],
	axis: DistributeAxis,
): PptxSlide[] | null {
	let changed = false;
	const next = mapSlideElements(slides, slideIndex, (elements) => {
		const targets = elements.filter((el) => ids.includes(el.id));
		const positions = distributeElements(targets, axis);
		if (positions.size === 0) {
			return elements;
		}
		changed = true;
		return elements.map((el) => {
			const pos = positions.get(el.id);
			return pos ? { ...el, x: pos.x ?? el.x, y: pos.y ?? el.y } : el;
		});
	});
	return changed ? next : null;
}

/** Flip every selected element across the given axis. Null when nothing is selected. */
export function flipSelectedOnSlide(
	slides: readonly PptxSlide[],
	slideIndex: number,
	ids: readonly string[],
	axis: 'horizontal' | 'vertical',
): PptxSlide[] | null {
	if (ids.length === 0) {
		return null;
	}
	const key = axis === 'horizontal' ? 'flipHorizontal' : 'flipVertical';
	return mapSlideElements(slides, slideIndex, (elements) =>
		elements.map((el) => (ids.includes(el.id) ? { ...el, [key]: !el[key] } : el)),
	);
}

/** Group the selected elements (needs >= 2 ids). Returns the new group id, or null when a no-op. */
export function groupSelectedOnSlide(
	slides: readonly PptxSlide[],
	slideIndex: number,
	ids: readonly string[],
	intoTemplate = false,
): { slides: PptxSlide[]; groupId: string } | null {
	let groupId: string | null = null;
	const next = mapSlideElements(slides, slideIndex, (elements) => {
		const result = groupElements(
			elements,
			ids,
			intoTemplate ? makeCloneId(true, ids[0] ?? 'group') : generateElementId(),
		);
		groupId = result.groupId;
		return result.elements;
	});
	return groupId ? { slides: next, groupId } : null;
}

/** Ungroup the group element with `groupId`. Returns the ungrouped child ids, or null when not found. */
export function ungroupOnSlide(
	slides: readonly PptxSlide[],
	slideIndex: number,
	groupId: string,
	fromTemplate = false,
): { slides: PptxSlide[]; childIds: string[] } | null {
	const group = slides[slideIndex]?.elements.find((el) => el.id === groupId);
	if (!group || group.type !== 'group') {
		return null;
	}
	const childIds = group.children.map((child: PptxElement) => makeCloneId(fromTemplate, child.id));
	let resultIds: string[] = [];
	const next = mapSlideElements(slides, slideIndex, (elements) => {
		// `intoTemplate` also governs a promoted NESTED group's descendants, which
		// nothing re-ided while only the top level was renamed.
		const result = ungroupElements(elements, groupId, childIds, { intoTemplate: fromTemplate });
		resultIds = result.childIds;
		return result.elements;
	});
	return resultIds.length > 0 ? { slides: next, childIds: resultIds } : null;
}
