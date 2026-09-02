/**
 * Pure helpers that turn the live canvas selection into AI "focused targets"
 * (the slides / elements the assistant should scope its work to) and into the
 * short chip labels shown in the AI panel.
 *
 * Shared by each binding's AI bridge (so `getFocusedTargets` reflects live
 * selection) and by the panel's focus chips / canvas highlight overlay, so all
 * five agree on what "the current focus" is and on the two-table merge
 * shortcut.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import type { PptxAiFocusedTarget } from './bridge';

/** The selection inputs the focus derivation reads. */
export interface FocusSelectionInput {
	activeSlideIndex: number;
	selectedElementIds: readonly string[];
	selectedElementId: string | null;
}

/** One element ring to draw on the canvas: an explicit pick or a live-tool focus. */
export interface AiCanvasHighlight {
	slideIndex: number;
	elementId: string;
	/** `pick` = persistent user pick; `active` = transient AI-is-working ring. */
	variant: 'pick' | 'active';
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
			? [...selectedElementIds]
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

/** A renderable focus chip. `title` carries the full element id for hover. */
export interface FocusChip {
	key: string;
	label: string;
	title: string;
}

/**
 * A short, human handle for an element id. Element ids carry a source-path
 * prefix (e.g. `ppt/slides/slide1.xml-shape-9`); the trailing number is the
 * useful disambiguator, so `Shape 9` reads far better than the raw id. Falls
 * back to the last path segment when there is no trailing number.
 */
function shortElementId(id: string): string {
	// Scanned by hand rather than with `/(\d+)\s*$/`: an element id comes
	// from the deck, and a backtracking regex is quadratic on a long run of
	// digits followed by one non-digit. Two linear passes cost nothing.
	const trimmed = id.trimEnd();
	let start = trimmed.length;
	while (start > 0 && isAsciiDigit(trimmed.charCodeAt(start - 1))) {
		start -= 1;
	}
	if (start < trimmed.length) {
		return trimmed.slice(start);
	}
	const separator = Math.max(id.lastIndexOf('/'), id.lastIndexOf('.'), id.lastIndexOf('-'));
	const tail = separator === -1 ? id : id.slice(separator + 1);
	return tail || id;
}

function isAsciiDigit(code: number): boolean {
	return code >= 0x30 && code <= 0x39;
}

/**
 * Build display chips for the given targets. Slide targets read `Slide N`;
 * element targets read `<Type> <n>` (a friendly short label, full id on hover),
 * or `<Type> (missing)` when the element is no longer on the slide.
 */
export function focusTargetChips(
	targets: readonly PptxAiFocusedTarget[],
	slides: readonly PptxSlide[],
): FocusChip[] {
	return targets.map((target, index) => {
		if (target.kind === 'slide') {
			const label = `Slide ${target.slideIndex + 1}`;
			return { key: `slide-${target.slideIndex}-${index}`, label, title: label };
		}
		const el = slides[target.slideIndex]?.elements.find((e) => e.id === target.elementId);
		const typeLabel = el ? elementTypeLabel(el.type) : 'Element';
		const label = el
			? `${typeLabel} ${shortElementId(target.elementId)}`
			: `${typeLabel} (missing)`;
		return {
			key: `el-${target.elementId}-${index}`,
			label,
			title: `${typeLabel}: ${target.elementId}`,
		};
	});
}

/** Whether the focus is exactly two table elements (drives the merge action). */
export function isTwoTableFocus(
	targets: readonly PptxAiFocusedTarget[],
	slides: readonly PptxSlide[],
): false | { slideIndex: number; elementIdA: string; elementIdB: string } {
	if (targets.length !== 2 || targets.some((target) => target.kind !== 'element')) {
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

/** Build the directive that fires `merge_tables` without a confirmation round-trip. */
export function mergeTablesDirective(
	slideIndex: number,
	elementIdA: string,
	elementIdB: string,
): string {
	return (
		`Merge the two selected tables (elementIdA=${elementIdA}, elementIdB=${elementIdB}) ` +
		`on slide ${slideIndex + 1} using merge_tables; stage it now, do not ask me to confirm.`
	);
}
