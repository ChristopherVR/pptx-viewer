/**
 * `element-locks`: whether an authored `a:spLocks` lets a gesture proceed.
 *
 * PowerPoint stores per-shape interaction locks on the non-visual properties
 * node (`p:cNvSpPr/a:spLocks`, and the `a:cxnSpLocks` / `a:picLocks` /
 * `a:grpSpLocks` / `a:graphicFrameLocks` variants), and the parser folds all of
 * them into one {@link PptxShapeLocks} bag on the element. A locked shape in a
 * real deck is a template guardrail: the author is saying "the reader may not
 * drag this masthead off the slide".
 *
 * Enforcement used to be spread across the bindings by hand, which is how the
 * repo ended up shipping a Lock button in the Vue and Angular inspectors that
 * wrote `locks` nothing on the canvas ever read. This module is the single
 * decision function: give it an element and it returns a framework-neutral
 * descriptor of what the user may still do to it, and every binding maps that
 * descriptor onto its own pointer wiring.
 *
 * Composition rules (PowerPoint's, not ours):
 *  - `noSelect` subsumes everything. A shape you cannot select is a shape you
 *    cannot move, resize, rotate, adjust or edit, whatever the other flags say.
 *  - every other flag gates exactly one gesture, so a shape can be pinned in
 *    place (`noMove`) and still be resized, which is what PowerPoint does.
 *
 * @module render/element-locks
 */
import type { PptxElement, PptxShapeLocks } from 'pptx-viewer-core';

/** A single on-canvas gesture a lock may forbid. */
export type ElementInteraction =
	| 'select'
	| 'move'
	| 'resize'
	| 'rotate'
	| 'textEdit'
	| 'group'
	| 'changeAspect'
	| 'adjustHandle'
	| 'editPoints'
	| 'changeArrowheads'
	| 'changeShapeType';

/**
 * What the user may still do to an element, after its locks are applied.
 *
 * One boolean per gesture rather than a lock bag, so a binding reads
 * `interactivity.movable` at the drag-start site instead of re-deriving the
 * `noSelect || noMove` composition (four bindings would each get one branch of
 * that wrong before anybody noticed).
 */
export interface ElementInteractivity {
	/** May be clicked, marquee-hit and shown in the selection overlay. */
	selectable: boolean;
	/** May be dragged to a new position. */
	movable: boolean;
	/** May be resized from the eight handles. */
	resizable: boolean;
	/** May be rotated from the rotate knob. */
	rotatable: boolean;
	/** May enter the inline text editor. */
	textEditable: boolean;
	/** May be grouped or ungrouped. */
	groupable: boolean;
	/** May change its aspect ratio (a corner resize that does not lock aspect). */
	aspectChangeable: boolean;
	/** May show and drag the amber adjustment (`a:avLst`) handle. */
	adjustable: boolean;
	/** May have its geometry points edited. */
	pointsEditable: boolean;
	/** May have its arrowheads changed. */
	arrowheadsChangeable: boolean;
	/** May be swapped to a different preset geometry. */
	shapeTypeChangeable: boolean;
}

/** Nothing is locked: what an element with no `a:spLocks` resolves to. */
const FULLY_INTERACTIVE: ElementInteractivity = {
	selectable: true,
	movable: true,
	resizable: true,
	rotatable: true,
	textEditable: true,
	groupable: true,
	aspectChangeable: true,
	adjustable: true,
	pointsEditable: true,
	arrowheadsChangeable: true,
	shapeTypeChangeable: true,
};

/** Everything is locked: what `noSelect` resolves to. */
const FULLY_LOCKED: ElementInteractivity = {
	selectable: false,
	movable: false,
	resizable: false,
	rotatable: false,
	textEditable: false,
	groupable: false,
	aspectChangeable: false,
	adjustable: false,
	pointsEditable: false,
	arrowheadsChangeable: false,
	shapeTypeChangeable: false,
};

/**
 * The locks authored on `element`, or `undefined` when it carries none.
 *
 * `locks` sits on `PptxElementBase`, so every element type may have it; this
 * exists so a binding never has to reach through an `as` cast to read it.
 */
export function getElementLocks(
	element: PptxElement | null | undefined,
): PptxShapeLocks | undefined {
	return element?.locks;
}

