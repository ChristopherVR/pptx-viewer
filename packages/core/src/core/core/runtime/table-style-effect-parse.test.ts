import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import { parseTableEffectChain, writeTableEffectChain } from './table-style-effect-parse';

describe('parseTableEffectChain', () => {
	it('returns undefined for an absent node', () => {
		expect(parseTableEffectChain(undefined)).toBeUndefined();
	});

	it('returns undefined for an empty effectLst', () => {
		expect(parseTableEffectChain({})).toBeUndefined();
	});

	it('parses a single outerShdw leaf', () => {
		const effectLst: XmlObject = {
			'a:outerShdw': { '@_blurRad': '40000', '@_dist': '20000', '@_dir': '5400000' },
		};
		const chain = parseTableEffectChain(effectLst);
		expect(chain).toHaveLength(1);
		expect(chain?.[0].kind).toBe('outerShdw');
		expect(chain?.[0].xml['@_blurRad']).toBe('40000');
	});

	it('parses multiple distinct leaves in source document order', () => {
		const effectLst: XmlObject = {
			'a:glow': { '@_rad': '10000' },
			'a:outerShdw': { '@_dist': '5000' },
		};
		const chain = parseTableEffectChain(effectLst);
		expect(chain?.map((e) => e.kind)).toStrictEqual(['glow', 'outerShdw']);
	});

	it('ignores attribute keys and unrecognised elements', () => {
		const effectLst: XmlObject = {
			'@_xmlns:a': 'urn:example',
			'a:notARealEffect': { '@_x': '1' },
			'a:blur': { '@_grow': '0' },
		};
		const chain = parseTableEffectChain(effectLst);
		expect(chain?.map((e) => e.kind)).toStrictEqual(['blur']);
	});

	it('parses repeated leaves of the same kind as separate entries', () => {
		const effectLst: XmlObject = {
			'a:fillOverlay': [{ '@_blend': 'multiply' }, { '@_blend': 'screen' }],
		};
		const chain = parseTableEffectChain(effectLst);
		expect(chain).toHaveLength(2);
		expect(chain?.[0].xml['@_blend']).toBe('multiply');
		expect(chain?.[1].xml['@_blend']).toBe('screen');
	});
});

describe('writeTableEffectChain', () => {
	it('rebuilds a single-leaf effectLst', () => {
		const xml = writeTableEffectChain([{ kind: 'softEdge', xml: { '@_rad': '12700' } }]);
		expect(xml['a:softEdge']).toStrictEqual({ '@_rad': '12700' });
	});

	it('collapses repeated kinds back into an array', () => {
		const xml = writeTableEffectChain([
			{ kind: 'fillOverlay', xml: { '@_blend': 'multiply' } },
			{ kind: 'fillOverlay', xml: { '@_blend': 'screen' } },
		]);
		expect(Array.isArray(xml['a:fillOverlay'])).toBeTruthy();
		expect(xml['a:fillOverlay'] as XmlObject[]).toHaveLength(2);
	});

	it('round-trips parse -> write -> parse to the same chain', () => {
		const original: XmlObject = {
			'a:outerShdw': { '@_blurRad': '40000' },
			'a:glow': { '@_rad': '10000' },
		};
		const chain = parseTableEffectChain(original);
		expect(chain).toBeDefined();
		const rebuilt = writeTableEffectChain(chain ?? []);
		const reparsed = parseTableEffectChain(rebuilt);
		expect(reparsed).toStrictEqual(chain);
	});
});
