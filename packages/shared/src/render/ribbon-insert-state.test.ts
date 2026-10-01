import { describe, expect, it } from 'vitest';

import { canRequestInsert, insertLabel, INSERT_COMMANDS } from './ribbon-insert-state';
import type { RibbonInsertState } from './ribbon-insert-state';

const state: RibbonInsertState = {
	editable: true,
	hasSelection: false,
	shapeType: 'rect',
	chartKind: 'column',
	freeformTools: ['curve'],
};

describe('insert ribbon state', () => {
	it('gates commands by editability and Link by the selection', () => {
		expect(canRequestInsert(state, { kind: 'command', value: 'table' })).toBeTruthy();
		expect(
			canRequestInsert({ ...state, editable: false }, { kind: 'command', value: 'table' }),
		).toBeFalsy();
		expect(canRequestInsert(state, { kind: 'command', value: 'link' })).toBeFalsy();
		expect(
			canRequestInsert(
				{ ...state, editable: false, hasSelection: true },
				{ kind: 'command', value: 'link' },
			),
		).toBeTruthy();
		expect(canRequestInsert(state, { kind: 'command', value: 'bogus' as 'table' })).toBeFalsy();
	});

	it('rejects malformed catalogue values and hidden capabilities', () => {
		expect(canRequestInsert(state, { kind: 'shape', value: 'star5' })).toBeTruthy();
		expect(canRequestInsert(state, { kind: 'shape', value: 'nope' })).toBeFalsy();
		expect(canRequestInsert(state, { kind: 'chart', value: 'pie' })).toBeTruthy();
		expect(
			canRequestInsert({ ...state, chartAvailable: false }, { kind: 'chart', value: 'pie' }),
		).toBeFalsy();
		expect(canRequestInsert(state, { kind: 'freeform', value: 'curve' })).toBeTruthy();
		expect(canRequestInsert(state, { kind: 'freeform', value: 'freeformShape' })).toBeFalsy();
		expect(canRequestInsert(state, { kind: 'freeform', value: null })).toBeTruthy();
		expect(canRequestInsert(state, { kind: 'actionButton', value: 'x' })).toBeFalsy();
		expect(canRequestInsert(state, { kind: 'field', value: 'datetime' })).toBeTruthy();
		expect(
			canRequestInsert({ ...state, fieldAvailable: false }, { kind: 'field', value: 'datetime' }),
		).toBeFalsy();
	});

	it('keeps public control ids and falls back to English labels', () => {
		expect(INSERT_COMMANDS.map((item) => item.control).filter(Boolean)).toHaveLength(7);
		expect(insertLabel(state, ['pptx.ribbon.table', 'Table'])).toBe('Table');
		expect(insertLabel({ ...state, translate: () => 'X' }, ['k', 'F'])).toBe('X');
		expect(insertLabel({ ...state, translate: (key) => key }, ['k', 'F'])).toBe('F');
	});
});
