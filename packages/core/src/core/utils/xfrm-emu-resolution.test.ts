import { describe, expect, it } from 'vitest';

import { resolveXfrmEmu } from './xfrm-emu-resolution';

const EMU_PER_PX = 9525;

describe('resolveXfrmEmu', () => {
	it('returns the stored EMU when it still agrees with the current pixel value', () => {
		// 1524123 EMU is NOT a multiple of 9525 (a sub-pixel offset), but it
		// rounds to the same pixel value the element currently reports.
		const storedEmu = 1524123;
		const px = Math.round(storedEmu / EMU_PER_PX);
		expect(resolveXfrmEmu(px, storedEmu, EMU_PER_PX)).toBe(storedEmu);
	});

	it('re-quantizes from pixels when there is no stored EMU (SDK-created element)', () => {
		expect(resolveXfrmEmu(160, undefined, EMU_PER_PX)).toBe(160 * EMU_PER_PX);
	});

	it('re-quantizes from pixels when the pixel value has diverged (element was moved)', () => {
		const storedEmu = 1524123; // rounds to 160px
		const movedPx = 200; // user dragged the element
		expect(resolveXfrmEmu(movedPx, storedEmu, EMU_PER_PX)).toBe(Math.round(200 * EMU_PER_PX));
	});

	it('re-quantizes from pixels when the element was resized', () => {
		const storedEmu = 6096000; // 640px exactly
		const resizedPx = 700;
		expect(resolveXfrmEmu(resizedPx, storedEmu, EMU_PER_PX)).toBe(Math.round(700 * EMU_PER_PX));
	});

	it('a duplicate at the identical position legitimately reuses the same EMU', () => {
		const storedEmu = 1524123;
		const px = Math.round(storedEmu / EMU_PER_PX);
		// Simulates cloneElement() copying xEmu/x verbatim before any offset is
		// applied by the duplicate/paste operation.
		expect(resolveXfrmEmu(px, storedEmu, EMU_PER_PX)).toBe(storedEmu);
	});

	it('handles zero pixel values', () => {
		expect(resolveXfrmEmu(0, 0, EMU_PER_PX)).toBe(0);
		expect(resolveXfrmEmu(0, undefined, EMU_PER_PX)).toBe(0);
	});

	it('is exact for a value that was already a multiple of EMU_PER_PX', () => {
		const storedEmu = 6096000; // 640px exactly, no sub-pixel remainder
		expect(resolveXfrmEmu(640, storedEmu, EMU_PER_PX)).toBe(storedEmu);
	});
});
