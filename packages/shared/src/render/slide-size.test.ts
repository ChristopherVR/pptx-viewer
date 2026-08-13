import { describe, expect, it } from 'vitest';

import {
	SLIDE_SIZE_PRESETS,
	matchSlideSizePreset,
	resolveSlideSizeSelection,
	slideSizeFromCanvasPx,
	slideSizeFromPreset,
	slideSizeOrientation,
	slideSizeToCanvasPx,
	withSlideSizeOrientation,
} from './slide-size';

describe('slide size presets', () => {
	it('covers every ST_SlideSizeType value plus the widescreen default', () => {
		const types = SLIDE_SIZE_PRESETS.map((preset) => preset.type);
		for (const expected of [
			'screen4x3',
			'screen16x9',
			'screen16x10',
			'letter',
			'ledger',
			'A3',
			'A4',
			'B4ISO',
			'B5ISO',
			'B4JIS',
			'B5JIS',
			'35mm',
			'overhead',
			'banner',
			'hagakiCard',
		]) {
			expect(types).toContain(expected);
		}
		// The modern 16:9 default has no ST_SlideSizeType of its own.
		expect(types).toContain('');
	});

	it('states landscape dimensions for every preset', () => {
		for (const preset of SLIDE_SIZE_PRESETS) {
			expect(preset.widthEmu).toBeGreaterThanOrEqual(preset.heightEmu);
		}
	});
});

describe('matchSlideSizePreset', () => {
	it('matches A4 by its COM-confirmed dimensions', () => {
		expect(matchSlideSizePreset(9906000, 6858000)?.type).toBe('A4');
	});

	it('matches regardless of orientation', () => {
		expect(matchSlideSizePreset(6858000, 9906000)?.type).toBe('A4');
	});

	it('does not match a near miss', () => {
		// The dimensions PowerPoint produced for a hand-set A4-ish deck, which
		// it reported as ppSlideSizeCustom.
		expect(matchSlideSizePreset(7561263, 10693400)).toBeUndefined();
	});
});

describe('orientation', () => {
	it('reads a square deck as landscape', () => {
		expect(slideSizeOrientation(9144000, 9144000)).toBe('landscape');
	});

	it('swaps the pair and keeps the type', () => {
		const portrait = withSlideSizeOrientation(
			{ widthEmu: 9906000, heightEmu: 6858000, type: 'A4' },
			'portrait',
		);
		expect(portrait).toStrictEqual({ widthEmu: 6858000, heightEmu: 9906000, type: 'A4' });
	});

	it('is a no-op when the orientation already matches', () => {
		const size = { widthEmu: 9906000, heightEmu: 6858000, type: 'A4' };
		expect(withSlideSizeOrientation(size, 'landscape')).toBe(size);
	});
});

describe('slideSizeFromPreset', () => {
	it('produces portrait A4', () => {
		const preset = SLIDE_SIZE_PRESETS.find((entry) => entry.type === 'A4');
		expect(preset).toBeDefined();
		expect(slideSizeFromPreset(preset!, 'portrait')).toStrictEqual({
			widthEmu: 6858000,
			heightEmu: 9906000,
			type: 'A4',
		});
	});
});

describe('canvas conversion', () => {
	it('round-trips the 4:3 preset exactly', () => {
		expect(slideSizeToCanvasPx({ widthEmu: 9144000, heightEmu: 6858000 })).toStrictEqual({
			width: 960,
			height: 720,
		});
		expect(slideSizeFromCanvasPx({ width: 960, height: 720 })).toStrictEqual({
			widthEmu: 9144000,
			heightEmu: 6858000,
			type: 'screen4x3',
		});
	});

	it('reports no preset for a hand-typed size', () => {
		expect(slideSizeFromCanvasPx({ width: 800, height: 600 }).type).toBe('');
	});
});

describe('resolveSlideSizeSelection', () => {
	it('keeps the exact EMU of a preset that does not survive a pixel round-trip', () => {
		// Ledger is 1278.5px wide. Deriving from pixels would move it and cost
		// the deck its ppSlideSizeLedgerPaper identity.
		const descriptor = resolveSlideSizeSelection({
			current: { widthEmu: 12179300, heightEmu: 9134475, type: 'ledger' },
			canvas: { width: 1279, height: 959 },
		});
		expect(descriptor.size).toStrictEqual({
			widthEmu: 12179300,
			heightEmu: 9134475,
			type: 'ledger',
		});
		expect(descriptor.preset?.type).toBe('ledger');
		expect(descriptor.orientation).toBe('landscape');
	});

	it('lets a hand-typed canvas size win over a stale EMU size', () => {
		const descriptor = resolveSlideSizeSelection({
			current: { widthEmu: 9144000, heightEmu: 6858000, type: 'screen4x3' },
			canvas: { width: 800, height: 600 },
		});
		expect(descriptor.size).toStrictEqual({ widthEmu: 7620000, heightEmu: 5715000, type: '' });
		expect(descriptor.preset).toBeUndefined();
	});

	it('falls back to the canvas when no EMU size is known', () => {
		const descriptor = resolveSlideSizeSelection({ canvas: { width: 960, height: 540 } });
		expect(descriptor.size.type).toBe('screen16x9');
		expect(descriptor.canvas).toStrictEqual({ width: 960, height: 540 });
	});

	it('recovers a preset type the caller did not carry', () => {
		const descriptor = resolveSlideSizeSelection({
			current: { widthEmu: 9906000, heightEmu: 6858000 },
			canvas: { width: 1040, height: 720 },
		});
		expect(descriptor.size.type).toBe('A4');
	});
});
