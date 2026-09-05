/**
 * Tests for PptxHandlerRuntimeSaveMediaTimingWrite:
 *   - collectMediaElements (recursive media collection)
 *   - getShapeIdFromRawXml (shape ID extraction from different nvPr paths)
 *   - applyMediaTimingToTimingTree logic (timing property writes)
 *   - writeMediaP14Extension (G18: p14:media trim/fade/bookmarks on p:nvPr,
 *     exercised end-to-end via PptxHandler since it mutates `media.rawXml`
 *     directly rather than a value this file can re-implement standalone)
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../PptxHandler';
import type { XmlObject, MediaPptxElement, PptxElement } from '../../types';

// ---------------------------------------------------------------------------
// Reimplemented: collectMediaElements
// ---------------------------------------------------------------------------
function collectMediaElements(elements: PptxElement[], output: MediaPptxElement[]): void {
	for (const element of elements) {
		if (element.type === 'media') {
			output.push(element);
		} else if (element.type === 'group' && Array.isArray(element.children)) {
			collectMediaElements(element.children, output);
		}
	}
}

// ---------------------------------------------------------------------------
// Reimplemented: getShapeIdFromRawXml
// ---------------------------------------------------------------------------
function getShapeIdFromRawXml(rawXml: XmlObject | undefined): string | undefined {
	if (!rawXml) {
		return undefined;
	}
	const cNvPr =
		(rawXml['p:nvSpPr'] as XmlObject | undefined)?.['p:cNvPr'] ||
		(rawXml['p:nvPicPr'] as XmlObject | undefined)?.['p:cNvPr'] ||
		(rawXml['p:nvCxnSpPr'] as XmlObject | undefined)?.['p:cNvPr'] ||
		(rawXml['p:nvGraphicFramePr'] as XmlObject | undefined)?.['p:cNvPr'];
	const rawId = (cNvPr as XmlObject | undefined)?.['@_id'];
	if (rawId === undefined || rawId === null) {
		return undefined;
	}
	const shapeId = String(rawId).trim();
	return shapeId.length > 0 ? shapeId : undefined;
}

// ---------------------------------------------------------------------------
// Reimplemented: applyMediaTimingProperties on a single media node
// ---------------------------------------------------------------------------
function applyMediaTimingProperties(
	cMediaNode: XmlObject,
	media: MediaPptxElement,
	mediaTag: string,
): void {
	let cTn = cMediaNode['p:cTn'] as XmlObject | undefined;
	if (!cTn) {
		cTn = {};
		cMediaNode['p:cTn'] = cTn;
	}

	// G18/G19: trim no longer writes to `p:cTn/@_st`/`@_end` - `CT_TLCommonTimeNodeData`
	// has no such attributes, and real PowerPoint never reads them there. Trim
	// goes onto the picture's own `p:nvPr/p:extLst/p14:media/p14:trim` instead
	// (see the `writeMediaP14Extension` integration tests below).

	if (media.loop) {
		cTn['@_repeatCount'] = 'indefinite';
	} else {
		delete cTn['@_repeatCount'];
	}

	if (media.autoPlay) {
		cTn['@_nodeType'] = '1';
	} else {
		delete cTn['@_nodeType'];
	}

	if (media.playAcrossSlides && mediaTag === 'p:audio') {
		cTn['@_dur'] = 'indefinite';
	} else if (!media.playAcrossSlides) {
		if (String(cTn['@_dur']) === 'indefinite') {
			delete cTn['@_dur'];
		}
	}

	if (media.fullScreen) {
		cMediaNode['@_fullScrn'] = '1';
	} else {
		delete cMediaNode['@_fullScrn'];
	}

	if (media.volume !== undefined && Number.isFinite(media.volume)) {
		cMediaNode['@_vol'] = String(Math.round(media.volume * 100000));
	}

	if (media.hideWhenNotPlaying) {
		cMediaNode['@_showWhenStopped'] = '0';
	} else {
		delete cMediaNode['@_showWhenStopped'];
	}
}

// ---------------------------------------------------------------------------
// Tests: collectMediaElements
// ---------------------------------------------------------------------------
describe('collectMediaElements', () => {
	it('should collect media elements from a flat list', () => {
		const elements: PptxElement[] = [
			{ type: 'text', id: 't1', x: 0, y: 0, width: 100, height: 50, text: '' },
			{
				type: 'media',
				id: 'm1',
				x: 0,
				y: 0,
				width: 100,
				height: 50,
			} as MediaPptxElement,
		];
		const output: MediaPptxElement[] = [];
		collectMediaElements(elements, output);
		expect(output).toHaveLength(1);
		expect(output[0].id).toBe('m1');
	});

	it('should recursively collect media from groups', () => {
		const elements: PptxElement[] = [
			{
				type: 'group',
				id: 'g1',
				x: 0,
				y: 0,
				width: 200,
				height: 200,
				children: [
					{
						type: 'media',
						id: 'm2',
						x: 10,
						y: 10,
						width: 50,
						height: 50,
					} as MediaPptxElement,
				],
			},
		];
		const output: MediaPptxElement[] = [];
		collectMediaElements(elements, output);
		expect(output).toHaveLength(1);
		expect(output[0].id).toBe('m2');
	});

	it('should return empty array when no media elements', () => {
		const elements: PptxElement[] = [
			{ type: 'text', id: 't1', x: 0, y: 0, width: 100, height: 50, text: '' },
		];
		const output: MediaPptxElement[] = [];
		collectMediaElements(elements, output);
		expect(output).toHaveLength(0);
	});

	it('should handle empty elements array', () => {
		const output: MediaPptxElement[] = [];
		collectMediaElements([], output);
		expect(output).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Tests: getShapeIdFromRawXml
// ---------------------------------------------------------------------------
describe('getShapeIdFromRawXml', () => {
	it('should extract id from p:nvSpPr path', () => {
		const xml: XmlObject = {
			'p:nvSpPr': { 'p:cNvPr': { '@_id': '42' } },
		};
		expect(getShapeIdFromRawXml(xml)).toBe('42');
	});

	it('should extract id from p:nvPicPr path', () => {
		const xml: XmlObject = {
			'p:nvPicPr': { 'p:cNvPr': { '@_id': '5' } },
		};
		expect(getShapeIdFromRawXml(xml)).toBe('5');
	});

	it('should extract id from p:nvCxnSpPr path', () => {
		const xml: XmlObject = {
			'p:nvCxnSpPr': { 'p:cNvPr': { '@_id': '99' } },
		};
		expect(getShapeIdFromRawXml(xml)).toBe('99');
	});

	it('should extract id from p:nvGraphicFramePr path', () => {
		const xml: XmlObject = {
			'p:nvGraphicFramePr': { 'p:cNvPr': { '@_id': '7' } },
		};
		expect(getShapeIdFromRawXml(xml)).toBe('7');
	});

	it('should return undefined for undefined rawXml', () => {
		expect(getShapeIdFromRawXml(undefined)).toBeUndefined();
	});

	it('should return undefined when no nvPr paths exist', () => {
		expect(getShapeIdFromRawXml({})).toBeUndefined();
	});

	it('should return undefined for empty id string', () => {
		const xml: XmlObject = {
			'p:nvSpPr': { 'p:cNvPr': { '@_id': '' } },
		};
		expect(getShapeIdFromRawXml(xml)).toBeUndefined();
	});

	it('should return undefined for whitespace-only id', () => {
		const xml: XmlObject = {
			'p:nvSpPr': { 'p:cNvPr': { '@_id': '  ' } },
		};
		expect(getShapeIdFromRawXml(xml)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Reimplemented: the `p:cMediaNode/p:tgtEl` shapeId lookup key
// (G1: applyMediaTimingToTimingTree must match by the LEAF media shape's id,
// not the enclosing group's, since `mediaByShapeId` is keyed by each
// element's own id via `collectMediaElements` recursing into group children)
// ---------------------------------------------------------------------------
function resolveMediaShapeId(tgtEl: XmlObject | undefined): string {
	const spTgt = tgtEl?.['p:spTgt'] as XmlObject | undefined;
	const subSp = spTgt?.['p:subSp'] as XmlObject | undefined;
	const rawShapeId = subSp?.['@_spid'] ?? spTgt?.['@_spid'];
	return rawShapeId !== undefined ? String(rawShapeId).trim() : '';
}

describe('resolveMediaShapeId (G1 sub-shape targeting)', () => {
	it('prefers p:subSp/@_spid over the enclosing group id', () => {
		const tgtEl: XmlObject = { 'p:spTgt': { '@_spid': '4', 'p:subSp': { '@_spid': '3' } } };
		expect(resolveMediaShapeId(tgtEl)).toBe('3');
	});

	it('falls back to p:spTgt/@_spid when there is no p:subSp', () => {
		const tgtEl: XmlObject = { 'p:spTgt': { '@_spid': '4' } };
		expect(resolveMediaShapeId(tgtEl)).toBe('4');
	});

	it('returns empty string when neither is present', () => {
		expect(resolveMediaShapeId(undefined)).toBe('');
		expect(resolveMediaShapeId({})).toBe('');
	});
});

// ---------------------------------------------------------------------------
// Tests: applyMediaTimingProperties
// ---------------------------------------------------------------------------
describe('applyMediaTimingProperties', () => {
	const baseMedia: MediaPptxElement = {
		type: 'media',
		id: 'm1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
	};

	// G18/G19: trim is never written to (or read from) `p:cTn`; a value that
	// happens to already be sitting there (e.g. surviving from some other
	// mutation) is left alone by this function, since it no longer touches
	// `@_st`/`@_end` at all.
	it('should never write trim start/end onto p:cTn', () => {
		const cMediaNode: XmlObject = {};
		applyMediaTimingProperties(
			cMediaNode,
			{ ...baseMedia, trimStartMs: 1000, trimEndMs: 5000 },
			'p:video',
		);
		const cTn = cMediaNode['p:cTn'] as XmlObject;
		expect(cTn['@_st']).toBeUndefined();
		expect(cTn['@_end']).toBeUndefined();
	});

	it('should set loop to indefinite repeat', () => {
		const cMediaNode: XmlObject = {};
		applyMediaTimingProperties(cMediaNode, { ...baseMedia, loop: true }, 'p:video');
		const cTn = cMediaNode['p:cTn'] as XmlObject;
		expect(cTn['@_repeatCount']).toBe('indefinite');
	});

	it('should remove repeatCount when loop is false', () => {
		const cMediaNode: XmlObject = {
			'p:cTn': { '@_repeatCount': 'indefinite' },
		};
		applyMediaTimingProperties(cMediaNode, { ...baseMedia, loop: false }, 'p:video');
		const cTn = cMediaNode['p:cTn'] as XmlObject;
		expect(cTn['@_repeatCount']).toBeUndefined();
	});

	it('should set autoPlay nodeType', () => {
		const cMediaNode: XmlObject = {};
		applyMediaTimingProperties(cMediaNode, { ...baseMedia, autoPlay: true }, 'p:video');
		const cTn = cMediaNode['p:cTn'] as XmlObject;
		expect(cTn['@_nodeType']).toBe('1');
	});

	it('should set playAcrossSlides for audio', () => {
		const cMediaNode: XmlObject = {};
		applyMediaTimingProperties(cMediaNode, { ...baseMedia, playAcrossSlides: true }, 'p:audio');
		const cTn = cMediaNode['p:cTn'] as XmlObject;
		expect(cTn['@_dur']).toBe('indefinite');
	});

	it('should not set playAcrossSlides for video', () => {
		const cMediaNode: XmlObject = {};
		applyMediaTimingProperties(cMediaNode, { ...baseMedia, playAcrossSlides: true }, 'p:video');
		const cTn = cMediaNode['p:cTn'] as XmlObject;
		expect(cTn['@_dur']).toBeUndefined();
	});

	it('should set fullScreen flag', () => {
		const cMediaNode: XmlObject = {};
		applyMediaTimingProperties(cMediaNode, { ...baseMedia, fullScreen: true }, 'p:video');
		expect(cMediaNode['@_fullScrn']).toBe('1');
	});

	it('should set volume as scaled integer', () => {
		const cMediaNode: XmlObject = {};
		applyMediaTimingProperties(cMediaNode, { ...baseMedia, volume: 0.75 }, 'p:video');
		expect(cMediaNode['@_vol']).toBe('75000');
	});

	it('should set hideWhenNotPlaying as showWhenStopped=0', () => {
		const cMediaNode: XmlObject = {};
		applyMediaTimingProperties(cMediaNode, { ...baseMedia, hideWhenNotPlaying: true }, 'p:video');
		expect(cMediaNode['@_showWhenStopped']).toBe('0');
	});

	it('should remove showWhenStopped when hideWhenNotPlaying is false', () => {
		const cMediaNode: XmlObject = { '@_showWhenStopped': '0' };
		applyMediaTimingProperties(cMediaNode, { ...baseMedia, hideWhenNotPlaying: false }, 'p:video');
		expect(cMediaNode['@_showWhenStopped']).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Tests: writeMediaP14Extension (G18), exercised via a real PptxHandler
// round-trip on a real PowerPoint-authored fixture, since the method mutates
// `media.rawXml`'s nvPr in place rather than returning a value a standalone
// re-implementation could assert on faithfully.
// ---------------------------------------------------------------------------
const FIXTURES = join(__dirname, '../../../../../../e2e/fixtures');
const FIXTURE_NAME = 'Image_JPG_PNG_Audio_M4_A_Video_MP_4_12_Slides_36_8_MB_ff1095731b.pptx';

function requireFixtureBytes(name: string): Uint8Array {
	const path = join(FIXTURES, name);
	if (!existsSync(path)) {
		throw new Error(`missing fixture ${path}`);
	}
	return new Uint8Array(readFileSync(path));
}

describe('writeMediaP14Extension (G18 round-trip)', () => {
	it('writes trim/fade/speed/bookmarks onto p:nvPr/p:extLst, not the timing tree', async () => {
		const bytes = requireFixtureBytes(FIXTURE_NAME);
		const handler = new PptxHandler();
		const loaded = await handler.load(bytes.buffer as ArrayBuffer);
		const video = loaded.slides
			.flatMap((slide) => slide.elements)
			.find(
				(element): element is MediaPptxElement =>
					element.type === 'media' && element.mediaType === 'video',
			);
		expect(video).toBeDefined();
		if (!video) {
			return;
		}

		// Edit trim/fade/speed/bookmarks the way the inspector would.
		video.trimStartMs = 18374;
		video.trimEndMs = 438;
		video.fadeInDuration = 2;
		video.fadeOutDuration = 3;
		video.playbackSpeed = 1.5;
		video.bookmarks = [{ id: 'bmk-1', time: 5, label: 'Intro' }];

		const saved = await handler.save(loaded.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const slideXml = await savedZip.file('ppt/slides/slide11.xml')!.async('string');

		// p14:media (with trim/fade/spd) lands on p:nvPr/p:extLst, a sibling of
		// a:videoFile - never on the timing tree's own p:video/p:extLst.
		const nvPicPrMatch = slideXml.match(/<p:nvPicPr>[\s\S]*?<\/p:nvPicPr>/u);
		expect(nvPicPrMatch).not.toBeNull();
		const nvPrMatch = nvPicPrMatch![0].match(/<p:nvPr>[\s\S]*?<\/p:nvPr>/u);
		expect(nvPrMatch).not.toBeNull();
		const nvPrXml = nvPrMatch![0];
		expect(nvPrXml).toContain('<a:videoFile r:link="rId2">');
		expect(nvPrXml).toContain('uri="{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}"');
		expect(nvPrXml).toMatch(/<p14:trim st="18374" end="438">/u);
		expect(nvPrXml).toMatch(/<p14:fade in="2000" out="3000">/u);
		expect(nvPrXml).toMatch(/p14:media[^>]*spd="150000"/u);
		expect(nvPrXml).toContain('p14:bmkLst');
		expect(nvPrXml).toContain('name="Intro"');

		// The timing tree's own p:cMediaNode must NOT carry the bogus @_st/@_end
		// this writer used to emit on its p:cTn (G19), and must not carry the
		// p14:media extension either (G18): both moved to p:nvPr above.
		const timingMatch = slideXml.match(/<p:timing>[\s\S]*<\/p:timing>/u);
		expect(timingMatch).not.toBeNull();
		const timingXml = timingMatch![0];
		const videoNodeMatch = timingXml.match(/<p:video[^>]*>[\s\S]*?<\/p:video>/u);
		expect(videoNodeMatch).not.toBeNull();
		expect(videoNodeMatch![0]).not.toContain('p14:media');
		expect(videoNodeMatch![0]).not.toContain('p14:trim');
		const cTnMatch = videoNodeMatch![0].match(/<p:cTn[^>]*>/u);
		expect(cTnMatch).not.toBeNull();
		expect(cTnMatch![0]).not.toMatch(/\bst="/u);
		expect(cTnMatch![0]).not.toMatch(/\bend="/u);

		// Re-loading the saved bytes must read the same values back.
		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedVideo = reloaded.slides
			.flatMap((slide) => slide.elements)
			.find(
				(element): element is MediaPptxElement =>
					element.type === 'media' && element.mediaType === 'video',
			);
		expect(reloadedVideo?.trimStartMs).toBe(18374);
		expect(reloadedVideo?.trimEndMs).toBe(438);
		expect(reloadedVideo?.fadeInDuration).toBe(2);
		expect(reloadedVideo?.fadeOutDuration).toBe(3);
		expect(reloadedVideo?.playbackSpeed).toBe(1.5);
		expect(reloadedVideo?.bookmarks?.[0]).toMatchObject({ time: 5, label: 'Intro' });
	});
});

describe('fresh media p14 extension (no rawXml)', () => {
	/**
	 * `writeMediaP14Extension` only merges trim/fade/speed/bookmarks onto an
	 * EXISTING `p:nvPicPr/p:nvPr/p:extLst` a round-tripped picture already
	 * carries: a media element inserted via the SDK in the same session has no
	 * `rawXml` at all, so it used to lose its trim on save and only round-trip
	 * correctly starting from the NEXT load. `MediaGraphicFrameXmlFactory` now
	 * synthesises the same extension straight from the typed fields
	 * (`buildFreshMediaNvPr`) when there is no rawXml to merge into, so a
	 * freshly inserted, freshly trimmed clip survives its very first save.
	 */
	it('round-trips trim set on a freshly inserted media element with no rawXml', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const slide = createSlide('Blank').build();
		const media: MediaPptxElement = {
			id: 'video-fresh-1',
			type: 'media',
			x: 20,
			y: 30,
			width: 320,
			height: 180,
			mediaType: 'video',
			// A minimal (invalid as a real MP4, irrelevant here) base64 payload:
			// the embedding path only needs a decodable data URL to allocate a
			// media part and a relationship id.
			mediaData: 'data:video/mp4;base64,AAAAGGZ0eXBpc29t',
		} as MediaPptxElement;
		slide.elements.push(media);
		data.slides.push(slide);

		// Insert, then set trim, in the same in-memory session: `media.rawXml`
		// is never populated without a load, so this element never has one.
		expect(media.rawXml).toBeUndefined();
		media.trimStartMs = 1000;
		media.trimEndMs = 5000;

		const saved = await handler.save(data.slides);
		const savedZip = await JSZip.loadAsync(saved);
		const slidePaths = Object.keys(savedZip.files).filter((name) =>
			/^ppt\/slides\/slide\d+\.xml$/u.test(name),
		);
		const slideXml = await savedZip.file(slidePaths[0])!.async('string');

		expect(slideXml).toContain('uri="{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}"');
		expect(slideXml).toMatch(/<p14:trim st="1000" end="5000">/u);
		// The embed relationship id is synthesised too, not left blank, so the
		// extension resolves the media on its very first save.
		expect(slideXml).toMatch(/<p14:media r:embed="rId\d+">/u);

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedVideo = reloaded.slides
			.flatMap((s) => s.elements)
			.find(
				(element): element is MediaPptxElement =>
					element.type === 'media' && element.mediaType === 'video',
			);
		expect(reloadedVideo?.trimStartMs).toBe(1000);
		expect(reloadedVideo?.trimEndMs).toBe(5000);
	});
});
