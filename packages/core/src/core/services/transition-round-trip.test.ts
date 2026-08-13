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

	it('should preserve pattern on shred transition as a p14 direct child', () => {
		const transition: PptxSlideTransition = {
			type: 'shred',
			pattern: 'strip',
			direction: 'in',
			durationMs: 800,
		};

		const xml = service.buildSlideTransitionXml(transition);
		expect(xml).toBeDefined();

		// The extLst form PowerPoint ignores (EntryEffect 0, measured through COM)
		// is gone: the element is a direct child, and the reconciler envelopes it.
		expect(xml!['p:extLst']).toBeUndefined();
		const shred = xml!['p14:shred'] as XmlObject;
		expect(shred['@_pattern']).toBe('strip');
		expect(shred['@_dir']).toBe('in');
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

	it('emits morph as a p159 direct child carrying its mandatory option', () => {
		const xml = service.buildSlideTransitionXml({ type: 'morph', durationMs: 1000 });
		expect(xml).toBeDefined();
		expect(xml!['p:morph']).toBeUndefined();
		// The extLst form reopens in PowerPoint as no transition at all, and a
		// morph element with no `option` makes the file unopenable: PowerPoint
		// writes `<p159:morph option="byObject"/>` inside an mc:Choice.
		expect(xml!['p:extLst']).toBeUndefined();
		const morphChild = xml!['p159:morph'] as XmlObject;
		expect(morphChild['@_option']).toBe('byObject');
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
		expect(rebuilt!['p:extLst']).toBeUndefined();
		expect(rebuilt!['p159:morph']).toBeDefined();
		expect(service.parseSlideTransition({ 'p:sld': { 'p:transition': rebuilt! } })!.type).toBe(
			'morph',
		);
	});

	it('keeps unrelated ext entries while lifting morph out of the extLst', () => {
		const transition: PptxSlideTransition = {
			type: 'morph',
			rawExtLst: {
				'p:ext': [
					{ '@_uri': '{SOME-OTHER-URI}', 'foo:bar': {} },
					{
						'@_uri': '{C7C9D14B-FE2A-4D35-B620-AB07D5B017F4}',
						'p159:morph': { '@_option': 'byWord' },
					},
				],
			},
		};
		const xml = service.buildSlideTransitionXml(transition);
		// The morph declaration moves onto the element; the stale ext that also
		// declared it must go, or the transition would be declared twice.
		expect((xml!['p159:morph'] as XmlObject)['@_option']).toBe('byWord');
		const exts = (xml!['p:extLst'] as XmlObject)['p:ext'] as XmlObject;
		expect(Array.isArray(exts)).toBeFalsy();
		expect(exts['foo:bar']).toBeDefined();
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

	// `flip` has its own p14 element and a MANDATORY left/right `dir`: PowerPoint
	// refuses to open `<p14:flip/>` at all.
	it('serializes p14 flip as a direct child with a left/right direction', () => {
		const xml = service.buildSlideTransitionXml({ type: 'flip', direction: 'r' });
		expect(xml!['p:flip']).toBeUndefined();
		expect(xml!['p:extLst']).toBeUndefined();
		expect((xml!['p14:flip'] as XmlObject)['@_dir']).toBe('r');
	});

	it('forces a left/right direction on the p14 elements that require one', () => {
		for (const name of ['conveyor', 'ferris', 'flip', 'gallery', 'switch'] as const) {
			const xml = service.buildSlideTransitionXml({ type: name });
			expect((xml![`p14:${name}`] as XmlObject)['@_dir']).toBe('l');
		}
	});

	// Cube, Rotate and Orbit have no element of their own: PowerPoint writes all
	// of them as `p14:prism`, told apart by `isContent` / `isInverted`. Emitting
	// `<p14:cube/>` left PowerPoint showing no transition.
	it.each([
		['cube', undefined, undefined],
		['rotate', undefined, '1'],
		['orbit', '1', '1'],
	] as const)('serializes %s as a p14:prism variant', (name, isContent, isInverted) => {
		const xml = service.buildSlideTransitionXml({ type: name, direction: 'r' });
		expect(xml![`p14:${name}`]).toBeUndefined();
		expect(xml!['p:extLst']).toBeUndefined();
		const prism = xml!['p14:prism'] as XmlObject;
		expect(prism['@_dir']).toBe('r');
		expect(prism['@_isContent']).toBe(isContent);
		expect(prism['@_isInverted']).toBe(isInverted);
	});

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
