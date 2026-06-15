// oxlint-disable react-hooks/rules-of-hooks
import { describe, expect, it } from 'vitest';

import { useSelection } from './useSelection';

describe('useSelection', () => {
	it('starts empty by default', () => {
		const s = useSelection();
		expect(s.selectedIds.value).toStrictEqual([]);
		expect(s.isEmpty.value).toBeTruthy();
	});

	it('accepts and dedupes an initial selection', () => {
		const s = useSelection(['a', 'b', 'a']);
		expect(s.selectedIds.value).toStrictEqual(['a', 'b']);
		expect(s.isEmpty.value).toBeFalsy();
	});

	it('select replaces the selection by default', () => {
		const s = useSelection(['a', 'b']);
		s.select('c');
		expect(s.selectedIds.value).toStrictEqual(['c']);
	});

	it('select with additive adds without removing', () => {
		const s = useSelection(['a']);
		s.select('b', true);
		expect(s.selectedIds.value).toStrictEqual(['a', 'b']);
		// Adding an already-present id is a no-op.
		s.select('b', true);
		expect(s.selectedIds.value).toStrictEqual(['a', 'b']);
	});

	it('toggle adds then removes', () => {
		const s = useSelection();
		s.toggle('a');
		expect(s.selectedIds.value).toStrictEqual(['a']);
		s.toggle('b');
		expect(s.selectedIds.value).toStrictEqual(['a', 'b']);
		s.toggle('a');
		expect(s.selectedIds.value).toStrictEqual(['b']);
	});

	it('selectMany replaces and dedupes', () => {
		const s = useSelection(['x']);
		s.selectMany(['a', 'b', 'b', 'c']);
		expect(s.selectedIds.value).toStrictEqual(['a', 'b', 'c']);
	});

	it('clear empties the selection', () => {
		const s = useSelection(['a', 'b']);
		s.clear();
		expect(s.selectedIds.value).toStrictEqual([]);
		expect(s.isEmpty.value).toBeTruthy();
	});

	it('isSelected reflects membership', () => {
		const s = useSelection(['a']);
		expect(s.isSelected('a')).toBeTruthy();
		expect(s.isSelected('z')).toBeFalsy();
	});
});
