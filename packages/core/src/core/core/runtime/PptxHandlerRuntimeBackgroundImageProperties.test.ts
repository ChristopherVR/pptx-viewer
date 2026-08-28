import { describe, expect, it } from 'vitest';

import type { PptxImageProperties, XmlObject } from '../../types';
import { PptxHandlerRuntime } from '../PptxHandlerRuntime';

class BackgroundPropertiesProbe extends PptxHandlerRuntime {
	public parse(slide: XmlObject, rootElement?: string): PptxImageProperties | undefined {
		return this.extractBackgroundImageProperties(slide, rootElement);
	}
}

class BackgroundInheritanceProbe extends PptxHandlerRuntime {
	public masterFallbackCalls = 0;

	public constructor() {
		super();
		this.slideRelsMap.set(
			'ppt/slides/slide1.xml',
			new Map([['rId1', '../slideLayouts/slideLayout1.xml']]),
		);
	}

	public loadInheritedImage(): Promise<string | undefined> {
		return this.getLayoutBackgroundImage('ppt/slides/slide1.xml');
	}

	protected override async resolveCachedLayoutXml(): Promise<XmlObject> {
		return { 'p:sldLayout': { 'p:cSld': {} } };
	}

	protected override async loadSlideRelationships(): Promise<void> {}

	protected override async extractBackgroundImage(): Promise<string | undefined> {
		return undefined;
	}

	protected override async getMasterBackgroundImage(): Promise<string | undefined> {
		this.masterFallbackCalls += 1;
		return 'data:image/png;base64,master-background';
	}
}

describe('extractBackgroundImageProperties', () => {
	it('preserves crop, tile placement and image effects from p:bg', () => {
		const parsed = new BackgroundPropertiesProbe().parse({
			'p:sld': {
				'p:cSld': {
					'p:bg': {
						'p:bgPr': {
							'a:blipFill': {
								'a:blip': { 'a:alphaModFix': { '@_amt': '50000' } },
								'a:srcRect': { '@_l': '10000', '@_t': '20000' },
								'a:tile': {
									'@_tx': '19050',
									'@_ty': '9525',
									'@_sx': '50000',
									'@_sy': '75000',
									'@_flip': 'xy',
									'@_algn': 'ctr',
								},
							},
						},
					},
				},
			},
		});

		expect(parsed).toMatchObject({
			cropLeft: 0.1,
			cropTop: 0.2,
			tileOffsetX: 2,
			tileOffsetY: 1,
			tileScaleX: 0.5,
			tileScaleY: 0.75,
			tileFlip: 'xy',
			tileAlignment: 'ctr',
			imageEffects: { alphaModFix: 50 },
		});
	});

	it('supports layout and master root tags', () => {
		const parsed = new BackgroundPropertiesProbe().parse(
			{
				'p:sldLayout': {
					'p:cSld': {
						'p:bg': { 'p:bgPr': { 'a:blipFill': { 'a:blip': {} } } },
					},
				},
			},
			'p:sldLayout',
		);
		expect(parsed).toBeUndefined();
	});
});

describe('background image inheritance', () => {
	it('awaits an empty layout image before falling back to the master', async () => {
		const probe = new BackgroundInheritanceProbe();
		await expect(probe.loadInheritedImage()).resolves.toBe(
			'data:image/png;base64,master-background',
		);
		expect(probe.masterFallbackCalls).toBe(1);
	});
});
