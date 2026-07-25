import { describe, expect, it } from 'vitest';

import { resolveEditTargetElementId, resolveTopLevelElementId } from './element-hit';

/**
 * Build `<stage><group data-element-id=g1><child data-element-id=c1/></group>
 * <shape data-element-id=s1/></stage>` and return the pieces for hit-testing.
 */
function buildStage(): {
	stage: HTMLElement;
	child: HTMLElement;
	shape: HTMLElement;
	outside: HTMLElement;
} {
	const stage = document.createElement('div');
	const group = document.createElement('div');
	group.dataset.elementId = 'g1';
	const child = document.createElement('div');
	child.dataset.elementId = 'c1';
	group.appendChild(child);
	const shape = document.createElement('div');
	shape.dataset.elementId = 's1';
	stage.append(group, shape);

	const outside = document.createElement('div');
	document.body.append(stage, outside);
	return { stage, child, shape, outside };
}

describe('resolveTopLevelElementId', () => {
	it('resolves a nested group child to the top-level group id', () => {
		const { stage, child } = buildStage();
		expect(resolveTopLevelElementId(child, stage)).toBe('g1');
	});

	it('resolves a direct top-level element to its own id', () => {
		const { stage, shape } = buildStage();
		expect(resolveTopLevelElementId(shape, stage)).toBe('s1');
	});

	it('returns null for a target outside the stage', () => {
		const { stage, outside } = buildStage();
		expect(resolveTopLevelElementId(outside, stage)).toBeNull();
	});

	it('returns null for the stage root itself and for a null target', () => {
		const { stage } = buildStage();
		expect(resolveTopLevelElementId(stage, stage)).toBeNull();
		expect(resolveTopLevelElementId(null, stage)).toBeNull();
	});
});

describe('resolveEditTargetElementId', () => {
	/** A resize handle inside the selection overlay, as the DOM actually nests it. */
	function buildOverlayHandle(): HTMLElement {
		const overlay = document.createElement('div');
		overlay.setAttribute('data-pptx-selection-overlay', '');
		const box = document.createElement('div');
		const handle = document.createElement('button');
		box.appendChild(handle);
		overlay.appendChild(box);
		document.body.appendChild(overlay);
		return handle;
	}

	it('prefers a direct element hit over the selection fallback', () => {
		const { stage, shape } = buildStage();
		expect(resolveEditTargetElementId(shape, stage, 'other')).toBe('s1');
	});

	// Regression: on a coarse pointer the finger-sized resize handles cover a
	// small shape's body, so the second tap of a double-tap lands on a handle
	// and the plain hit-test finds nothing.
	it('falls back to the selected element when the hit is selection chrome', () => {
		const { stage } = buildStage();
		const handle = buildOverlayHandle();
		expect(resolveTopLevelElementId(handle, stage)).toBeNull();
		expect(resolveEditTargetElementId(handle, stage, 's1')).toBe('s1');
	});

	it('returns null for selection chrome with nothing selected', () => {
		const { stage } = buildStage();
		expect(resolveEditTargetElementId(buildOverlayHandle(), stage, null)).toBeNull();
	});

	it('returns null for unrelated chrome outside the stage and overlay', () => {
		const { stage, outside } = buildStage();
		expect(resolveEditTargetElementId(outside, stage, 's1')).toBeNull();
		expect(resolveEditTargetElementId(null, stage, 's1')).toBeNull();
	});
});
