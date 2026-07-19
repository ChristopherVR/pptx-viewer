/**
 * Pure helpers that turn the live canvas selection into AI "focused targets"
 * (the slides / elements the assistant should scope its work to) and into the
 * short chip labels shown in the AI panel.
 *
 * Shared by {@link useAiBridge} (so `getFocusedTargets` reflects live selection)
 * and by the panel's focus chips, so both agree on what "the current focus" is.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { PptxAiFocusedTarget } from 'pptx-viewer-shared/ai';

/** The selection inputs the focus derivation reads. */
export interface FocusSelectionInput {
	activeSlideIndex: number;
	selectedElementIds: string[];
	selectedElementId: string | null;
}

/**
 * Derive focused targets from the live selection: one `element` target per
 * selected element on the active slide, or a single whole-`slide` target when
 * nothing is selected. Order and multiplicity are preserved (multi-select and
 * tables included) so callers can detect e.g. "exactly two tables".
 */
export function computeFocusTargets(input: FocusSelectionInput): PptxAiFocusedTarget[] {
	const { activeSlideIndex, selectedElementIds, selectedElementId } = input;
	const ids =
		selectedElementIds.length > 0
			? selectedElementIds
			: selectedElementId
				? [selectedElementId]
				: [];
	if (ids.length === 0) {
		return [{ kind: 'slide', slideIndex: activeSlideIndex }];
	}
	return ids.map((elementId) => ({ kind: 'element', slideIndex: activeSlideIndex, elementId }));
}

/** Title-case an element type for display, e.g. `smartArt` -> `SmartArt`. */
function elementTypeLabel(type: PptxElement['type']): string {
	if (type === 'smartArt') {
		return 'SmartArt';
	}
	if (type === 'ole') {
		return 'OLE';
	}
	return type.charAt(0).toUpperCase() + type.slice(1);
}

/** A renderable focus chip. */
export interface FocusChip {
	key: string;
	label: string;
}

/**
 * Build display chips for the given targets. Slide targets read `Slide N`;
 * element targets read `<Type> <id>` (or `<Type> (missing)` when the element is
 * no longer on the slide).
 */
export function focusTargetChips(targets: PptxAiFocusedTarget[], slides: PptxSlide[]): FocusChip[] {
	return targets.map((target, index) => {
		if (target.kind === 'slide') {
			return {
				key: `slide-${target.slideIndex}-${index}`,
				label: `Slide ${target.slideIndex + 1}`,
			};
		}
		const el = slides[target.slideIndex]?.elements.find((e) => e.id === target.elementId);
		const label = el
			? `${elementTypeLabel(el.type)} ${target.elementId}`
			: `Element ${target.elementId} (missing)`;
		return { key: `el-${target.elementId}-${index}`, label };
	});
}

/** Whether the focus is exactly two table elements (drives the merge action). */
export function isTwoTableFocus(
	targets: PptxAiFocusedTarget[],
	slides: PptxSlide[],
): false | { slideIndex: number; elementIdA: string; elementIdB: string } {
	if (targets.length !== 2 || targets.some((t) => t.kind !== 'element')) {
		return false;
	}
	const [a, b] = targets as Extract<PptxAiFocusedTarget, { kind: 'element' }>[];
	if (a.slideIndex !== b.slideIndex) {
		return false;
	}
	const slide = slides[a.slideIndex];
	const elA = slide?.elements.find((e) => e.id === a.elementId);
	const elB = slide?.elements.find((e) => e.id === b.elementId);
	if (elA?.type !== 'table' || elB?.type !== 'table') {
		return false;
	}
	return { slideIndex: a.slideIndex, elementIdA: a.elementId, elementIdB: b.elementId };
}
