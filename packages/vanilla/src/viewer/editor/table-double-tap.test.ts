import { describe, expect, it } from 'vitest';

import { createTableDoubleTapRecognizer } from './table-double-tap';

function touch(target: Element, timeStamp: number): PointerEvent {
	return { pointerType: 'touch', target, timeStamp } as unknown as PointerEvent;
}

describe('createTableDoubleTapRecognizer', () => {
	it('recognizes two touch taps on the same logical table cell', () => {
		const recognize = createTableDoubleTapRecognizer();
		const first = document.createElement('td');
		first.dataset.rowIndex = '0';
		first.dataset.cellIndex = '1';
		const second = first.cloneNode() as HTMLTableCellElement;

		expect(recognize(touch(first, 100), 'table-1')).toBeFalsy();
		expect(recognize(touch(second, 300), 'table-1')).toBeTruthy();
	});

	it('does not combine taps on different cells or beyond the time window', () => {
		const recognize = createTableDoubleTapRecognizer();
		const first = document.createElement('td');
		first.dataset.rowIndex = '0';
		first.dataset.cellIndex = '0';
		const other = document.createElement('td');
		other.dataset.rowIndex = '0';
		other.dataset.cellIndex = '1';

		expect(recognize(touch(first, 100), 'table-1')).toBeFalsy();
		expect(recognize(touch(other, 200), 'table-1')).toBeFalsy();
		expect(recognize(touch(other, 800), 'table-1')).toBeFalsy();
	});
});
