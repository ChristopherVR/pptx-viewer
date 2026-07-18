import { describe, expect, it } from 'vitest';

import { createElementDoubleTapRecognizer, ELEMENT_DOUBLE_TAP_MS } from './element-double-tap';

describe('createElementDoubleTapRecognizer', () => {
	it('recognizes two quick touch taps on the same element', () => {
		const recognize = createElementDoubleTapRecognizer();
		expect(recognize('touch', 'el-1', 1000)).toBeFalsy();
		expect(recognize('touch', 'el-1', 1000 + ELEMENT_DOUBLE_TAP_MS - 1)).toBeTruthy();
	});

	it('resets after firing so a third tap starts a fresh sequence', () => {
		const recognize = createElementDoubleTapRecognizer();
		recognize('touch', 'el-1', 0);
		expect(recognize('touch', 'el-1', 100)).toBeTruthy();
		expect(recognize('touch', 'el-1', 200)).toBeFalsy();
		expect(recognize('touch', 'el-1', 300)).toBeTruthy();
	});

	it('rejects taps outside the double-tap window', () => {
		const recognize = createElementDoubleTapRecognizer();
		recognize('touch', 'el-1', 0);
		expect(recognize('touch', 'el-1', ELEMENT_DOUBLE_TAP_MS + 1)).toBeFalsy();
	});

	it('rejects taps on different elements', () => {
		const recognize = createElementDoubleTapRecognizer();
		recognize('touch', 'el-1', 0);
		expect(recognize('touch', 'el-2', 100)).toBeFalsy();
		// The second tap re-arms on el-2; a follow-up on el-2 completes.
		expect(recognize('touch', 'el-2', 200)).toBeTruthy();
	});

	it('ignores mouse presses and resets any pending touch tap', () => {
		const recognize = createElementDoubleTapRecognizer();
		expect(recognize('mouse', 'el-1', 0)).toBeFalsy();
		expect(recognize('mouse', 'el-1', 100)).toBeFalsy();
		recognize('touch', 'el-1', 200);
		expect(recognize('mouse', 'el-1', 250)).toBeFalsy();
		expect(recognize('touch', 'el-1', 300)).toBeFalsy();
	});

	it('resets on empty-canvas presses (null id)', () => {
		const recognize = createElementDoubleTapRecognizer();
		recognize('touch', 'el-1', 0);
		expect(recognize('touch', null, 100)).toBeFalsy();
		expect(recognize('touch', 'el-1', 200)).toBeFalsy();
	});

	it('recognizes pen double-taps too', () => {
		const recognize = createElementDoubleTapRecognizer();
		recognize('pen', 'el-1', 0);
		expect(recognize('pen', 'el-1', 100)).toBeTruthy();
	});
});
