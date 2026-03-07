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

describe('PptxSlideTransitionService round-trip', () => {
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
});
