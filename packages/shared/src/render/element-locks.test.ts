import type { PptxElement, PptxShapeLocks } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	canDrillDown,
	canInteractWithElement,
	elementLockTogglePatch,
	filterInteractableIds,
	getElementLocks,
	isElementInteractionLocked,
	isElementLocked,
	resolveElementInteractivity,
} from './element-locks';

function shape(id: string, locks?: PptxShapeLocks): PptxElement {
	return {
		id,
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		locks,
	} as unknown as PptxElement;
}

describe('resolveElementInteractivity', () => {
	it('leaves every gesture available on an element with no locks', () => {
		const interactivity = resolveElementInteractivity(shape('a'));
		expect(Object.values(interactivity).every(Boolean)).toBeTruthy();
	});

	it('treats a missing element as fully interactive rather than throwing', () => {
		expect(resolveElementInteractivity(undefined).movable).toBeTruthy();
		expect(resolveElementInteractivity(null).selectable).toBeTruthy();
	});

	it('pins a noMove shape in place while leaving it resizable and rotatable', () => {
		const interactivity = resolveElementInteractivity(shape('a', { noMove: true }));
		expect(interactivity.movable).toBeFalsy();
		expect(interactivity.selectable).toBeTruthy();
		expect(interactivity.resizable).toBeTruthy();
		expect(interactivity.rotatable).toBeTruthy();
	});

	it('lets noSelect subsume every other gesture', () => {
		// PowerPoint: a shape the user cannot select is a shape the user cannot
		// touch at all, whatever the remaining flags happen to say.
		const interactivity = resolveElementInteractivity(
			shape('a', { noSelect: true, noMove: false, noResize: false }),
		);
		expect(Object.values(interactivity).some(Boolean)).toBeFalsy();
	});

	it('maps each remaining flag onto exactly one gesture', () => {
		expect(resolveElementInteractivity(shape('a', { noResize: true })).resizable).toBeFalsy();
		expect(resolveElementInteractivity(shape('a', { noRotation: true })).rotatable).toBeFalsy();
		expect(resolveElementInteractivity(shape('a', { noTextEdit: true })).textEditable).toBeFalsy();
		expect(resolveElementInteractivity(shape('a', { noGrouping: true })).groupable).toBeFalsy();
		expect(
			resolveElementInteractivity(shape('a', { noChangeAspect: true })).aspectChangeable,
		).toBeFalsy();
		expect(
			resolveElementInteractivity(shape('a', { noAdjustHandles: true })).adjustable,
		).toBeFalsy();
		expect(
			resolveElementInteractivity(shape('a', { noEditPoints: true })).pointsEditable,
		).toBeFalsy();
		expect(
			resolveElementInteractivity(shape('a', { noChangeArrowheads: true })).arrowheadsChangeable,
		).toBeFalsy();
		expect(
			resolveElementInteractivity(shape('a', { noChangeShapeType: true })).shapeTypeChangeable,
		).toBeFalsy();
		// G7: a:picLocks/@noCrop.
		expect(resolveElementInteractivity(shape('a', { noCrop: true })).croppable).toBeFalsy();
		// G8: a:graphicFrameLocks/@noDrilldown.
		expect(
			resolveElementInteractivity(shape('a', { noDrilldown: true })).drilldownable,
		).toBeFalsy();
	});

	it('ignores txBox, which rides on the same node but is not a lock', () => {
		const interactivity = resolveElementInteractivity(shape('a', { txBox: true }));
		expect(Object.values(interactivity).every(Boolean)).toBeTruthy();
	});
});

describe('canInteractWithElement', () => {
	it('answers the single-gesture question the drag-start guards ask', () => {
		const locked = shape('a', { noMove: true });
		expect(canInteractWithElement(locked, 'move')).toBeFalsy();
		expect(canInteractWithElement(locked, 'resize')).toBeTruthy();
		expect(isElementInteractionLocked(locked, 'move')).toBeTruthy();
		expect(isElementInteractionLocked(locked, 'select')).toBeFalsy();
	});
});

describe('canDrillDown', () => {
	it('gates the shared drill-down entry point on a:graphicFrameLocks/@noDrilldown', () => {
		const table = shape('t', { noDrilldown: true });
		expect(canDrillDown(table)).toBeFalsy();
		expect(canDrillDown(shape('t2'))).toBeTruthy();
		expect(canDrillDown(undefined)).toBeTruthy();
	});
});

describe('isElementLocked', () => {
	it('reads as locked for the flags the inspector Lock toggle writes', () => {
		expect(isElementLocked(shape('a'))).toBeFalsy();
		expect(
			isElementLocked(shape('a', { noMove: true, noResize: true, noSelect: true })),
		).toBeTruthy();
		expect(isElementLocked(shape('a', { noResize: true }))).toBeTruthy();
		// A rotation-only lock is not the inspector's "locked" state.
		expect(isElementLocked(shape('a', { noRotation: true }))).toBeFalsy();
	});
});

describe('filterInteractableIds', () => {
	it('drops the pinned member of a multi-selection drag and keeps the rest', () => {
		const elements = new Map<string, PptxElement>([
			['free', shape('free')],
			['pinned', shape('pinned', { noMove: true })],
			['hidden', shape('hidden', { noSelect: true })],
		]);
		expect(
			filterInteractableIds(['free', 'pinned', 'hidden'], (id) => elements.get(id), 'move'),
		).toStrictEqual(['free']);
	});
});

describe('getElementLocks', () => {
	it('reads locks off the element without a cast', () => {
		expect(getElementLocks(shape('a', { noMove: true }))).toStrictEqual({ noMove: true });
		expect(getElementLocks(shape('a'))).toBeUndefined();
		expect(getElementLocks(undefined)).toBeUndefined();
	});
});

describe('elementLockTogglePatch', () => {
	it('never writes noSelect, so a locked shape can still be reached to unlock it', () => {
		// The regression this guards: the toggle used to write noSelect, and once
		// the canvas started honouring that flag the shape became unselectable,
		// which put the only control that clears the lock out of reach.
		const patch = elementLockTogglePatch(true);
		expect(patch).toStrictEqual({ noMove: true, noResize: true });
		expect(patch?.noSelect).toBeUndefined();
		expect(isElementLocked({ locks: patch } as unknown as PptxElement)).toBeTruthy();
	});

	it('clears the whole lock bag when unlocking', () => {
		expect(elementLockTogglePatch(false)).toBeUndefined();
	});
});
