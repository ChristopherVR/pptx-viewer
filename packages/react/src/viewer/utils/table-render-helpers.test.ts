import { describe, it, expect } from 'vitest';
import { ooxmlDashToCssBorderStyle } from './table-render-helpers';

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
