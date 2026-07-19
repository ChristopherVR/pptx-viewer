import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { PptxSlideTransitionService } from './PptxSlideTransitionService';
import { PptxXmlLookupService } from './PptxXmlLookupService';

function createService(): PptxSlideTransitionService {
	const xmlLookupService = new PptxXmlLookupService();
	return new PptxSlideTransitionService({
		xmlLookupService,
		getXmlLocalName: (xmlKey: string) => {
			if (!xmlKey) {
				return '';
			}
			const withoutAttr = xmlKey.startsWith('@_') ? xmlKey.slice(2) : xmlKey;
			const idx = withoutAttr.lastIndexOf(':');
			return idx < 0 ? withoutAttr : withoutAttr.slice(idx + 1);
		},
	});
}

// ---------------------------------------------------------------------------
// parseSlideTransition
// ---------------------------------------------------------------------------

describe('pptxSlideTransitionService.parseSlideTransition', () => {
	const service = createService();

	it('returns undefined for undefined input', () => {
		expect(service.parseSlideTransition(undefined)).toBeUndefined();
	});

	it('returns undefined when slide has no transition element', () => {
		const slideXml: XmlObject = {
			'p:sld': {},
		};
		expect(service.parseSlideTransition(slideXml)).toBeUndefined();
	});

	it('parses a basic fade transition', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:transition': {
					'@_dur': '1000',
					'p:fade': {},
				},
			},
		};
		const result = service.parseSlideTransition(slideXml);
		expect(result).toBeDefined();
		expect(result!.type).toBe('fade');
		expect(result!.durationMs).toBe(1000);
	});

	it('parses a wipe transition with direction', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:transition': {
					'p:wipe': { '@_dir': 'd' },
				},
			},
		};
		const result = service.parseSlideTransition(slideXml);
		expect(result).toBeDefined();
		expect(result!.type).toBe('wipe');
		expect(result!.direction).toBe('d');
	});

	it('parses a split transition with orientation', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:transition': {
					'p:split': { '@_orient': 'horz' },
				},
			},
		};
		const result = service.parseSlideTransition(slideXml);
		expect(result).toBeDefined();
		expect(result!.type).toBe('split');
		expect(result!.orient).toBe('horz');
	});

	it('parses a wheel transition with spokes', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:transition': {
					'p:wheel': { '@_spokes': '4' },
				},
			},
		};
		const result = service.parseSlideTransition(slideXml);
		expect(result).toBeDefined();
		expect(result!.type).toBe('wheel');
		expect(result!.spokes).toBe(4);
	});

	it('accepts spokes values above the historical 1-8 range (ST_WheelTransition is unsignedInt)', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:transition': {
					'p:wheel': { '@_spokes': '20' },
				},
			},
		};
		const result = service.parseSlideTransition(slideXml);
		expect(result!.type).toBe('wheel');
		expect(result!.spokes).toBe(20);
	});

	it('accepts spokes values >= 9', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:transition': {
					'p:wheel': { '@_spokes': '12' },
				},
			},
		};
		const result = service.parseSlideTransition(slideXml);
		expect(result!.spokes).toBe(12);
	});

	it('rejects spokes values < 1', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:transition': {
					'p:wheel': { '@_spokes': '0' },
				},
			},
		};
		const result = service.parseSlideTransition(slideXml);
		expect(result!.spokes).toBeUndefined();
	});

	it('parses advanceOnClick attribute', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:transition': {
					'@_advClick': '0',
					'p:fade': {},
				},
			},
		};
		const result = service.parseSlideTransition(slideXml);
		expect(result!.advanceOnClick).toBeFalsy();
	});

	it('parses advanceAfterMs attribute', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:transition': {
					'@_advTm': '5000',
					'p:fade': {},
				},
			},
		};
		const result = service.parseSlideTransition(slideXml);
		expect(result!.advanceAfterMs).toBe(5000);
	});

	it('parses a push transition', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:transition': {
					'p:push': { '@_dir': 'r' },
				},
			},
		};
		const result = service.parseSlideTransition(slideXml);
		expect(result!.type).toBe('push');
		expect(result!.direction).toBe('r');
	});

	it('parses thruBlk attribute', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:transition': {
					'p:blinds': { '@_thruBlk': '1' },
				},
			},
		};
		const result = service.parseSlideTransition(slideXml);
		expect(result!.type).toBe('blinds');
		expect(result!.thruBlk).toBeTruthy();
	});

	it('defaults to cut when no transition type element is present', () => {
		const slideXml: XmlObject = {
			'p:sld': {
				'p:transition': {
					'@_dur': '250',
				},
			},
		};
		const result = service.parseSlideTransition(slideXml);
		expect(result!.type).toBe('cut');
	});
});

// ---------------------------------------------------------------------------
// buildSlideTransitionXml
// ---------------------------------------------------------------------------

