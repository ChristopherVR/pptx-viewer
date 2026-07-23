import type { PptxTableCellStyle } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { cellStyleToCss, ooxmlDashToCssBorderStyle } from './table-render-helpers';

describe('ooxmlDashToCssBorderStyle', () => {
	it('should return "solid" for undefined input', () => {
		expect(ooxmlDashToCssBorderStyle(undefined)).toBe('solid');
	});

	it('should return "solid" for empty string', () => {
		expect(ooxmlDashToCssBorderStyle('')).toBe('solid');
	});

	it('should return "dotted" for "dot"', () => {
		expect(ooxmlDashToCssBorderStyle('dot')).toBe('dotted');
	});

	it('should return "dotted" for "sysDot"', () => {
		expect(ooxmlDashToCssBorderStyle('sysDot')).toBe('dotted');
	});

	it('should return "dashed" for "dash"', () => {
		expect(ooxmlDashToCssBorderStyle('dash')).toBe('dashed');
	});

	it('should return "dashed" for "sysDash"', () => {
		expect(ooxmlDashToCssBorderStyle('sysDash')).toBe('dashed');
	});

	it('should return "dashed" for "lgDash"', () => {
		expect(ooxmlDashToCssBorderStyle('lgDash')).toBe('dashed');
	});

	it('should return "dashed" for compound dash types', () => {
		expect(ooxmlDashToCssBorderStyle('dashDot')).toBe('dashed');
		expect(ooxmlDashToCssBorderStyle('lgDashDot')).toBe('dashed');
		expect(ooxmlDashToCssBorderStyle('sysDashDot')).toBe('dashed');
		expect(ooxmlDashToCssBorderStyle('lgDashDotDot')).toBe('dashed');
		expect(ooxmlDashToCssBorderStyle('sysDashDotDot')).toBe('dashed');
	});

	it('should return "solid" for unknown dash values', () => {
		expect(ooxmlDashToCssBorderStyle('unknown')).toBe('solid');
		expect(ooxmlDashToCssBorderStyle('something')).toBe('solid');
	});
});

describe('cellStyleToCss', () => {
	// ── a:cell3D bevel (fix 1a) ─────────────────────────────────
	it('renders a cell3D bevel as paired inset box-shadows', () => {
		const style: PptxTableCellStyle = {
			cell3D: { bevelHeight: 4, lightRigDirection: 'tl' },
		};
		const css = cellStyleToCss(style);
		expect(css.boxShadow).toBeTypeOf('string');
		expect(String(css.boxShadow)).toContain('inset');
		// Highlight on the lit (top-left) edges, shadow mirrored on the opposite.
		expect(String(css.boxShadow)).toContain('rgba(255,255,255,0.55)');
		expect(String(css.boxShadow)).toContain('rgba(0,0,0,0.4)');
	});

	it('omits boxShadow when no cell3D is present', () => {
		expect(cellStyleToCss({ bold: true }).boxShadow).toBeUndefined();
	});

	// ── @anchorCtr horizontal centring (fix 1d) ─────────────────
	it('centres text horizontally for anchorCtr', () => {
		expect(cellStyleToCss({ anchorCtr: true }).textAlign).toBe('center');
	});

	it('lets an explicit align win over anchorCtr', () => {
		expect(cellStyleToCss({ align: 'right', anchorCtr: true }).textAlign).toBe('right');
	});

	// ── @horzOverflow clip/overflow (fix 1d) ────────────────────
	it('clips horizontal overflow for horzOverflow=clip', () => {
		expect(cellStyleToCss({ horzOverflow: 'clip' }).overflowX).toBe('hidden');
	});

	it('lets text spill for horzOverflow=overflow', () => {
		expect(cellStyleToCss({ horzOverflow: 'overflow' }).overflowX).toBe('visible');
	});

	it('leaves overflowX unset when horzOverflow is absent', () => {
		expect(cellStyleToCss({ bold: true }).overflowX).toBeUndefined();
	});
});
