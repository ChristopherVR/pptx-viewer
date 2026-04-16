import { describe, it, expect } from 'vitest';

import { resolveTableCellStyle, mergeStyleParts } from './table-style-resolver';
import type {
	ParsedTableStyle,
	ParsedTableStylePart,
	TableStyleFlags,
} from './table-style-resolver';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorthand: 5-row, 5-col table with common defaults. */
const ROWS = 5;
const COLS = 5;

/** All flags enabled. */
const ALL_FLAGS: TableStyleFlags = {
	bandedRows: true,
	bandedColumns: true,
	firstRow: true,
	lastRow: true,
	firstCol: true,
	lastCol: true,
};

// ---------------------------------------------------------------------------
// mergeStyleParts
// ---------------------------------------------------------------------------

describe('mergeStyleParts', () => {
	it('returns undefined when both inputs are undefined', () => {
		expect(mergeStyleParts(undefined, undefined)).toBeUndefined();
	});

	it('returns base when override is undefined', () => {
		const base: ParsedTableStylePart = { fill: { color: '#AAA' } };
		expect(mergeStyleParts(base, undefined)).toStrictEqual(base);
	});

	it('returns override when base is undefined', () => {
		const override: ParsedTableStylePart = { fill: { color: '#BBB' } };
		expect(mergeStyleParts(undefined, override)).toStrictEqual(override);
	});

	it('override wins for set properties', () => {
		const base: ParsedTableStylePart = {
			fill: { color: '#AAA' },
			text: { bold: true, fontSize: 12 },
		};
		const override: ParsedTableStylePart = {
			fill: { color: '#BBB' },
			text: { italic: true },
		};
		const merged = mergeStyleParts(base, override)!;
		expect(merged.fill?.color).toBe('#BBB');
		expect(merged.text?.bold).toBeTruthy(); // from base
		expect(merged.text?.italic).toBeTruthy(); // from override
		expect(merged.text?.fontSize).toBe(12); // from base
	});

	it('merges borders per-edge', () => {
		const base: ParsedTableStylePart = {
			borders: {
				top: { width: 1, color: '#000' },
				left: { width: 2 },
			},
		};
		const override: ParsedTableStylePart = {
			borders: {
				top: { color: '#FFF' },
				bottom: { width: 3, color: '#111' },
			},
		};
		const merged = mergeStyleParts(base, override)!;
		// top: override color wins, width falls through from base
		expect(merged.borders?.top).toStrictEqual({ width: 1, color: '#FFF', dash: undefined });
		// left: only base
		expect(merged.borders?.left).toStrictEqual({ width: 2 });
		// bottom: only override
		expect(merged.borders?.bottom).toStrictEqual({ width: 3, color: '#111' });
	});
});

// ---------------------------------------------------------------------------
// resolveTableCellStyle — wholeTbl only
// ---------------------------------------------------------------------------

describe('resolveTableCellStyle — wholeTbl only', () => {
	it('applies wholeTbl fill to any cell', () => {
		const style: ParsedTableStyle = {
			wholeTbl: { fill: { color: '#EEEEEE' } },
		};
		const flags: TableStyleFlags = {};
		const result = resolveTableCellStyle(2, 3, ROWS, COLS, flags, style);
		expect(result.backgroundColor).toBe('#EEEEEE');
		expect(result.fillMode).toBe('solid');
	});

	it('applies wholeTbl text and border properties', () => {
		const style: ParsedTableStyle = {
			wholeTbl: {
				text: { bold: true, color: '#000' },
				borders: { top: { width: 1, color: '#333' } },
			},
		};
		const result = resolveTableCellStyle(0, 0, ROWS, COLS, {}, style);
		expect(result.bold).toBeTruthy();
		expect(result.color).toBe('#000');
		expect(result.borderTopWidth).toBe(1);
		expect(result.borderTopColor).toBe('#333');
	});
});

// ---------------------------------------------------------------------------
// resolveTableCellStyle — horizontal banding
// ---------------------------------------------------------------------------

