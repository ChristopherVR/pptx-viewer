import { describe, expect, it } from 'vitest';

import { resolveTextStyleAnimation } from './animation-text-style-resolve';

describe('resolveTextStyleAnimation', () => {
	it('returns undefined when the effect carries no recognised set/anim attrs', () => {
		expect(resolveTextStyleAnimation({})).toBeUndefined();
		expect(
			resolveTextStyleAnimation({
				setAnimations: [{ attrName: 'fillcolor', value: '1', valueType: 'str' }],
			}),
		).toBeUndefined();
	});

	it('resolves Bold Reveal (p:set style.fontweight = bold)', () => {
		const result = resolveTextStyleAnimation({
			setAnimations: [{ attrName: 'style.fontweight', value: 'bold', valueType: 'str' }],
		});
		expect(result).toStrictEqual({ bold: true });
	});

	it('resolves Underline / Brush On Underline (p:set style.textdecorationunderline)', () => {
		const result = resolveTextStyleAnimation({
			setAnimations: [
				{ attrName: 'style.textdecorationunderline', value: true, valueType: 'bool' },
			],
		});
		expect(result).toStrictEqual({ underline: true });
	});

	it('resolves Change Font Style italic off via a boolean p:set', () => {
		const result = resolveTextStyleAnimation({
			setAnimations: [{ attrName: 'style.fontstyle', value: 'normal', valueType: 'str' }],
		});
		expect(result).toStrictEqual({ italic: false });
	});

	it('resolves a text-colour p:set distinct from fillcolor/stroke.color', () => {
		const result = resolveTextStyleAnimation({
			setAnimations: [
				{ attrName: 'style.color', value: '#FF0000', valueType: 'clr' },
				{ attrName: 'fillcolor', value: '#00FF00', valueType: 'clr' },
			],
		});
		expect(result).toStrictEqual({ color: '#FF0000' });
	});

	it('resolves Bold Flash (a p:anim ramp targeting style.fontweight) from its last stop', () => {
		const result = resolveTextStyleAnimation({
			attributeAnimations: [
				{
					attrName: 'style.fontweight',
					keyframes: [
						{ tm: 0, value: 'normal', valueType: 'str' },
						{ tm: 100000, value: 'bold', valueType: 'str' },
					],
				},
			],
		});
		expect(result).toStrictEqual({ bold: true });
	});

	it('resolves a self-contained flash-and-revert ramp as bold (true if ANY stop is true)', () => {
		// PowerPoint can compose the whole "flash then revert" pattern inside one
		// ramp (normal -> bold -> normal); reading only the LAST stop here would
		// wrongly resolve to "never bold" and the flash would never render.
		const result = resolveTextStyleAnimation({
			attributeAnimations: [
				{
					attrName: 'style.fontweight',
					keyframes: [
						{ tm: 0, value: 'normal', valueType: 'str' },
						{ tm: 50000, value: 'bold', valueType: 'str' },
						{ tm: 100000, value: 'normal', valueType: 'str' },
					],
				},
			],
		});
		expect(result).toStrictEqual({ bold: true });
	});

	it('resolves Change Font Size as a relative scale from the first/last p:anim stops', () => {
		const result = resolveTextStyleAnimation({
			attributeAnimations: [
				{
					attrName: 'style.fontsize',
					keyframes: [
						{ tm: 0, value: 20, valueType: 'int' },
						{ tm: 100000, value: 40, valueType: 'int' },
					],
				},
			],
		});
		expect(result).toStrictEqual({ fontScale: 2 });
	});

	it('ignores an attributeAnimations component for an unrecognised attr', () => {
		const result = resolveTextStyleAnimation({
			attributeAnimations: [
				{
					attrName: 'ppt_x',
					keyframes: [
						{ tm: 0, value: 0, valueType: 'int' },
						{ tm: 100000, value: 1, valueType: 'int' },
					],
				},
			],
		});
		expect(result).toBeUndefined();
	});

	it('merges multiple p:set siblings composed by one effect (Change Font Style combos)', () => {
		const result = resolveTextStyleAnimation({
			setAnimations: [
				{ attrName: 'style.fontweight', value: 'bold', valueType: 'str' },
				{ attrName: 'style.fontstyle', value: 'italic', valueType: 'str' },
				{ attrName: 'style.textdecorationunderline', value: true, valueType: 'bool' },
			],
		});
		expect(result).toStrictEqual({ bold: true, italic: true, underline: true });
	});

	it('guards a zero first-stop font-size against a divide-by-zero scale', () => {
		const result = resolveTextStyleAnimation({
			attributeAnimations: [
				{
					attrName: 'style.fontsize',
					keyframes: [
						{ tm: 0, value: 0, valueType: 'int' },
						{ tm: 100000, value: 40, valueType: 'int' },
					],
				},
			],
		});
		expect(result).toBeUndefined();
	});
});
