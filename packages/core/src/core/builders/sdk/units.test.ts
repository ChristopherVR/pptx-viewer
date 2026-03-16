import { describe, it, expect } from 'vitest';

import {
	inches,
	cm,
	mm,
	pt,
	emuToPixels,
	pixelsToEmu,
	inchesToEmu,
	cmToEmu,
	SlideSizes,
	EMU_PER_PIXEL,
	EMU_PER_INCH,
	EMU_PER_POINT,
} from './units';

describe('units', () => {
	describe('inches', () => {
		it('converts 1 inch to 96 pixels', () => {
			expect(inches(1)).toBe(96);
		});

		it('converts 2.5 inches to 240 pixels', () => {
			expect(inches(2.5)).toBe(240);
		});
	});

	describe('cm', () => {
		it('converts 2.54 cm (1 inch) to 96 pixels', () => {
			expect(cm(2.54)).toBe(96);
		});
	});

	describe('mm', () => {
		it('converts 25.4 mm (1 inch) to 96 pixels', () => {
			expect(mm(25.4)).toBe(96);
		});
	});

	describe('pt', () => {
		it('converts 72 pt (1 inch) to 96 pixels', () => {
			expect(pt(72)).toBe(96);
		});
	});

	describe('emuToPixels', () => {
		it('converts 9525 EMU to 1 pixel', () => {
			expect(emuToPixels(9525)).toBe(1);
		});
	});

	describe('pixelsToEmu', () => {
		it('converts 1 pixel to 9525 EMU', () => {
			expect(pixelsToEmu(1)).toBe(9525);
		});
	});

	describe('inchesToEmu', () => {
		it('converts 1 inch to 914400 EMU', () => {
			expect(inchesToEmu(1)).toBe(914400);
		});
	});

	describe('cmToEmu', () => {
		it('converts 2.54 cm (1 inch) to 914400 EMU', () => {
			expect(cmToEmu(2.54)).toBe(914400);
		});
	});

	describe('slideSizes', () => {
		it('wIDESCREEN_16_9 has correct dimensions (13.333 x 7.5 in)', () => {
			expect(SlideSizes.WIDESCREEN_16_9).toStrictEqual({
				width: 12192000,
				height: 6858000,
			});
		});

		it('sTANDARD_4_3 has correct dimensions (10 x 7.5 in)', () => {
			expect(SlideSizes.STANDARD_4_3).toStrictEqual({
				width: 9144000,
				height: 6858000,
			});
		});
	});

	describe('constants', () => {
		it('eMU_PER_PIXEL is 9525', () => {
			expect(EMU_PER_PIXEL).toBe(9525);
		});

		it('eMU_PER_INCH is 914400', () => {
			expect(EMU_PER_INCH).toBe(914400);
		});

		it('eMU_PER_POINT is 12700', () => {
			expect(EMU_PER_POINT).toBe(12700);
		});
	});
});