describe('resolveTableCellStyle — band1H / band2H', () => {
	const style: ParsedTableStyle = {
		wholeTbl: { fill: { color: '#FFF' } },
		band1H: { fill: { color: '#AAA' } },
		band2H: { fill: { color: '#CCC' } },
	};
	const flags: TableStyleFlags = { bandedRows: true };

	it('band1H for even band index (row 0)', () => {
		const result = resolveTableCellStyle(0, 0, ROWS, COLS, flags, style);
		expect(result.backgroundColor).toBe('#AAA');
	});

	it('band2H for odd band index (row 1)', () => {
		const result = resolveTableCellStyle(1, 0, ROWS, COLS, flags, style);
		expect(result.backgroundColor).toBe('#CCC');
	});

	it('band1H again for row 2', () => {
		const result = resolveTableCellStyle(2, 0, ROWS, COLS, flags, style);
		expect(result.backgroundColor).toBe('#AAA');
	});

	it('header row excluded from banding when firstRow is active', () => {
		const flagsWithHeader: TableStyleFlags = { bandedRows: true, firstRow: true };
		const styleWithFirstRow: ParsedTableStyle = {
			...style,
			firstRow: { fill: { color: '#000' } },
		};
		// Row 0 is the header, not banded — gets firstRow style.
		const r0 = resolveTableCellStyle(0, 0, ROWS, COLS, flagsWithHeader, styleWithFirstRow);
		expect(r0.backgroundColor).toBe('#000');
		// Row 1 becomes band row 0 → band1H.
		const r1 = resolveTableCellStyle(1, 0, ROWS, COLS, flagsWithHeader, styleWithFirstRow);
		expect(r1.backgroundColor).toBe('#AAA');
		// Row 2 becomes band row 1 → band2H.
		const r2 = resolveTableCellStyle(2, 0, ROWS, COLS, flagsWithHeader, styleWithFirstRow);
		expect(r2.backgroundColor).toBe('#CCC');
	});
});

// ---------------------------------------------------------------------------
// resolveTableCellStyle — vertical banding
// ---------------------------------------------------------------------------

describe('resolveTableCellStyle — band1V / band2V', () => {
	const style: ParsedTableStyle = {
		band1V: { fill: { color: '#A1A' } },
		band2V: { fill: { color: '#B2B' } },
	};
	const flags: TableStyleFlags = { bandedColumns: true };

	it('band1V for even band index (col 0)', () => {
		const result = resolveTableCellStyle(0, 0, ROWS, COLS, flags, style);
		expect(result.backgroundColor).toBe('#A1A');
	});

	it('band2V for odd band index (col 1)', () => {
		const result = resolveTableCellStyle(0, 1, ROWS, COLS, flags, style);
		expect(result.backgroundColor).toBe('#B2B');
	});

	it('first column excluded from banding when firstCol is active', () => {
		const flagsWithFirstCol: TableStyleFlags = { bandedColumns: true, firstCol: true };
		const styleWithFirstCol: ParsedTableStyle = {
			...style,
			firstCol: { fill: { color: '#FC0' } },
		};
		// Col 0 → firstCol style (not banded).
		const c0 = resolveTableCellStyle(0, 0, ROWS, COLS, flagsWithFirstCol, styleWithFirstCol);
		expect(c0.backgroundColor).toBe('#FC0');
		// Col 1 → band col 0 → band1V.
		const c1 = resolveTableCellStyle(0, 1, ROWS, COLS, flagsWithFirstCol, styleWithFirstCol);
		expect(c1.backgroundColor).toBe('#A1A');
		// Col 2 → band col 1 → band2V.
		const c2 = resolveTableCellStyle(0, 2, ROWS, COLS, flagsWithFirstCol, styleWithFirstCol);
		expect(c2.backgroundColor).toBe('#B2B');
	});
});

// ---------------------------------------------------------------------------
// resolveTableCellStyle — firstRow overrides bands
// ---------------------------------------------------------------------------