/**
 * What the user may still do to `element`.
 *
 * Pure and allocation-cheap: an unlocked element (the overwhelming majority)
 * returns a shared frozen-in-spirit constant rather than a fresh object, so
 * calling this per element per render is free.
 */
export function resolveElementInteractivity(
	element: PptxElement | null | undefined,
): ElementInteractivity {
	const locks = getElementLocks(element);
	if (!locks) {
		return FULLY_INTERACTIVE;
	}
	if (locks.noSelect === true) {
		return FULLY_LOCKED;
	}
	return {
		selectable: true,
		movable: locks.noMove !== true,
		resizable: locks.noResize !== true,
		rotatable: locks.noRotation !== true,
		textEditable: locks.noTextEdit !== true,
		groupable: locks.noGrouping !== true,
		aspectChangeable: locks.noChangeAspect !== true,
		adjustable: locks.noAdjustHandles !== true,
		pointsEditable: locks.noEditPoints !== true,
		arrowheadsChangeable: locks.noChangeArrowheads !== true,
		shapeTypeChangeable: locks.noChangeShapeType !== true,
	};
}

/** Map from a gesture name onto the descriptor field that governs it. */
const INTERACTION_FIELD: Readonly<Record<ElementInteraction, keyof ElementInteractivity>> = {
	select: 'selectable',
	move: 'movable',
	resize: 'resizable',
	rotate: 'rotatable',
	textEdit: 'textEditable',
	group: 'groupable',
	changeAspect: 'aspectChangeable',
	adjustHandle: 'adjustable',
	editPoints: 'pointsEditable',
	changeArrowheads: 'arrowheadsChangeable',
	changeShapeType: 'shapeTypeChangeable',
};

/**
 * May `interaction` proceed on `element`?
 *
 * The single-question form of {@link resolveElementInteractivity}, for call
 * sites that gate one gesture (a drag-start handler, a rotate commit) rather
 * than rendering a whole overlay.
 */
export function canInteractWithElement(
	element: PptxElement | null | undefined,
	interaction: ElementInteraction,
): boolean {
	return resolveElementInteractivity(element)[INTERACTION_FIELD[interaction]];
}

/** The negation of {@link canInteractWithElement}, for readability at guards. */
export function isElementInteractionLocked(
	element: PptxElement | null | undefined,
	interaction: ElementInteraction,
): boolean {
	return !canInteractWithElement(element, interaction);
}

/**
 * True when `element` carries at least one lock that stops a canvas gesture.
 *
 * Drives the inspector's Lock toggle state so all five agree on when a shape
 * reads as "locked", instead of each testing a different flag subset.
 */
export function isElementLocked(element: PptxElement | null | undefined): boolean {
	const locks = getElementLocks(element);
	if (!locks) {
		return false;
	}
	return locks.noSelect === true || locks.noMove === true || locks.noResize === true;
}

/**
 * The `locks` patch the inspector's Lock toggle writes, in either direction.
 *
 * Deliberately does NOT set `noSelect`, even though the toggle used to. Now
 * that the canvas actually honours the flag, a Lock button that also wrote
 * `noSelect` would make the shape unselectable, and the only control that can
 * clear the lock lives in the inspector - which needs the shape selected. The
 * user would lock a shape once and never get it back from the canvas.
 * PowerPoint draws the same distinction: the Format pane pins position and
 * size, and only the Selection Pane's padlock removes selectability. A
 * `noSelect` authored in the deck is still parsed and still enforced.
 */
export function elementLockTogglePatch(shouldLock: boolean): PptxShapeLocks | undefined {
	return shouldLock ? { noMove: true, noResize: true } : undefined;
}

/**
 * Drop the ids of elements that may not `interaction`, keeping order.
 *
 * A multi-select drag must move the movable members and leave a pinned one
 * behind, exactly as PowerPoint does; without this every binding would have to
 * filter by hand at its own drag-start.
 */
export function filterInteractableIds(
	ids: readonly string[],
	lookup: (id: string) => PptxElement | null | undefined,
	interaction: ElementInteraction,
): string[] {
	return ids.filter((id) => canInteractWithElement(lookup(id), interaction));
}
