// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import {
	resolveEditTargetElementId,
	resolveElementIdChain,
	resolveHitElementId,
	resolveTopLevelElementId,
} from './element-hit-test';

let stage: HTMLElement;

/**
 * A stage holding a lone shape and a group whose child carries its own
 * `data-element-id`, which is exactly how every binding renders a `p:grpSp`.
 */
beforeEach(() => {
	document.body.innerHTML = `
		<div id="stage">
			<div data-element-id="shape-1"><span id="shape-text">Q2</span></div>
			<div data-element-id="group-1">
				<div data-element-id="child-1"><span id="child-text">Revenue</span></div>
				<div data-element-id="nested-group">
					<div data-element-id="deep-child"><span id="deep-text">Deep</span></div>
				</div>
			</div>
		</div>
		<div id="chrome" data-pptx-selection-overlay="true">
			<button id="handle" type="button"></button>
		</div>
		<div id="elsewhere"></div>
	`;
	stage = document.getElementById('stage') as HTMLElement;
});

const node = (id: string): Element => document.getElementById(id) as Element;

describe('resolveTopLevelElementId', () => {
	it('selects the group when the click lands on a grouped child', () => {
		expect(resolveTopLevelElementId(node('child-text'), stage)).toBe('group-1');
	});

	it('selects the outermost group for a child of a nested group', () => {
		expect(resolveTopLevelElementId(node('deep-text'), stage)).toBe('group-1');
	});

	it('still selects an ungrouped shape as itself', () => {
		expect(resolveTopLevelElementId(node('shape-text'), stage)).toBe('shape-1');
	});

	it('reports no element for a click outside every element, so selection clears', () => {
		expect(resolveTopLevelElementId(node('elsewhere'), stage)).toBeNull();
		expect(resolveTopLevelElementId(stage, stage)).toBeNull();
		expect(resolveTopLevelElementId(null, stage)).toBeNull();
	});

	it('reports no element while the stage is unmounted', () => {
		expect(resolveTopLevelElementId(node('child-text'), null)).toBeNull();
	});

	it('rejects a hit that is outside the stage subtree', () => {
		expect(resolveTopLevelElementId(node('handle'), stage)).toBeNull();
	});

	it('walks to the document root when no stage boundary is given', () => {
		expect(resolveTopLevelElementId(node('child-text'))).toBe('group-1');
		expect(resolveTopLevelElementId(node('shape-text'))).toBe('shape-1');
		expect(resolveTopLevelElementId(node('elsewhere'))).toBeNull();
	});

	it('ignores an event target that is not an element (window, document)', () => {
		expect(resolveTopLevelElementId(window)).toBeNull();
	});
});

describe('resolveHitElementId', () => {
	it('keeps the innermost child addressable, so drill-in stays possible', () => {
		expect(resolveHitElementId(node('child-text'))).toBe('child-1');
		expect(resolveHitElementId(node('deep-text'))).toBe('deep-child');
	});
});

describe('resolveElementIdChain', () => {
	it('reports the full innermost-to-outermost chain for a nested group', () => {
		expect(resolveElementIdChain(node('deep-text'), stage)).toStrictEqual([
			'deep-child',
			'nested-group',
			'group-1',
		]);
	});

	it('is empty outside the elements', () => {
		expect(resolveElementIdChain(node('elsewhere'), stage)).toStrictEqual([]);
	});
});

describe('resolveEditTargetElementId', () => {
	it('drills to the group for a double-click on a grouped child', () => {
		expect(resolveEditTargetElementId(node('child-text'), stage, null)).toBe('group-1');
	});

	it('falls back to the selection when the tap lands on a resize handle', () => {
		expect(resolveEditTargetElementId(node('handle'), stage, 'group-1')).toBe('group-1');
		expect(resolveEditTargetElementId(node('handle'), stage, null)).toBeNull();
	});

	it('ignores a target that is neither an element nor chrome', () => {
		expect(resolveEditTargetElementId(node('elsewhere'), stage, 'shape-1')).toBeNull();
		expect(resolveEditTargetElementId(null, stage, 'shape-1')).toBeNull();
	});
});