describe('resolveTableCellStyle — firstRow overrides bands', () => {
	it('firstRow fill overrides band1H fill', () => {
		const style: ParsedTableStyle = {
			band1H: { fill: { color: '#AAA' } },
			firstRow: { fill: { color: '#111' }, text: { bold: true } },
		};
		const flags: TableStyleFlags = { bandedRows: true, firstRow: true };
		// Row 0 is firstRow — should get firstRow fill, not band.
		const result = resolveTableCellStyle(0, 2, ROWS, COLS, flags, style);
		expect(result.backgroundColor).toBe('#111');
		expect(result.bold).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// resolveTableCellStyle — lastCol overrides bands
// ---------------------------------------------------------------------------

describe('resolveTableCellStyle — lastCol overrides bands', () => {
	it('lastCol fill overrides band1V', () => {
		const style: ParsedTableStyle = {
			band1V: { fill: { color: '#AAA' } },
			lastCol: { fill: { color: '#999' } },
		};
		const flags: TableStyleFlags = { bandedColumns: true, lastCol: true };
		// Last column index (COLS-1) should get lastCol style.
		const result = resolveTableCellStyle(2, COLS - 1, ROWS, COLS, flags, style);
		expect(result.backgroundColor).toBe('#999');
	});
});

// ---------------------------------------------------------------------------
// resolveTableCellStyle — corner cells
// ---------------------------------------------------------------------------

describe('resolveTableCellStyle — corner cells', () => {
	const style: ParsedTableStyle = {
		wholeTbl: { fill: { color: '#FFF' } },
		firstRow: { fill: { color: '#111' } },
		lastRow: { fill: { color: '#222' } },
		firstCol: { fill: { color: '#333' } },
		lastCol: { fill: { color: '#444' } },
		neCell: { fill: { color: '#NE0' } },
		nwCell: { fill: { color: '#NW0' } },
		seCell: { fill: { color: '#SE0' } },
		swCell: { fill: { color: '#SW0' } },
	};

	it('neCell: firstRow && lastCol corner', () => {
		const result = resolveTableCellStyle(0, COLS - 1, ROWS, COLS, ALL_FLAGS, style);
		expect(result.backgroundColor).toBe('#NE0');
	});

	it('nwCell: firstRow && firstCol corner', () => {
		const result = resolveTableCellStyle(0, 0, ROWS, COLS, ALL_FLAGS, style);
		expect(result.backgroundColor).toBe('#NW0');
	});

	it('seCell: lastRow && lastCol corner', () => {
		const result = resolveTableCellStyle(ROWS - 1, COLS - 1, ROWS, COLS, ALL_FLAGS, style);
		expect(result.backgroundColor).toBe('#SE0');
	});

	it('swCell: lastRow && firstCol corner', () => {
		const result = resolveTableCellStyle(ROWS - 1, 0, ROWS, COLS, ALL_FLAGS, style);
		expect(result.backgroundColor).toBe('#SW0');
	});
});

// ---------------------------------------------------------------------------
// resolveTableCellStyle — missing style parts are skipped
// ---------------------------------------------------------------------------

describe('resolveTableCellStyle — missing style parts skipped', () => {
	it('returns only wholeTbl when other parts are absent', () => {
		const style: ParsedTableStyle = {
			wholeTbl: { fill: { color: '#EEE' }, text: { fontSize: 10 } },
		};
		// All flags enabled, but no corresponding parts exist.
		const result = resolveTableCellStyle(0, 0, ROWS, COLS, ALL_FLAGS, style);
		expect(result.backgroundColor).toBe('#EEE');
		expect(result.fontSize).toBe(10);
	});
});

// ---------------------------------------------------------------------------
// resolveTableCellStyle — bandRowCycle custom
// ---------------------------------------------------------------------------

describe('resolveTableCellStyle — bandRowCycle=2', () => {
	const style: ParsedTableStyle = {
		band1H: { fill: { color: '#B1H' } },
		band2H: { fill: { color: '#B2H' } },
	};
	const flags: TableStyleFlags = { bandedRows: true, bandRowCycle: 2 };

	it('rows 0-1 are band1H (group 0)', () => {
		expect(resolveTableCellStyle(0, 0, 8, COLS, flags, style).backgroundColor).toBe('#B1H');
		expect(resolveTableCellStyle(1, 0, 8, COLS, flags, style).backgroundColor).toBe('#B1H');
	});

	it('rows 2-3 are band2H (group 1)', () => {
		expect(resolveTableCellStyle(2, 0, 8, COLS, flags, style).backgroundColor).toBe('#B2H');
		expect(resolveTableCellStyle(3, 0, 8, COLS, flags, style).backgroundColor).toBe('#B2H');
	});

	it('rows 4-5 cycle back to band1H (group 2)', () => {
		expect(resolveTableCellStyle(4, 0, 8, COLS, flags, style).backgroundColor).toBe('#B1H');
		expect(resolveTableCellStyle(5, 0, 8, COLS, flags, style).backgroundColor).toBe('#B1H');
	});
});

// ---------------------------------------------------------------------------
// resolveTableCellStyle — no bands when flags are false
// ---------------------------------------------------------------------------

describe('resolveTableCellStyle — no bands when flags are false', () => {
	it('band parts are ignored when bandedRows/bandedColumns are false', () => {
		const style: ParsedTableStyle = {
			wholeTbl: { fill: { color: '#FFF' } },
			band1H: { fill: { color: '#B1H' } },
			band1V: { fill: { color: '#B1V' } },
		};
		const flags: TableStyleFlags = { bandedRows: false, bandedColumns: false };
		const result = resolveTableCellStyle(0, 0, ROWS, COLS, flags, style);
		expect(result.backgroundColor).toBe('#FFF');
	});
});

// ---------------------------------------------------------------------------
// resolveTableCellStyle — empty style returns empty
// ---------------------------------------------------------------------------

describe('resolveTableCellStyle — empty style', () => {
	it('returns empty object for completely empty style', () => {
		const result = resolveTableCellStyle(0, 0, ROWS, COLS, ALL_FLAGS, {});
		expect(result).toStrictEqual({});
	});
});

// ---------------------------------------------------------------------------
// resolveTableCellStyle — firstCol overrides bands
// ---------------------------------------------------------------------------

describe('resolveTableCellStyle — firstCol overrides bands', () => {
	it('firstCol fill overrides band1V fill', () => {
		const style: ParsedTableStyle = {
			band1V: { fill: { color: '#B1V' } },
			firstCol: { fill: { color: '#FC0' }, text: { italic: true } },
		};
		const flags: TableStyleFlags = { bandedColumns: true, firstCol: true };
		const result = resolveTableCellStyle(2, 0, ROWS, COLS, flags, style);
		expect(result.backgroundColor).toBe('#FC0');
		expect(result.italic).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// resolveTableCellStyle — gradient and pattern fill modes
// ---------------------------------------------------------------------------

describe('resolveTableCellStyle — gradient and pattern fill modes', () => {
	it('sets fillMode to gradient when gradient is present', () => {
		const style: ParsedTableStyle = {
			wholeTbl: { fill: { gradient: { angle: 90, stops: [] } } },
		};
		const result = resolveTableCellStyle(0, 0, ROWS, COLS, {}, style);
		expect(result.fillMode).toBe('gradient');
	});

	it('sets fillMode to pattern when pattern is present', () => {
		const style: ParsedTableStyle = {
			wholeTbl: { fill: { pattern: { preset: 'ltDnDiag' } } },
		};
		const result = resolveTableCellStyle(0, 0, ROWS, COLS, {}, style);
		expect(result.fillMode).toBe('pattern');
	});
});

// ---------------------------------------------------------------------------
// resolveTableCellStyle — full cascade priority order
// ---------------------------------------------------------------------------

describe('resolveTableCellStyle — full cascade priority', () => {
	it('higher-priority parts override lower-priority ones', () => {
		const style: ParsedTableStyle = {
			wholeTbl: { text: { bold: false, italic: false, color: '#000', fontSize: 10 } },
			band1H: { text: { color: '#111' } },
			band1V: { text: { color: '#222' } },
			lastRow: { text: { color: '#333' } },
			firstRow: { text: { color: '#444' } },
			lastCol: { text: { color: '#555' } },
			firstCol: { text: { color: '#666' } },
			nwCell: { text: { color: '#777' } },
		};
		// Cell (0, 0) with all flags → nwCell is the highest priority.
		const result = resolveTableCellStyle(0, 0, ROWS, COLS, ALL_FLAGS, style);
		expect(result.color).toBe('#777');
		// bold and fontSize fall through from wholeTbl
		expect(result.bold).toBeFalsy();
		expect(result.fontSize).toBe(10);
	});
});

// ---------------------------------------------------------------------------
// resolveTableCellStyle — bandColCycle custom
// ---------------------------------------------------------------------------

describe('resolveTableCellStyle — bandColCycle=2', () => {
	const style: ParsedTableStyle = {
		band1V: { fill: { color: '#B1V' } },
		band2V: { fill: { color: '#B2V' } },
	};
	const flags: TableStyleFlags = { bandedColumns: true, bandColCycle: 2 };

	it('cols 0-1 are band1V (group 0)', () => {
		expect(resolveTableCellStyle(0, 0, ROWS, 8, flags, style).backgroundColor).toBe('#B1V');
		expect(resolveTableCellStyle(0, 1, ROWS, 8, flags, style).backgroundColor).toBe('#B1V');
	});

	it('cols 2-3 are band2V (group 1)', () => {
		expect(resolveTableCellStyle(0, 2, ROWS, 8, flags, style).backgroundColor).toBe('#B2V');
		expect(resolveTableCellStyle(0, 3, ROWS, 8, flags, style).backgroundColor).toBe('#B2V');
	});
});

// ---------------------------------------------------------------------------
// resolveTableCellStyle — border cascade
// ---------------------------------------------------------------------------

describe('resolveTableCellStyle — border cascade', () => {
	it('firstRow borders override wholeTbl borders', () => {
		const style: ParsedTableStyle = {
			wholeTbl: {
				borders: { bottom: { width: 1, color: '#000' } },
			},
			firstRow: {
				borders: { bottom: { width: 3, color: '#F00' } },
			},
		};
		const flags: TableStyleFlags = { firstRow: true };
		const result = resolveTableCellStyle(0, 2, ROWS, COLS, flags, style);
		expect(result.borderBottomWidth).toBe(3);
		expect(result.borderBottomColor).toBe('#F00');
	});
});
