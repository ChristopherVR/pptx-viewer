import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../../types';
import type { MediaTimingData } from './PptxHandlerRuntimeImageEffects';
import {
	parseCtnMediaTiming,
	resolvePlayAcrossSlides,
} from './PptxHandlerRuntimeMediaParsingUtils';

// ---------------------------------------------------------------------------
// Extracted from PptxHandlerRuntimeMediaTimingParsing.walkMediaTimingTree
// Pure re-implementation of the tree-walking logic for direct testing.
// ---------------------------------------------------------------------------

function ensureArray(value: unknown): XmlObject[] {
	if (!value) {
		return [];
	}
	return Array.isArray(value) ? value : [value as XmlObject];
}

/**
 * Extracted from PptxHandlerRuntimeMediaTimingParsing.walkMediaTimingTree.
 * Simplified: does not call resolveRelationshipTarget (poster frame is
 * left as the raw rId value when present).
 *
 * G18: does NOT read `p14:media` (trim/fade/bookmarks/embed) off the timing
 * tree's own `p:extLst` - real PowerPoint never writes that extension there,
 * only under the picture's `p:nvPr/p:extLst` (parsed by `parsePicture`
 * instead). This map carries only the genuine `p:cMediaNode`/`p:cTn` flags.
 */
function walkMediaTimingTree(node: XmlObject, result: Map<string, MediaTimingData>): void {
	if (!node) {
		return;
	}

	for (const mediaTag of ['p:video', 'p:audio']) {
		const mediaNodes = ensureArray(node[mediaTag]);
		for (const mediaNode of mediaNodes) {
			const cMediaNode = mediaNode['p:cMediaNode'] as XmlObject | undefined;
			if (!cMediaNode) {
				continue;
			}

			const tgtEl = cMediaNode['p:tgtEl'] as XmlObject | undefined;
			const spTgt = tgtEl?.['p:spTgt'] as XmlObject | undefined;
			const shapeId = spTgt?.['@_spid'] ? String(spTgt['@_spid']) : undefined;
			if (!shapeId) {
				continue;
			}

			const cTn = cMediaNode['p:cTn'] as XmlObject | undefined;
			const timing = parseCtnMediaTiming(cTn, mediaTag);

			const fullScreen = cMediaNode['@_fullScrn'] === '1' || cMediaNode['@_fullScrn'] === true;

			let volume: number | undefined;
			const volRaw = cMediaNode['@_vol'];
			if (volRaw !== undefined) {
				const volVal = parseInt(String(volRaw));
				if (Number.isFinite(volVal)) {
					volume = Math.max(0, Math.min(1, volVal / 100000));
				}
			}

			const hideWhenNotPlaying =
				cMediaNode['@_showWhenStopped'] === '0' || cMediaNode['@_showWhenStopped'] === false;

			let posterFramePath: string | undefined;
			const posterRId = cMediaNode['@_posterFrame'];
			if (posterRId) {
				posterFramePath = String(posterRId); // simplified stub
			}

			result.set(shapeId, {
				fullScreen: fullScreen || undefined,
				loop: timing.loop || undefined,
				posterFramePath,
				volume,
				autoPlay: timing.autoPlay || undefined,
				playAcrossSlides:
					resolvePlayAcrossSlides(cMediaNode, timing.playAcrossSlides, mediaTag) || undefined,
				hideWhenNotPlaying: hideWhenNotPlaying || undefined,
			});
		}
	}

	// Recurse into timing containers
	const cTn = node['p:cTn'] as XmlObject | undefined;
	if (cTn) {
		const childTnLst = cTn['p:childTnLst'] as XmlObject | undefined;
		if (childTnLst) {
			for (const container of ['p:par', 'p:seq', 'p:excl']) {
				const children = ensureArray(childTnLst[container]);
				for (const child of children) {
					walkMediaTimingTree(child, result);
				}
			}
			walkMediaTimingTree(childTnLst, result);
		}
	}

	for (const container of ['p:par', 'p:seq', 'p:excl', 'p:tnLst']) {
		const children = ensureArray(node[container]);
		for (const child of children) {
			walkMediaTimingTree(child, result);
		}
	}
}

