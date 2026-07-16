import { describe, expect, it } from 'vitest';

import type { ShapeStyle, XmlObject } from '../../types';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';

class ThemeLineRuntime extends PptxHandlerRuntime {
	public resolveLine(lineStyle: XmlObject, refNode: XmlObject): ShapeStyle {
		this.themeColorMap = { accent1: '#2468AC' };
		this.themeFormatScheme = {
			fillStyles: [],
			lineStyles: this.parseLineStyleList({ 'a:ln': lineStyle }),
			effectStyles: [],
			backgroundFillStyles: [],
		};
		const style: ShapeStyle = {};
		this.resolveThemeLineRef(refNode, style);
		return style;
	}
}

describe('theme line placeholder colours', () => {
	const refNode: XmlObject = {
		'@_idx': '1',
		'a:schemeClr': { '@_val': 'accent1' },
	};

	it('resolves phClr and its transforms from the line style', () => {
		const style = new ThemeLineRuntime().resolveLine(
			{
				'@_w': '19050',
				'a:solidFill': {
					'a:schemeClr': {
						'@_val': 'phClr',
						'a:alpha': { '@_val': '40000' },
					},
				},
			},
			refNode,
		);

		expect(style.strokeColor).toBe('#2468AC');
		expect(style.strokeOpacity).toBe(0.4);
		expect(style.strokeWidth).toBe(2);
	});

	it('does not replace a fixed line-style colour with the reference colour', () => {
		const style = new ThemeLineRuntime().resolveLine(
			{ 'a:solidFill': { 'a:srgbClr': { '@_val': 'C03020' } } },
			refNode,
		);

		expect(style.strokeColor).toBe('#C03020');
	});
});
