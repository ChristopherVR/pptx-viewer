import type { ParsedTableStyleEntry } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { describeTableStyleEditor } from './table-style-editor-descriptor';
import { applyTableStyleFieldEdit } from './table-style-editor-edit';
import {
	isTableStylePartName,
	TABLE_STYLE_BORDER_SIDES,
	TABLE_STYLE_EDITOR_PARTS,
} from './table-style-editor-parts';

const THEME: Readonly<Record<string, string>> = {
	dk1: '#000000',
	lt1: '#ffffff',
	dk2: '#44546a',
	lt2: '#e7e6e6',
	accent1: '#4472c4',
	accent2: '#ed7d31',
};

function baseEntry(): ParsedTableStyleEntry {
	return {
		styleId: '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}',
		styleName: 'Medium Style 2 - Accent 1',
		wholeTblFill: { schemeColor: 'accent1', tint: 20000 },
		firstRowText: { bold: true, fontSchemeColor: 'lt1' },
		wholeTblBorders: { left: { width: 1, dash: 'solid', color: '#808080' } },
	};
}

describe('table-style-editor-parts', () => {
	it('lists 14 parts (13 CT_TableStyle sections + background)', () => {
		expect(TABLE_STYLE_EDITOR_PARTS).toHaveLength(14);
		expect(TABLE_STYLE_EDITOR_PARTS.some((p) => p.id === 'background')).toBeTruthy();
	});

	it('isTableStylePartName excludes only the synthetic background id', () => {
		expect(isTableStylePartName('wholeTbl')).toBeTruthy();
		expect(isTableStylePartName('background')).toBeFalsy();
	});

	it('has 8 border sides including both diagonals', () => {
		expect(TABLE_STYLE_BORDER_SIDES).toHaveLength(8);
		expect(TABLE_STYLE_BORDER_SIDES).toContain('tl2br');
		expect(TABLE_STYLE_BORDER_SIDES).toContain('tr2bl');
	});
});

describe('describeTableStyleEditor', () => {
	it('returns undefined without an entry', () => {
		expect(describeTableStyleEditor(undefined, 'wholeTbl', THEME)).toBeUndefined();
	});

	it('resolves a scheme-colour fill to its theme hex and keeps the ref', () => {
		const desc = describeTableStyleEditor(baseEntry(), 'wholeTbl', THEME);
		expect(desc?.fill.color.hex).toBe('#4472c4');
		expect(desc?.fill.color.ref?.scheme).toBe('accent1');
		expect(desc?.fill.isSet).toBeTruthy();
	});

	it('reports an unset fill on a section with none defined', () => {
		const desc = describeTableStyleEditor(baseEntry(), 'band1H', THEME);
		expect(desc?.fill.isSet).toBeFalsy();
		expect(desc?.fill.color.hex).toBe('#ffffff');
	});

	it('reads text bold + scheme colour for the selected part', () => {
		const desc = describeTableStyleEditor(baseEntry(), 'firstRow', THEME);
		expect(desc?.text.bold).toBeTruthy();
		expect(desc?.text.color.hex).toBe('#ffffff');
		expect(desc?.hasTextAndBorders).toBeTruthy();
	});

	it('reads a border side width/dash/colour', () => {
		const desc = describeTableStyleEditor(baseEntry(), 'wholeTbl', THEME);
		expect(desc?.borders.left.width).toBe(1);
		expect(desc?.borders.left.dash).toBe('solid');
		expect(desc?.borders.left.color.hex).toBe('#808080');
		// A side with no entry falls back to sane defaults rather than throwing.
		expect(desc?.borders.tl2br.isSet).toBeFalsy();
	});

	it('the background part has no text/borders facet', () => {
		const entry: ParsedTableStyleEntry = {
			...baseEntry(),
			tableBackground: { fill: { schemeColor: 'accent2' } },
		};
		const desc = describeTableStyleEditor(entry, 'background', THEME);
		expect(desc?.hasTextAndBorders).toBeFalsy();
		expect(desc?.fill.color.hex).toBe('#ed7d31');
	});
});

describe('applyTableStyleFieldEdit', () => {
	it('sets a fill colour by hex, clearing any ref', () => {
		const { entry, payload } = applyTableStyleFieldEdit(baseEntry(), 'wholeTbl', {
			kind: 'fillColor',
			hex: '#ff0000',
			ref: undefined,
		});
		expect(entry.wholeTblFill).toStrictEqual({ schemeColor: '', color: '#ff0000' });
		expect(payload.styleId).toBe(baseEntry().styleId);
		expect(payload.section).toBe('wholeTbl');
		expect(payload.fill).toStrictEqual({ schemeColor: '', color: '#ff0000' });
	});

	it('sets a fill colour by theme ref', () => {
		const { entry } = applyTableStyleFieldEdit(baseEntry(), 'band1H', {
			kind: 'fillColor',
			hex: '#ed7d31',
			ref: { scheme: 'accent2' },
		});
		expect(entry.band1HFill).toStrictEqual({
			schemeColor: 'accent2',
			tint: undefined,
			shade: undefined,
		});
	});

	it('toggles bold on the text facet without disturbing the colour', () => {
		const { entry } = applyTableStyleFieldEdit(baseEntry(), 'firstRow', {
			kind: 'textBold',
			value: false,
		});
		expect(entry.firstRowText?.bold).toBeFalsy();
		expect(entry.firstRowText?.fontSchemeColor).toBe('lt1');
	});

	it('sets a border side width without disturbing its colour', () => {
		const { entry } = applyTableStyleFieldEdit(baseEntry(), 'wholeTbl', {
			kind: 'borderWidth',
			side: 'left',
			width: 3,
		});
		expect(entry.wholeTblBorders?.left?.width).toBe(3);
		expect(entry.wholeTblBorders?.left?.color).toBe('#808080');
	});

	it('sets a border dash on a previously-unset side', () => {
		const { entry } = applyTableStyleFieldEdit(baseEntry(), 'wholeTbl', {
			kind: 'borderDash',
			side: 'tr2bl',
			dash: 'dash',
		});
		expect(entry.wholeTblBorders?.tr2bl?.dash).toBe('dash');
	});

	it('marks noFill on a section with no prior fill without losing the required schemeColor field', () => {
		const { entry } = applyTableStyleFieldEdit(baseEntry(), 'band2V', {
			kind: 'fillNone',
			noFill: true,
		});
		expect(entry.band2VFill).toStrictEqual({ schemeColor: '', noFill: true });
	});

	it('sets cell3D bevel fields', () => {
		const { entry } = applyTableStyleFieldEdit(baseEntry(), 'wholeTbl', {
			kind: 'cell3DBevelWidth',
			value: 4,
		});
		expect(entry.wholeTblCell3D?.bevelWidth).toBe(4);
	});

	it('background part only honours fillColor / fillNone edits', () => {
		const withBg: ParsedTableStyleEntry = { ...baseEntry(), tableBackground: undefined };
		const { entry, payload } = applyTableStyleFieldEdit(withBg, 'background', {
			kind: 'fillColor',
			hex: '#00ff00',
			ref: undefined,
		});
		expect(entry.tableBackground?.fill).toStrictEqual({ schemeColor: '', color: '#00ff00' });
		expect(payload.section).toBe('background');
		expect(payload.fill).toBeUndefined();

		const unaffected = applyTableStyleFieldEdit(entry, 'background', {
			kind: 'textBold',
			value: true,
		});
		expect(unaffected.entry).toStrictEqual(entry);
	});
});
