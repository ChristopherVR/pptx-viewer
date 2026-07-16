import { describe, expect, it } from 'vitest';

import type { ShapeStyle, XmlObject } from '../../types';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';

class ThemeEffectRuntime extends PptxHandlerRuntime {
	public resolveEffect(effectStyle: XmlObject, refNode: XmlObject): ShapeStyle {
		this.themeColorMap = { accent1: '#2468AC' };
		this.themeFormatScheme = {
			fillStyles: [],
			lineStyles: [],
			effectStyles: this.parseEffectStyleList({ 'a:effectStyle': effectStyle }),
			backgroundFillStyles: [],
		};
		const style: ShapeStyle = {};
		this.resolveThemeEffectRef(refNode, style);
		return style;
	}
}

describe('theme effect placeholder colours', () => {
	it('resolves phClr in a referenced effect style from the effectRef colour', () => {
		const effectStyle: XmlObject = {
			'a:effectLst': {
				'a:outerShdw': {
					'@_blurRad': '19050',
					'a:schemeClr': {
						'@_val': 'phClr',
						'a:alpha': { '@_val': '45000' },
					},
				},
			},
		};
		const style = new ThemeEffectRuntime().resolveEffect(effectStyle, {
			'@_idx': '1',
			'a:schemeClr': { '@_val': 'accent1' },
		});

		expect(style.shadowColor).toBe('#2468AC');
		expect(style.shadowOpacity).toBe(0.45);
		expect(style.shadowBlur).toBe(2);
	});
});