describe('pptxSlideTransitionService.buildSlideTransitionXml', () => {
	const service = createService();

	it('returns undefined for "none" transition type', () => {
		const result = service.buildSlideTransitionXml({
			type: 'none',
		});
		expect(result).toBeUndefined();
	});

	it('builds a fade transition XML', () => {
		const result = service.buildSlideTransitionXml({
			type: 'fade',
			durationMs: 1000,
		});
		expect(result).toBeDefined();
		expect(result!['p:fade']).toBeDefined();
		expect(result!['@_dur']).toBe('1000');
	});

	it('builds a wipe transition with direction', () => {
		const result = service.buildSlideTransitionXml({
			type: 'wipe',
			direction: 'd',
		});
		expect(result).toBeDefined();
		expect(result!['p:wipe']).toBeDefined();
		const wipeNode = result!['p:wipe'] as XmlObject;
		expect(wipeNode['@_dir']).toBe('d');
	});

	it('builds a split transition with orientation', () => {
		const result = service.buildSlideTransitionXml({
			type: 'split',
			orient: 'vert',
		});
		expect(result).toBeDefined();
		const splitNode = result!['p:split'] as XmlObject;
		expect(splitNode['@_orient']).toBe('vert');
	});

	it('builds a wheel transition with spokes', () => {
		const result = service.buildSlideTransitionXml({
			type: 'wheel',
			spokes: 4,
		});
		expect(result).toBeDefined();
		const wheelNode = result!['p:wheel'] as XmlObject;
		expect(wheelNode['@_spokes']).toBe('4');
	});

	it('includes advanceOnClick attribute', () => {
		const result = service.buildSlideTransitionXml({
			type: 'fade',
			advanceOnClick: false,
		});
		expect(result!['@_advClick']).toBe('0');
	});

	it('includes advanceAfterMs attribute', () => {
		const result = service.buildSlideTransitionXml({
			type: 'fade',
			advanceAfterMs: 3000,
		});
		expect(result!['@_advTm']).toBe('3000');
	});

	it('builds a cut transition as default', () => {
		const result = service.buildSlideTransitionXml({
			type: 'cut',
		});
		expect(result).toBeDefined();
		expect(result!['p:cut']).toStrictEqual({});
	});

	it('includes rawSoundAction when present', () => {
		const rawSound: XmlObject = { 'p:stSnd': { 'p:snd': {} } };
		const result = service.buildSlideTransitionXml({
			type: 'fade',
			rawSoundAction: rawSound,
		});
		expect(result!['p:sndAc']).toBe(rawSound);
	});

	it('includes rawExtLst for non-p14 types', () => {
		const rawExt: XmlObject = { 'p:ext': {} };
		const result = service.buildSlideTransitionXml({
			type: 'fade',
			rawExtLst: rawExt,
		});
		expect(result!['p:extLst']).toBe(rawExt);
	});

	it('builds thruBlk attribute', () => {
		const result = service.buildSlideTransitionXml({
			type: 'blinds',
			thruBlk: true,
		});
		const blindsNode = result!['p:blinds'] as XmlObject;
		expect(blindsNode['@_thruBlk']).toBe('1');
	});

	it('omits duration when not finite', () => {
		const result = service.buildSlideTransitionXml({
			type: 'fade',
			durationMs: NaN,
		});
		expect(result!['@_dur']).toBeUndefined();
	});

	it('omits duration when zero or negative', () => {
		const result = service.buildSlideTransitionXml({
			type: 'fade',
			durationMs: 0,
		});
		expect(result!['@_dur']).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// p15 preset transitions (Fracture, Peel Off, Page Curl, etc.) - issue #77
// ---------------------------------------------------------------------------

describe('pptxSlideTransitionService p15 preset transitions', () => {
	const service = createService();

	function fractureSlideXml(): XmlObject {
		return {
			'p:sld': {
				'p:transition': {
					'@_spd': 'slow',
					'p:extLst': {
						'p:ext': {
							'@_uri': '{D42A27DB-BD31-4B8C-83A1-F6EECF244321}',
							'p15:prstTrans': {
								'@_xmlns:p15': 'http://schemas.microsoft.com/office/powerpoint/2012/main',
								'@_prst': 'fracture',
							},
						},
					},
				},
			},
		};
	}

	it('parses a p15:prstTrans prst="fracture" as a fracture transition', () => {
		const result = service.parseSlideTransition(fractureSlideXml());
		expect(result).toBeDefined();
		expect(result!.type).toBe('fracture');
		expect(result!.rawExtLst).toBeDefined();
	});

	it('re-serializes fracture WITHOUT a spurious p:cut child (issue #77)', () => {
		const parsed = service.parseSlideTransition(fractureSlideXml());
		const rebuilt = service.buildSlideTransitionXml(parsed!);
		expect(rebuilt).toBeDefined();
		// The defect: a fallback <p:cut/> was emitted alongside the real extLst.
		expect(rebuilt!['p:cut']).toBeUndefined();
		// No standard child of any kind should be present.
		expect(rebuilt!['p:fracture']).toBeUndefined();
		// The real transition bytes survive in the preserved extLst.
		const extLst = rebuilt!['p:extLst'] as XmlObject;
		expect(extLst).toBeDefined();
		const ext = extLst['p:ext'] as XmlObject;
		const prstTrans = ext['p15:prstTrans'] as XmlObject;
		expect(prstTrans['@_prst']).toBe('fracture');
	});

	it('fabricates a p15:prstTrans extLst when no rawExtLst is present', () => {
		const rebuilt = service.buildSlideTransitionXml({ type: 'peelOff' });
		expect(rebuilt).toBeDefined();
		expect(rebuilt!['p:cut']).toBeUndefined();
		expect(rebuilt!['p:peelOff']).toBeUndefined();
		const ext = (rebuilt!['p:extLst'] as XmlObject)['p:ext'] as XmlObject;
		expect((ext['p15:prstTrans'] as XmlObject)['@_prst']).toBe('peelOff');
	});
});