// ---------------------------------------------------------------------------
// walkMediaTimingTree
// ---------------------------------------------------------------------------
describe('walkMediaTimingTree', () => {
	it('should return empty map for empty node', () => {
		const result = new Map<string, MediaTimingData>();
		walkMediaTimingTree({}, result);
		expect(result.size).toBe(0);
	});

	it('should extract video timing data with shape ID', () => {
		const result = new Map<string, MediaTimingData>();
		const node: XmlObject = {
			'p:video': {
				'p:cMediaNode': {
					'p:tgtEl': {
						'p:spTgt': { '@_spid': '42' },
					},
					'p:cTn': {},
				},
			},
		};
		walkMediaTimingTree(node, result);
		expect(result.size).toBe(1);
		expect(result.get('42')).toBeDefined();
	});

	// G18: `p:cTn/@_st`/`@_end` are not real CT_TLCommonTimeNodeData
	// attributes and are never read as trim overrides here; the genuine
	// `p14:trim` lives under the picture's own `p:nvPr/p:extLst`.
	it('should not surface trim fields from cTn @_st/@_end', () => {
		const result = new Map<string, MediaTimingData>();
		const node: XmlObject = {
			'p:video': {
				'p:cMediaNode': {
					'p:tgtEl': { 'p:spTgt': { '@_spid': '42' } },
					'p:cTn': { '@_st': '1000', '@_end': '5000' },
				},
			},
		};
		walkMediaTimingTree(node, result);
		expect(result.get('42')!.trimStartMs).toBeUndefined();
		expect(result.get('42')!.trimEndMs).toBeUndefined();
	});

	it('should extract audio timing data', () => {
		const result = new Map<string, MediaTimingData>();
		const node: XmlObject = {
			'p:audio': {
				'p:cMediaNode': {
					'p:tgtEl': {
						'p:spTgt': { '@_spid': '10' },
					},
					'p:cTn': {
						'@_repeatCount': 'indefinite',
						'@_nodeType': '1',
						'@_dur': 'indefinite',
					},
				},
			},
		};
		walkMediaTimingTree(node, result);
		const data = result.get('10')!;
		expect(data.loop).toBeTruthy();
		expect(data.autoPlay).toBeTruthy();
		expect(data.playAcrossSlides).toBeTruthy();
	});

	it('marks audio with cMediaNode/@numSld > 1 as playAcrossSlides (issue #132 deck form)', () => {
		const result = new Map<string, MediaTimingData>();
		// Background music stored ONLY via numSld: no dur="indefinite" on the cTn.
		const node: XmlObject = {
			'p:audio': {
				'p:cMediaNode': {
					'@_vol': '80000',
					'@_numSld': '999',
					'@_showWhenStopped': '0',
					'p:tgtEl': { 'p:spTgt': { '@_spid': '3' } },
					'p:cTn': { '@_repeatCount': 'indefinite', '@_fill': 'hold' },
				},
			},
		};
		walkMediaTimingTree(node, result);
		const data = result.get('3')!;
		expect(data.playAcrossSlides).toBeTruthy();
		expect(data.loop).toBeTruthy();
	});

	it('does not mark video as playAcrossSlides from numSld', () => {
		const result = new Map<string, MediaTimingData>();
		const node: XmlObject = {
			'p:video': {
				'p:cMediaNode': {
					'@_numSld': '999',
					'p:tgtEl': { 'p:spTgt': { '@_spid': '7' } },
					'p:cTn': {},
				},
			},
		};
		walkMediaTimingTree(node, result);
		expect(result.get('7')!.playAcrossSlides).toBeUndefined();
	});

	it('should parse fullScreen flag', () => {
		const result = new Map<string, MediaTimingData>();
		const node: XmlObject = {
			'p:video': {
				'p:cMediaNode': {
					'@_fullScrn': '1',
					'p:tgtEl': { 'p:spTgt': { '@_spid': '5' } },
				},
			},
		};
		walkMediaTimingTree(node, result);
		expect(result.get('5')!.fullScreen).toBeTruthy();
	});

	it('should parse volume', () => {
		const result = new Map<string, MediaTimingData>();
		const node: XmlObject = {
			'p:video': {
				'p:cMediaNode': {
					'@_vol': '50000', // 50%
					'p:tgtEl': { 'p:spTgt': { '@_spid': '6' } },
				},
			},
		};
		walkMediaTimingTree(node, result);
		expect(result.get('6')!.volume).toBeCloseTo(0.5);
	});

	it('should clamp volume to [0, 1]', () => {
		const result = new Map<string, MediaTimingData>();
		const node: XmlObject = {
			'p:video': {
				'p:cMediaNode': {
					'@_vol': '200000', // > 100%
					'p:tgtEl': { 'p:spTgt': { '@_spid': '7' } },
				},
			},
		};
		walkMediaTimingTree(node, result);
		expect(result.get('7')!.volume).toBe(1);
	});

	it('should parse hideWhenNotPlaying from showWhenStopped=0', () => {
		const result = new Map<string, MediaTimingData>();
		const node: XmlObject = {
			'p:video': {
				'p:cMediaNode': {
					'@_showWhenStopped': '0',
					'p:tgtEl': { 'p:spTgt': { '@_spid': '8' } },
				},
			},
		};
		walkMediaTimingTree(node, result);
		expect(result.get('8')!.hideWhenNotPlaying).toBeTruthy();
	});

	it('should parse posterFrame rId', () => {
		const result = new Map<string, MediaTimingData>();
		const node: XmlObject = {
			'p:video': {
				'p:cMediaNode': {
					'@_posterFrame': 'rId3',
					'p:tgtEl': { 'p:spTgt': { '@_spid': '9' } },
				},
			},
		};
		walkMediaTimingTree(node, result);
		expect(result.get('9')!.posterFramePath).toBe('rId3');
	});

	it('should skip media nodes without shape ID', () => {
		const result = new Map<string, MediaTimingData>();
		const node: XmlObject = {
			'p:video': {
				'p:cMediaNode': {
					'p:tgtEl': {},
				},
			},
		};
		walkMediaTimingTree(node, result);
		expect(result.size).toBe(0);
	});

	it('should recurse through p:cTn > p:childTnLst > p:par', () => {
		const result = new Map<string, MediaTimingData>();
		const node: XmlObject = {
			'p:cTn': {
				'p:childTnLst': {
					'p:par': {
						'p:video': {
							'p:cMediaNode': {
								'p:tgtEl': { 'p:spTgt': { '@_spid': 'nested1' } },
							},
						},
					},
				},
			},
		};
		walkMediaTimingTree(node, result);
		expect(result.has('nested1')).toBeTruthy();
	});

	it('should recurse through p:seq container', () => {
		const result = new Map<string, MediaTimingData>();
		const node: XmlObject = {
			'p:cTn': {
				'p:childTnLst': {
					'p:seq': {
						'p:audio': {
							'p:cMediaNode': {
								'p:tgtEl': { 'p:spTgt': { '@_spid': 'seq1' } },
							},
						},
					},
				},
			},
		};
		walkMediaTimingTree(node, result);
		expect(result.has('seq1')).toBeTruthy();
	});

	it('should collect multiple media nodes from array', () => {
		const result = new Map<string, MediaTimingData>();
		const node: XmlObject = {
			'p:video': [
				{
					'p:cMediaNode': {
						'p:tgtEl': { 'p:spTgt': { '@_spid': 'v1' } },
					},
				},
				{
					'p:cMediaNode': {
						'p:tgtEl': { 'p:spTgt': { '@_spid': 'v2' } },
					},
				},
			],
		};
		walkMediaTimingTree(node, result);
		expect(result.size).toBe(2);
		expect(result.has('v1')).toBeTruthy();
		expect(result.has('v2')).toBeTruthy();
	});

	// G18: a `p14:media` extension attached to the TIMING tree's own
	// `p:video`/`p:extLst` (not the picture's `p:nvPr/p:extLst`) is not a
	// location real PowerPoint writes to, so it must NOT surface fade/speed.
	it('should ignore a p14:media extension attached to the timing-tree node itself', () => {
		const result = new Map<string, MediaTimingData>();
		const node: XmlObject = {
			'p:video': {
				'p:cMediaNode': {
					'p:tgtEl': { 'p:spTgt': { '@_spid': 'ext1' } },
				},
				'p:extLst': {
					'p:ext': {
						'p14:media': {
							'p14:fade': { '@_in': '2000', '@_out': '3000' },
							'@_spd': '150000',
						},
					},
				},
			},
		};
		walkMediaTimingTree(node, result);
		const data = result.get('ext1')!;
		expect(data.fadeInDuration).toBeUndefined();
		expect(data.fadeOutDuration).toBeUndefined();
		expect(data.playbackSpeed).toBeUndefined();
	});
});
