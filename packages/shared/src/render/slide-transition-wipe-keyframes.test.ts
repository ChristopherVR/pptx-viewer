/**
 * Tests for the wipe mask keyframes (`slide-transition-wipe-keyframes.ts`).
 *
 * The wipe reveals via a 3x-oversized gradient mask whose position sweeps;
 * the mask's black zone must sit over the element at the END frame and off it
 * at the START frame, or the direction plays inverted (fully visible first,
 * erasing upward). The from-top keyframes shipped exactly that inversion once.
 */
import { describe, expect, it } from 'vitest';

import { SLIDE_TRANSITION_KEYFRAMES } from './slide-transition-keyframes';

const block = (name: string): string => {
	const start = SLIDE_TRANSITION_KEYFRAMES.indexOf(`@keyframes ${name} {`);
	const end = SLIDE_TRANSITION_KEYFRAMES.indexOf('@keyframes', start + 1);
	return SLIDE_TRANSITION_KEYFRAMES.slice(start, end);
};

describe('wipe mask geometry', () => {
	it.each([
		['pptx-tr-wipe-from-left', '100% 0', '0% 0'],
		['pptx-tr-wipe-from-right', '0% 0', '100% 0'],
		['pptx-tr-wipe-from-top', '0 100%', '0 0%'],
		['pptx-tr-wipe-from-bottom', '0 0%', '0 100%'],
	])('%s starts hidden and ends opaque', (name, fromPosition, toPosition) => {
		const keyframes = block(name);
		const fromPart = keyframes.slice(keyframes.indexOf('from {'), keyframes.indexOf('to {'));
		const toPart = keyframes.slice(keyframes.indexOf('to {'));
		expect(fromPart).toContain(`mask-position: ${fromPosition}`);
		expect(toPart).toContain(`mask-position: ${toPosition}`);
	});
});
