/**
 * Morph written as a DIRECT child of `p:transition` (issue #130).
 *
 * PowerPoint 2016+ emits Morph two ways. Inside an
 * `mc:Choice Requires="p159"` envelope the requirement is already declared by
 * the envelope, so it writes `<p159:morph/>` straight onto `p:transition`; only
 * the un-wrapped form needs the `p:extLst` escape hatch. The parser handled
 * only the extLst form, so a real deck authored by PowerPoint 365 parsed as
 * `cut` - the slide played NO transition at all, not even the `mc:Fallback`
 * fade, because unwrapping prefers the `mc:Choice` branch.
 */
import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { isAlternateContentChoiceSupported } from '../utils/alternate-content';
import { PptxSlideTransitionService } from './PptxSlideTransitionService';
import { PptxXmlLookupService } from './PptxXmlLookupService';

function createService(): PptxSlideTransitionService {
	return new PptxSlideTransitionService({
		xmlLookupService: new PptxXmlLookupService(),
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

/** The exact envelope PowerPoint 365 writes (verified against issue #130's deck). */
function morphSlideXml(option?: string): XmlObject {
	const morph: XmlObject = {};
	if (option !== undefined) {
		morph['@_option'] = option;
	}
	return {
		'p:sld': {
			'mc:AlternateContent': {
				'mc:Choice': {
					'@_Requires': 'p159',
					'p:transition': { '@_spd': 'slow', 'p159:morph': morph },
				},
				'mc:Fallback': {
					'p:transition': { '@_spd': 'slow', 'p:fade': {} },
				},
			},
		},
	};
}

describe('morph as a direct child of p:transition', () => {
	const service = createService();

	it('is parsed as a morph transition, not silently dropped to cut', () => {
		const result = service.parseSlideTransition(morphSlideXml('byObject'));

		expect(result?.type).toBe('morph');
		expect(result?.speed).toBe('slow');
	});

	it('captures the granularity option', () => {
		expect(service.parseSlideTransition(morphSlideXml('byObject'))?.morphOption).toBe('byObject');
		expect(service.parseSlideTransition(morphSlideXml('byWord'))?.morphOption).toBe('byWord');
		expect(service.parseSlideTransition(morphSlideXml('byChar'))?.morphOption).toBe('byChar');
	});

	it('leaves the option unset when the attribute is absent or unknown', () => {
		expect(service.parseSlideTransition(morphSlideXml())?.morphOption).toBeUndefined();
		expect(service.parseSlideTransition(morphSlideXml('sideways'))?.morphOption).toBeUndefined();
	});

	it('still parses the extLst form, with its option', () => {
		const result = service.parseSlideTransition({
			'p:sld': {
				'p:transition': {
					'@_spd': 'slow',
					'p:extLst': {
						'p:ext': {
							'@_uri': '{C7C9D14B-FE2A-4D35-B620-AB07D5B017F4}',
							'p159:morph': { '@_option': 'byWord' },
						},
					},
				},
			},
		});

		expect(result?.type).toBe('morph');
		expect(result?.morphOption).toBe('byWord');
	});

	it('does not emit the transition twice when re-serialising the direct form', () => {
		const parsed = service.parseSlideTransition(morphSlideXml('byObject'));
		const node = service.buildSlideTransitionXml(parsed!);

		// The preserved `p159:morph` child is the transition; adding the extLst
		// form on top of it would declare Morph twice in one `p:transition`.
		expect(node?.['p159:morph']).toBeDefined();
		expect(node?.['p:extLst']).toBeUndefined();
	});

	it('round-trips the option through the extLst form when there is no preserved child', () => {
		const node = service.buildSlideTransitionXml({ type: 'morph', morphOption: 'byChar' });
		const ext = (node?.['p:extLst'] as XmlObject | undefined)?.['p:ext'] as XmlObject | undefined;

		expect((ext?.['p159:morph'] as XmlObject | undefined)?.['@_option']).toBe('byChar');
	});

	// The compatibility inspector reported UNSUPPORTED_ALTERNATE_CONTENT_CHOICE
	// for every one of these slides ("its fallback is used"), which reads as "the
	// morph was dropped for a fade" even though the choice is exactly what the
	// parser reads. On the reporter's 14-slide deck that was 12 misleading
	// warnings pointing an investigation at a non-existent parsing gap.
	it('reports the p159 morph choice as SUPPORTED, not as a dropped fallback', () => {
		const choice = (morphSlideXml('byObject')['p:sld'] as XmlObject)['mc:AlternateContent'] as
			| XmlObject
			| undefined;
		expect(isAlternateContentChoiceSupported(choice?.['mc:Choice'] as XmlObject)).toBeTruthy();
	});

	// Only `p159:morph` is implemented, so any other element in that namespace
	// must still fall back rather than being silently claimed as handled.
	it('still falls back for a p159 choice carrying an unimplemented element', () => {
		expect(
			isAlternateContentChoiceSupported({
				'@_Requires': 'p159',
				'p:transition': { 'p159:somethingElse': {} },
			}),
		).toBeFalsy();
	});
});
