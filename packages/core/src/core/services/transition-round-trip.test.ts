import { describe, it, expect } from 'vitest';

import type { XmlObject, PptxSlideTransition } from '../types';
import { PptxSlideTransitionService } from './PptxSlideTransitionService';
import { PptxXmlLookupService } from './PptxXmlLookupService';

function createService(): PptxSlideTransitionService {
	const xmlLookupService = new PptxXmlLookupService();
	return new PptxSlideTransitionService({
		xmlLookupService,
		getXmlLocalName: (key: string) => {
			const idx = key.indexOf(':');
			return idx >= 0 ? key.slice(idx + 1) : key;
		},
	});
}

describe('pptxSlideTransitionService round-trip', () => {
	const service = createService();

	it('should preserve direction attribute on wipe transition', () => {
		const transition: PptxSlideTransition = {
			type: 'wipe',
			direction: 'r',
			durationMs: 500,
		};

		const xml = service.buildSlideTransitionXml(transition);
		expect(xml).toBeDefined();

		const wipe = xml!['p:wipe'] as XmlObject;
		expect(wipe).toBeDefined();
		expect(wipe['@_dir']).toBe('r');
	});

	it('should preserve spokes count on wheel transition', () => {
		const transition: PptxSlideTransition = {
			type: 'wheel',
			spokes: 4,
			durationMs: 700,
		};

		const xml = service.buildSlideTransitionXml(transition);
		expect(xml).toBeDefined();

		const wheel = xml!['p:wheel'] as XmlObject;
		expect(wheel).toBeDefined();
		expect(wheel['@_spokes']).toBe('4');
	});

	it('should preserve orient on split transition', () => {
		const transition: PptxSlideTransition = {
			type: 'split',
			orient: 'vert',
			direction: 'out',
			durationMs: 600,
		};

		const xml = service.buildSlideTransitionXml(transition);
		expect(xml).toBeDefined();

		const split = xml!['p:split'] as XmlObject;
		expect(split).toBeDefined();
		expect(split['@_orient']).toBe('vert');
		expect(split['@_dir']).toBe('out');
	});

	it('should preserve pattern on shred transition via p14 extLst', () => {
		const transition: PptxSlideTransition = {
			type: 'shred',
			pattern: 'strip',
			direction: 'in',
			durationMs: 800,
		};

		const xml = service.buildSlideTransitionXml(transition);
		expect(xml).toBeDefined();

		// shred is a p14 type, should be in extLst
		const extLst = xml!['p:extLst'] as XmlObject;
		expect(extLst).toBeDefined();
	});

	it('should preserve thruBlk on blinds transition', () => {
		const transition: PptxSlideTransition = {
			type: 'blinds',
			thruBlk: true,
			orient: 'horz',
		};

		const xml = service.buildSlideTransitionXml(transition);
		expect(xml).toBeDefined();

		const blinds = xml!['p:blinds'] as XmlObject;
		expect(blinds).toBeDefined();
		expect(blinds['@_thruBlk']).toBe('1');
		expect(blinds['@_orient']).toBe('horz');
	});

	it('should preserve advanceOnClick and advanceAfterMs', () => {
		const transition: PptxSlideTransition = {
			type: 'fade',
			durationMs: 500,
			advanceOnClick: false,
			advanceAfterMs: 3000,
		};

		const xml = service.buildSlideTransitionXml(transition);
		expect(xml).toBeDefined();
		expect(xml!['@_advClick']).toBe('0');
		expect(xml!['@_advTm']).toBe('3000');
	});

	it('should preserve rawSoundAction', () => {
		const rawSoundAction: XmlObject = {
			'p:stSnd': {
				'p:snd': {
					'@_r:embed': 'rId5',
					'@_name': 'chime.wav',
				},
			},
		};

		const transition: PptxSlideTransition = {
			type: 'fade',
			durationMs: 500,
			rawSoundAction,
		};

		const xml = service.buildSlideTransitionXml(transition);
		expect(xml).toBeDefined();
		expect(xml!['p:sndAc']).toBeDefined();
		const stSnd = (xml!['p:sndAc'] as XmlObject)['p:stSnd'] as XmlObject;
		expect(stSnd).toBeDefined();
		const snd = stSnd['p:snd'] as XmlObject;
		expect(snd['@_r:embed']).toBe('rId5');
	});

	it('should return undefined for type "none"', () => {
		const transition: PptxSlideTransition = {
			type: 'none',
		};

		const xml = service.buildSlideTransitionXml(transition);
		expect(xml).toBeUndefined();
	});

	it('should parse direction from slide XML', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:transition': {
					'@_dur': '700',
					'p:wipe': {
						'@_dir': 'r',
					},
				},
			},
		};

		const parsed = service.parseSlideTransition(slideXml);
		expect(parsed).toBeDefined();
		expect(parsed!.type).toBe('wipe');
		expect(parsed!.direction).toBe('r');
		expect(parsed!.durationMs).toBe(700);
	});

	it('should parse spokes from wheel transition', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:transition': {
					'@_dur': '500',
					'p:wheel': {
						'@_spokes': '6',
					},
				},
			},
		};

		const parsed = service.parseSlideTransition(slideXml);
		expect(parsed).toBeDefined();
		expect(parsed!.type).toBe('wheel');
		expect(parsed!.spokes).toBe(6);
	});

	it('should extract soundRId from rawSoundAction', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:transition': {
					'@_dur': '500',
					'p:fade': {},
					'p:sndAc': {
						'p:stSnd': {
							'p:snd': {
								'@_r:embed': 'rId7',
							},
						},
					},
				},
			},
		};

		const parsed = service.parseSlideTransition(slideXml);
		expect(parsed).toBeDefined();
		expect(parsed!.soundRId).toBe('rId7');
		expect(parsed!.rawSoundAction).toBeDefined();
	});

	// -----------------------------------------------------------------------
	// PowerPoint 2016+ morph transition (p159 extension)
	// -----------------------------------------------------------------------

	it('emits morph as a p159 extLst entry, never as <p:morph/>', () => {
		const xml = service.buildSlideTransitionXml({ type: 'morph', durationMs: 1000 });
		expect(xml).toBeDefined();
		// PowerPoint silently drops <p:morph/> as a direct child — must be an extLst.
		expect(xml!['p:morph']).toBeUndefined();
		const extLst = xml!['p:extLst'] as XmlObject;
		expect(extLst).toBeDefined();
		const ext = extLst['p:ext'] as XmlObject;
		expect(ext).toBeDefined();
		expect(ext['@_uri']).toBe('{C7C9D14B-FE2A-4D35-B620-AB07D5B017F4}');
		const morphChild = ext['p159:morph'] as XmlObject;
		expect(morphChild).toBeDefined();
		expect(morphChild['@_xmlns:p159']).toBe(
			'http://schemas.microsoft.com/office/powerpoint/2015/09/main',
		);
	});

	it('parses morph from p159 extLst', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:transition': {
					'@_dur': '750',
					'p:extLst': {
						'p:ext': {
							'@_uri': '{C7C9D14B-FE2A-4D35-B620-AB07D5B017F4}',
							'p159:morph': {
								'@_xmlns:p159': 'http://schemas.microsoft.com/office/powerpoint/2015/09/main',
							},
						},
					},
				},
			},
		};
		const parsed = service.parseSlideTransition(slideXml);
		expect(parsed).toBeDefined();
		expect(parsed!.type).toBe('morph');
		expect(parsed!.durationMs).toBe(750);
	});

	it('round-trips morph via parse → build → parse', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:transition': {
					'p:extLst': {
						'p:ext': {
							'@_uri': '{C7C9D14B-FE2A-4D35-B620-AB07D5B017F4}',
							'p159:morph': {},
						},
					},
				},
			},
		};
		const parsed = service.parseSlideTransition(slideXml);
		expect(parsed!.type).toBe('morph');

		const rebuilt = service.buildSlideTransitionXml(parsed!);
		expect(rebuilt!['p:morph']).toBeUndefined();
		const ext = (rebuilt!['p:extLst'] as XmlObject)['p:ext'] as XmlObject;
		expect(ext['@_uri']).toBe('{C7C9D14B-FE2A-4D35-B620-AB07D5B017F4}');
		expect(ext['p159:morph']).toBeDefined();
	});

	it('preserves non-morph ext entries when rebuilding morph extLst', () => {
		const transition: PptxSlideTransition = {
			type: 'morph',
			rawExtLst: {
				'p:ext': [
					{ '@_uri': '{SOME-OTHER-URI}', 'foo:bar': {} },
					{
						'@_uri': '{C7C9D14B-FE2A-4D35-B620-AB07D5B017F4}',
						'p159:morph': {},
					},
				],
			},
		};
		const xml = service.buildSlideTransitionXml(transition);
		const extLst = xml!['p:extLst'] as XmlObject;
		const exts = extLst['p:ext'];
		expect(Array.isArray(exts)).toBeTruthy();
		const arr = exts as XmlObject[];
		expect(arr).toHaveLength(2);
		expect(arr[0]['p159:morph']).toBeDefined();
		expect(arr[1]['foo:bar']).toBeDefined();
	});

	// -----------------------------------------------------------------------
	// p14 3D transitions: cube / flip / rotate / orbit
	// -----------------------------------------------------------------------

	it.each(['cube', 'flip', 'rotate', 'orbit'] as const)(
		'parses p14 %s transition with @dir',
		(name) => {
			const slideXml: XmlObject = {
				'p:sld': {
					'p:transition': {
						'p:extLst': {
							'p:ext': {
								'@_uri': '{CE6CE671-F284-4235-B8B7-4F3F06D5A82C}',
								[`p14:${name}`]: { '@_dir': 'l' },
							},
						},
					},
				},
			};
			const parsed = service.parseSlideTransition(slideXml);
			expect(parsed!.type).toBe(name);
			expect(parsed!.direction).toBe('l');
		},
	);

	it.each(['cube', 'flip', 'rotate', 'orbit'] as const)(
		'serializes p14 %s into the standard p14 extLst',
		(name) => {
			const xml = service.buildSlideTransitionXml({ type: name, direction: 'r' });
			expect(xml![`p:${name}`]).toBeUndefined();
			const ext = (xml!['p:extLst'] as XmlObject)['p:ext'] as XmlObject;
			expect(ext['@_uri']).toBe('{CE6CE671-F284-4235-B8B7-4F3F06D5A82C}');
			const child = ext[`p14:${name}`] as XmlObject;
			expect(child['@_dir']).toBe('r');
		},
	);

	// -----------------------------------------------------------------------
	// cut/fade thruBlk preservation (CT_OptionalBlackTransition)
	// -----------------------------------------------------------------------

	it('preserves @thruBlk on cut transition', () => {
		const xml = service.buildSlideTransitionXml({ type: 'cut', thruBlk: true });
		const cut = xml!['p:cut'] as XmlObject;
		expect(cut).toBeDefined();
		expect(cut['@_thruBlk']).toBe('1');
	});

	it('emits empty p:cut when thruBlk is undefined', () => {
		const xml = service.buildSlideTransitionXml({ type: 'cut' });
		expect(xml!['p:cut']).toStrictEqual({});
	});

	it('preserves @thruBlk on fade transition', () => {
		const xml = service.buildSlideTransitionXml({ type: 'fade', thruBlk: false });
		const fade = xml!['p:fade'] as XmlObject;
		expect(fade['@_thruBlk']).toBe('0');
	});

	it('round-trips cut@thruBlk', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:transition': {
					'p:cut': { '@_thruBlk': '1' },
				},
			},
		};
		const parsed = service.parseSlideTransition(slideXml);
		expect(parsed!.type).toBe('cut');
		expect(parsed!.thruBlk).toBeTruthy();

		const rebuilt = service.buildSlideTransitionXml(parsed!);
		const cut = rebuilt!['p:cut'] as XmlObject;
		expect(cut['@_thruBlk']).toBe('1');
	});

	// -----------------------------------------------------------------------
	// endSnd (stop sound) round-trip
	// -----------------------------------------------------------------------

	it('parses endSnd into stopSound=true', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:transition': {
					'p:fade': {},
					'p:sndAc': {
						'p:endSnd': {},
					},
				},
			},
		};
		const parsed = service.parseSlideTransition(slideXml);
		expect(parsed!.stopSound).toBeTruthy();
		expect(parsed!.soundRId).toBeUndefined();
	});

	it('serializes stopSound=true as <p:endSnd/>', () => {
		const xml = service.buildSlideTransitionXml({ type: 'fade', stopSound: true });
		const sndAc = xml!['p:sndAc'] as XmlObject;
		expect(sndAc).toBeDefined();
		expect(sndAc['p:endSnd']).toStrictEqual({});
		expect(sndAc['p:stSnd']).toBeUndefined();
	});

	it('round-trips endSnd', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:transition': {
					'p:fade': {},
					'p:sndAc': { 'p:endSnd': {} },
				},
			},
		};
		const parsed = service.parseSlideTransition(slideXml);
		const rebuilt = service.buildSlideTransitionXml(parsed!);
		const sndAc = rebuilt!['p:sndAc'] as XmlObject;
		expect(sndAc['p:endSnd']).toBeDefined();
	});

	it('stopSound takes precedence over rawSoundAction when both present', () => {
		const xml = service.buildSlideTransitionXml({
			type: 'fade',
			stopSound: true,
			rawSoundAction: { 'p:stSnd': { 'p:snd': { '@_r:embed': 'rIdShouldBeIgnored' } } },
		});
		const sndAc = xml!['p:sndAc'] as XmlObject;
		expect(sndAc['p:endSnd']).toBeDefined();
		expect(sndAc['p:stSnd']).toBeUndefined();
	});

	// -----------------------------------------------------------------------
	// wheel spokes (ST_WheelTransition is unsignedInt — not 1-8)
	// -----------------------------------------------------------------------

	it('serializes wheel spokes >= 9', () => {
		const xml = service.buildSlideTransitionXml({ type: 'wheel', spokes: 12 });
		const wheel = xml!['p:wheel'] as XmlObject;
		expect(wheel['@_spokes']).toBe('12');
	});
});
