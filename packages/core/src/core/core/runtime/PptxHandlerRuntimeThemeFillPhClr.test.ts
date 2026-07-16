import { describe, expect, it } from 'vitest';

import type { ShapeStyle, XmlObject } from '../../types';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';

class ThemeFillRuntime extends PptxHandlerRuntime {
	public resolveFill(fillTag: string, fillStyle: XmlObject, refNode: XmlObject): ShapeStyle {
		this.themeColorMap = { accent1: '#2468AC' };
		this.themeFormatScheme = {
			fillStyles: this.parseFillStyleList({ [fillTag]: fillStyle }),
			lineStyles: [],
			effectStyles: [],
			backgroundFillStyles: [],
		};
		const style: ShapeStyle = {};
		this.resolveThemeFillRef(refNode, style);
		return style;
	}
}

describe('theme fill placeholder colours', () => {
	const refNode: XmlObject = {
		'@_idx': '1',
		'a:schemeClr': { '@_val': 'accent1' },
	};

	it('resolves phClr and opacity in a solid fill style', () => {
		const style = new ThemeFillRuntime().resolveFill(
			'a:solidFill',
			{
				'a:schemeClr': {
					'@_val': 'phClr',
					'a:alpha': { '@_val': '35000' },
				},
			},
			refNode,
		);

		expect(style.fillColor).toBe('#2468AC');
		expect(style.fillOpacity).toBe(0.35);
	});

	it('does not replace a fixed solid fill with the reference colour', () => {
		const style = new ThemeFillRuntime().resolveFill(
			'a:solidFill',
			{ 'a:srgbClr': { '@_val': 'C03020' } },
			refNode,
		);

		expect(style.fillColor).toBe('#C03020');
	});

	it('resolves phClr independently in a pattern background', () => {
		const style = new ThemeFillRuntime().resolveFill(
			'a:pattFill',
			{
				'@_prst': 'pct20',
				'a:fgClr': { 'a:srgbClr': { '@_val': '112233' } },
				'a:bgClr': { 'a:schemeClr': { '@_val': 'phClr' } },
			},
			refNode,
		);

		expect(style.fillColor).toBe('#112233');
		expect(style.fillPatternBackgroundColor).toBe('#2468AC');
	});
});
