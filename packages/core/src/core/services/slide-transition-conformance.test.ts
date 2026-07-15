import { describe, expect, it } from 'vitest';

import type { PptxSlideTransition, XmlObject } from '../types';
import { PptxSlideTransitionService } from './PptxSlideTransitionService';
import { PptxXmlLookupService } from './PptxXmlLookupService';

function localName(key: string): string {
	const clean = key.startsWith('@_') ? key.slice(2) : key;
	return clean.slice(clean.lastIndexOf(':') + 1);
}

function service(): PptxSlideTransitionService {
	return new PptxSlideTransitionService({
		xmlLookupService: new PptxXmlLookupService(),
		getXmlLocalName: localName,
	});
}

describe('slide transition conformance', () => {
	it.each(['slow', 'med', 'fast'] as const)('round-trips ST_TransitionSpeed %s', (speed) => {
		const parsed = service().parseSlideTransition({
			'strict:sld': { 'strict:transition': { '@_spd': speed, 'strict:fade': {} } },
		});
		expect(parsed?.speed).toBe(speed);
		expect(service().buildSlideTransitionXml(parsed!)?.['@_spd']).toBe(speed);
	});

	it('rejects invalid speed, boolean, and unsigned integer lexical values', () => {
		const parsed = service().parseSlideTransition({
			'p:sld': {
				'p:transition': {
					'@_spd': 'instant',
					'@_advClick': 'yes',
					'@_advTm': '-1',
					'@_dur': '1.5',
					'p:fade': {},
				},
			},
		});
		expect(parsed).toMatchObject({ type: 'fade' });
		expect(parsed?.speed).toBeUndefined();
		expect(parsed?.advanceOnClick).toBeUndefined();
		expect(parsed?.advanceAfterMs).toBeUndefined();
		expect(parsed?.durationMs).toBeUndefined();
	});

	it('parses embedded WAV fields with arbitrary namespace prefixes', () => {
		const parsed = service().parseSlideTransition({
			'x:sld': {
				'x:transition': {
					'x:fade': {},
					'x:sndAc': {
						'x:stSnd': {
							'@_loop': 'true',
							'x:snd': { '@_rel:embed': 'rId9', '@_name': 'Chime', '@_vendor': 'keep' },
						},
					},
				},
			},
		});
		expect(parsed).toMatchObject({
			type: 'fade',
			soundRId: 'rId9',
			soundName: 'Chime',
			soundLoop: true,
		});
	});

	it('serializes typed start-sound fields and preserves unknown sound markup', () => {
		const transition: PptxSlideTransition = {
			type: 'fade',
			soundRId: 'rId10',
			soundName: 'Edited',
			soundLoop: false,
			rawSoundAction: {
				'x:stSnd': {
					'@_vendor': 'start',
					'x:snd': { '@_rel:embed': 'rId9', '@_name': 'Old', '@_vendor': 'sound' },
				},
				'x:future': { '@_value': 'preserved' },
			},
		};
		const soundAction = service().buildSlideTransitionXml(transition)?.['p:sndAc'] as XmlObject;
		const start = soundAction['x:stSnd'] as XmlObject;
		const sound = start['x:snd'] as XmlObject;
		expect(start).toMatchObject({ '@_loop': '0', '@_vendor': 'start' });
		expect(sound).toMatchObject({
			'@_rel:embed': 'rId10',
			'@_name': 'Edited',
			'@_vendor': 'sound',
		});
		expect(soundAction['x:future']).toStrictEqual({ '@_value': 'preserved' });
	});

	it('preserves unknown transition attributes and children while editing', () => {
		const parsed = service().parseSlideTransition({
			'p:sld': {
				'p:transition': {
					'@_spd': 'slow',
					'@_vendor': 'keep',
					'p:fade': {},
					'v:future': { '@_mode': 'keep' },
				},
			},
		})!;
		parsed.type = 'wipe';
		parsed.direction = 'r';
		const rebuilt = service().buildSlideTransitionXml(parsed)!;
		expect(rebuilt['@_vendor']).toBe('keep');
		expect(rebuilt['v:future']).toStrictEqual({ '@_mode': 'keep' });
		expect(rebuilt['p:fade']).toBeUndefined();
		expect(rebuilt['p:wipe']).toStrictEqual({ '@_dir': 'r' });
	});

	it('omits out-of-range unsigned integer values on typed production', () => {
		const xml = service().buildSlideTransitionXml({
			type: 'wheel',
			spokes: 4_294_967_296,
			advanceAfterMs: 4_294_967_296,
			durationMs: 0,
		});
		expect((xml?.['p:wheel'] as XmlObject | undefined)?.['@_spokes']).toBeUndefined();
		expect(xml?.['@_advTm']).toBeUndefined();
		expect(xml?.['@_dur']).toBeUndefined();
	});
});
