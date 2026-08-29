import { describe, expect, it } from 'vitest';

import type { PptxNativeAnimation } from '../types';
import { resolveNativeAnimationThemeColors } from './native-animation-theme-colors';

describe('resolveNativeAnimationThemeColors', () => {
	it('resolves scheme tokens on the primary and sibling colour behaviours', () => {
		const animations: PptxNativeAnimation[] = [
			{
				targetId: 'shape1',
				presetClass: 'emph',
				colorAnimation: {
					colorSpace: 'rgb',
					toColor: 'bg1',
					components: [
						{ colorSpace: 'rgb', toColor: 'bg1', targetAttribute: 'style.color' },
						{ colorSpace: 'rgb', toColor: 'accent1', targetAttribute: 'fillcolor' },
					],
				},
			} as PptxNativeAnimation,
		];
		const colors: Record<string, string> = {
			accent1: '#4472C4',
			bg1: '#FFFFFF',
		};
		const resolved = resolveNativeAnimationThemeColors(animations, (token) => colors[token]);
		expect(resolved[0].colorAnimation?.toColor).toBe('#FFFFFF');
		expect(
			resolved[0].colorAnimation?.components?.map((component) => component.toColor),
		).toStrictEqual(['#FFFFFF', '#4472C4']);
	});

	it('preserves concrete and unknown tokens without corrupting them', () => {
		const animations = [
			{
				targetId: 'shape1',
				colorAnimation: { colorSpace: 'rgb', fromColor: '#102030', toColor: 'custom7' },
			} as PptxNativeAnimation,
		];
		const resolved = resolveNativeAnimationThemeColors(animations, () => undefined);
		expect(resolved[0].colorAnimation?.fromColor).toBe('#102030');
		expect(resolved[0].colorAnimation?.toColor).toBe('custom7');
	});
});
