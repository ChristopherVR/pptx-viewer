/**
 * Capability declarations for `mc:AlternateContent` choice resolution
 * (issue #132 envelope forms).
 *
 * PowerPoint writes modern transitions inside `mc:Choice Requires="p14"`
 * (e.g. `<p14:reveal/>`) or `Requires="p15"` (`<p15:prstTrans/>`) envelopes
 * with a plain fade in `mc:Fallback`. The capability table used to be
 * missing `reveal`/`ripple` for p14 and had no `p15` entry at all, so those
 * choices reported UNSUPPORTED_ALTERNATE_CONTENT_CHOICE and the fallback
 * fade was used instead of the authored transition.
 */
import { describe, it, expect } from 'vitest';

import { P14_TRANSITION_TYPES } from '../services/p14-transition-parser';
import type { XmlObject } from '../types';
import { areNamespacesSupported, isAlternateContentChoiceSupported } from './mc-capabilities';

function p14Choice(element: string): XmlObject {
	return {
		'@_Requires': 'p14',
		'p:transition': {
			'@_spd': 'slow',
			'@_p14:dur': '3250',
			[`p14:${element}`]: { '@_dir': 'r' },
		},
	};
}

describe('mc-capabilities: p14 transition choices', () => {
	it('supports a choice carrying p14:reveal', () => {
		expect(isAlternateContentChoiceSupported(p14Choice('reveal'))).toBeTruthy();
	});

	it('supports a choice carrying p14:ripple', () => {
		expect(isAlternateContentChoiceSupported(p14Choice('ripple'))).toBeTruthy();
	});

	it('covers every transition the p14 parser handles (no more list drift)', () => {
		for (const type of P14_TRANSITION_TYPES) {
			expect(isAlternateContentChoiceSupported(p14Choice(type)), `p14:${type}`).toBeTruthy();
		}
	});

	it('still falls back for a p14 choice carrying an unimplemented element', () => {
		expect(isAlternateContentChoiceSupported(p14Choice('teleport'))).toBeFalsy();
	});
});

describe('mc-capabilities: p15 preset-transition choices', () => {
	it('declares the p15 namespace as supported', () => {
		expect(areNamespacesSupported('p15')).toBeTruthy();
	});

	it('supports a choice carrying p15:prstTrans', () => {
		expect(
			isAlternateContentChoiceSupported({
				'@_Requires': 'p15',
				'p:transition': {
					'@_spd': 'slow',
					'@_advTm': '3000',
					'p15:prstTrans': { '@_prst': 'origami' },
				},
			}),
		).toBeTruthy();
	});

	// Only `prstTrans` is implemented, so any other element in that namespace
	// must still fall back rather than being silently claimed as handled.
	it('still falls back for a p15 choice carrying an unknown element', () => {
		expect(
			isAlternateContentChoiceSupported({
				'@_Requires': 'p15',
				'p:transition': { 'p15:somethingElse': {} },
			}),
		).toBeFalsy();
	});
});
