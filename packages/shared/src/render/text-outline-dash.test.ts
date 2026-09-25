import { describe, expect, it } from 'vitest';

import { resolveTextOutlineDashCss } from './text-outline-dash';

describe('resolveTextOutlineDashCss (audit-text slide 13 "DASH OUTLINE")', () => {
	it('paints a dashed outline as clipped diagonal stripes under a transparent stroke', () => {
		const css = resolveTextOutlineDashCss(
			{ textOutlineWidth: 3, textOutlineColor: '#000000', textOutlineDash: 'dash' },
			'#FFC000',
		);
		expect(css).toStrictEqual({
			WebkitTextStroke: '3px transparent',
			WebkitTextFillColor: '#FFC000',
			background: 'repeating-linear-gradient(45deg, #000000 0px 12px, transparent 12px 21px)',
			backgroundClip: 'text',
			WebkitBackgroundClip: 'text',
		});
	});

	it('scales a compound preset by the line width', () => {
		const css = resolveTextOutlineDashCss(
			{ textOutlineWidth: 2, textOutlineColor: 'FF0000', textOutlineDash: 'dashDot' },
			'#000000',
		);
		expect(css?.background).toBe(
			'repeating-linear-gradient(45deg, #FF0000 0px 8px, transparent 8px 14px, #FF0000 14px 16px, transparent 16px 22px)',
		);
	});

	it('keeps a hollow run transparent inside the dashes', () => {
		const css = resolveTextOutlineDashCss(
			{ textOutlineWidth: 2, textOutlineDash: 'sysDot', textFillNone: true },
			'#123456',
		);
		expect(css?.WebkitTextFillColor).toBe('transparent');
	});

	it.each([
		['no dash', { textOutlineWidth: 2 }],
		['unknown dash', { textOutlineWidth: 2, textOutlineDash: 'bogus' }],
		['no width', { textOutlineDash: 'dash' }],
		['gradient text fill', { textOutlineWidth: 2, textOutlineDash: 'dash', textFillGradient: 'x' }],
		['highlight', { textOutlineWidth: 2, textOutlineDash: 'dash', highlightColor: '#ff0' }],
	])('leaves the solid stroke alone for %s', (_label, style) => {
		expect(resolveTextOutlineDashCss(style, '#000')).toBeUndefined();
	});
});
