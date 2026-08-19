/* oxlint-disable eslint/one-var -- many independent it() blocks and helper
   functions, each with unrelated locals; merging across them would hurt
   readability. */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import type { PptxSlide, PptxLayoutOption, XmlObject, PptxElement } from '../../types';
import { stripParentDirSegments } from '../../utils/strip-parent-dir-segments';

// ── Extracted logic matching PptxHandlerRuntimeLoadPipeline ──────────

function resolvePath(base: string, relative: string): string {
	const baseParts = base.split('/').filter(Boolean);
	const relParts = relative.split('/');
	if (baseParts.length > 0 && !base.endsWith('/')) {
		baseParts.pop();
	}
	for (const part of relParts) {
		if (part === '..') {
			baseParts.pop();
		} else if (part !== '.') {
			baseParts.push(part);
		}
	}
	return baseParts.join('/');
}

function findLayoutPathForSlide(
	slidePath: string,
	slideRelsMap: Map<string, Map<string, string>>,
): string | undefined {
	const slideRels = slideRelsMap.get(slidePath);
	if (!slideRels) {
		return undefined;
	}
	for (const [, target] of slideRels.entries()) {
		if (target.includes('slideLayout')) {
			const slideDir = slidePath.substring(0, slidePath.lastIndexOf('/') + 1);
			return target.startsWith('..')
				? resolvePath(slideDir, target)
				: `ppt/${stripParentDirSegments(target)}`;
		}
	}
	return undefined;
}

function findMasterPathForLayout(
	layoutPath: string,
	slideRelsMap: Map<string, Map<string, string>>,
): string | undefined {
	const layoutRels = slideRelsMap.get(layoutPath);
	if (!layoutRels) {
		return undefined;
	}
	for (const [, target] of layoutRels.entries()) {
		if (target.includes('slideMaster')) {
			const layoutDir = layoutPath.substring(0, layoutPath.lastIndexOf('/') + 1);
			return target.startsWith('..')
				? resolvePath(layoutDir, target)
				: `ppt/${stripParentDirSegments(target)}`;
		}
	}
	return undefined;
}

function findMasterPathForSlide(
	slidePath: string,
	slideRelsMap: Map<string, Map<string, string>>,
): string | undefined {
	const layoutPath = findLayoutPathForSlide(slidePath, slideRelsMap);
	if (!layoutPath) {
		return undefined;
	}
	return findMasterPathForLayout(layoutPath, slideRelsMap);
}

function getAvailableLayoutsForSlide(
	slideIndex: number,
	slides: PptxSlide[],
	slideRelsMap: Map<string, Map<string, string>>,
	layoutXmlMap: Map<string, XmlObject>,
	allLayoutOptions: PptxLayoutOption[],
): PptxLayoutOption[] {
	const slide = slides[slideIndex];
	if (!slide) {
		return [];
	}

	const slidePath = slide.id;
	const masterPath = findMasterPathForSlide(slidePath, slideRelsMap);

	if (!masterPath) {
		return allLayoutOptions;
	}

	const masterRels = slideRelsMap.get(masterPath);
	if (!masterRels) {
		return allLayoutOptions;
	}

	const masterLayoutPaths = new Set<string>();
	for (const [, target] of masterRels.entries()) {
		if (target.includes('slideLayout')) {
			const masterDir = masterPath.substring(0, masterPath.lastIndexOf('/') + 1);
			const resolved = target.startsWith('..')
				? resolvePath(masterDir, target)
				: `ppt/${stripParentDirSegments(target)}`;
			masterLayoutPaths.add(resolved);
		}
	}

	const options: PptxLayoutOption[] = [];
	for (const lp of masterLayoutPaths) {
		const xmlObj = layoutXmlMap.get(lp);
		if (xmlObj) {
			const sldLayout = (xmlObj as XmlObject)['p:sldLayout'] as XmlObject | undefined;
			const name = String(sldLayout?.['p:cSld']?.['@_name'] || '').trim() || lp;
			const type = sldLayout?.['@_type'] !== null ? String(sldLayout['@_type']).trim() : undefined;
			options.push({ path: lp, name, ...(type ? { type } : {}) });
		}
	}
	return options;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('layout switching logic (GAP-E4)', () => {
	let slideRelsMap: Map<string, Map<string, string>>;
	let layoutXmlMap: Map<string, XmlObject>;
	let slides: PptxSlide[];
	let allLayouts: PptxLayoutOption[];

	beforeEach(() => {
		slideRelsMap = new Map();
		layoutXmlMap = new Map();

		// Slide 1 -> layout 1 -> master 1
		slideRelsMap.set(
			'ppt/slides/slide1.xml',
			new Map([
				['rId1', '../slideLayouts/slideLayout1.xml'],
				['rId2', '../notesSlides/notesSlide1.xml'],
			]),
		);

		// Layout 1 -> master 1
		slideRelsMap.set(
			'ppt/slideLayouts/slideLayout1.xml',
			new Map([['rId1', '../slideMasters/slideMaster1.xml']]),
		);

		// Layout 2 -> master 1
		slideRelsMap.set(
			'ppt/slideLayouts/slideLayout2.xml',
			new Map([['rId1', '../slideMasters/slideMaster1.xml']]),
		);

		// Layout 3 -> master 2 (different master)
		slideRelsMap.set(
			'ppt/slideLayouts/slideLayout3.xml',
			new Map([['rId1', '../slideMasters/slideMaster2.xml']]),
		);

		// Master 1 has layouts 1 and 2
		slideRelsMap.set(
			'ppt/slideMasters/slideMaster1.xml',
			new Map([
				['rId1', '../slideLayouts/slideLayout1.xml'],
				['rId2', '../slideLayouts/slideLayout2.xml'],
				['rId3', '../theme/theme1.xml'],
			]),
		);

		// Master 2 has layout 3
		slideRelsMap.set(
			'ppt/slideMasters/slideMaster2.xml',
			new Map([
				['rId1', '../slideLayouts/slideLayout3.xml'],
				['rId2', '../theme/theme1.xml'],
			]),
		);

		// Layout XML data
		layoutXmlMap.set('ppt/slideLayouts/slideLayout1.xml', {
			'p:sldLayout': {
				'@_type': 'title',
				'p:cSld': { '@_name': 'Title Slide' },
			},
		});
		layoutXmlMap.set('ppt/slideLayouts/slideLayout2.xml', {
			'p:sldLayout': {
				'@_type': 'obj',
				'p:cSld': { '@_name': 'Title and Content' },
			},
		});
		layoutXmlMap.set('ppt/slideLayouts/slideLayout3.xml', {
			'p:sldLayout': {
				'@_type': 'blank',
				'p:cSld': { '@_name': 'Blank' },
			},
		});

		slides = [
			{
				id: 'ppt/slides/slide1.xml',
				rId: 'rId2',
				slideNumber: 1,
				elements: [],
			},
		];

		allLayouts = [
			{ path: 'ppt/slideLayouts/slideLayout1.xml', name: 'Title Slide', type: 'title' },
			{ path: 'ppt/slideLayouts/slideLayout2.xml', name: 'Title and Content', type: 'obj' },
			{ path: 'ppt/slideLayouts/slideLayout3.xml', name: 'Blank', type: 'blank' },
		];
	});

	describe('findLayoutPathForSlide', () => {
		it('resolves layout path from slide rels', () => {
			const result = findLayoutPathForSlide('ppt/slides/slide1.xml', slideRelsMap);
			expect(result).toBe('ppt/slideLayouts/slideLayout1.xml');
		});

		it('returns undefined when slide has no rels', () => {
			const result = findLayoutPathForSlide('ppt/slides/nonexistent.xml', slideRelsMap);
			expect(result).toBeUndefined();
		});

		it('returns undefined when slide rels have no layout reference', () => {
			slideRelsMap.set(
				'ppt/slides/slide2.xml',
				new Map([['rId1', '../notesSlides/notesSlide2.xml']]),
			);
			const result = findLayoutPathForSlide('ppt/slides/slide2.xml', slideRelsMap);
			expect(result).toBeUndefined();
		});
	});

	describe('findMasterPathForSlide', () => {
		it('follows slide -> layout -> master chain', () => {
			const result = findMasterPathForSlide('ppt/slides/slide1.xml', slideRelsMap);
			expect(result).toBe('ppt/slideMasters/slideMaster1.xml');
		});

		it('returns undefined when layout has no master rel', () => {
			slideRelsMap.set(
				'ppt/slideLayouts/slideLayout1.xml',
				new Map([['rId1', '../theme/theme1.xml']]),
			);
			const result = findMasterPathForSlide('ppt/slides/slide1.xml', slideRelsMap);
			expect(result).toBeUndefined();
		});
	});

	describe('getAvailableLayoutsForSlide', () => {
		it("returns layouts scoped to the slide's master", () => {
			const layouts = getAvailableLayoutsForSlide(
				0,
				slides,
				slideRelsMap,
				layoutXmlMap,
				allLayouts,
			);
			expect(layouts).toHaveLength(2);
			expect(layouts.map((l) => l.name)).toStrictEqual(['Title Slide', 'Title and Content']);
		});

		it('excludes layouts from other masters', () => {
			const layouts = getAvailableLayoutsForSlide(
				0,
				slides,
				slideRelsMap,
				layoutXmlMap,
				allLayouts,
			);
			const paths = layouts.map((l) => l.path);
			expect(paths).not.toContain('ppt/slideLayouts/slideLayout3.xml');
		});

		it('returns empty array for invalid slide index', () => {
			const layouts = getAvailableLayoutsForSlide(
				99,
				slides,
				slideRelsMap,
				layoutXmlMap,
				allLayouts,
			);
			expect(layouts).toHaveLength(0);
		});

		it('falls back to all layouts when master is unknown', () => {
			slideRelsMap.set(
				'ppt/slides/slide1.xml',
				new Map([['rId1', '../notesSlides/notesSlide1.xml']]),
			);
			const layouts = getAvailableLayoutsForSlide(
				0,
				slides,
				slideRelsMap,
				layoutXmlMap,
				allLayouts,
			);
			expect(layouts).toStrictEqual(allLayouts);
		});

		it('includes type when layout has @_type attribute', () => {
			const layouts = getAvailableLayoutsForSlide(
				0,
				slides,
				slideRelsMap,
				layoutXmlMap,
				allLayouts,
			);
			expect(layouts[0].type).toBe('title');
			expect(layouts[1].type).toBe('obj');
		});

		it('falls back to path when layout has no name', () => {
			layoutXmlMap.set('ppt/slideLayouts/slideLayout1.xml', {
				'p:sldLayout': { 'p:cSld': {} },
			});
			const layouts = getAvailableLayoutsForSlide(
				0,
				slides,
				slideRelsMap,
				layoutXmlMap,
				allLayouts,
			);
			expect(layouts[0].name).toBe('ppt/slideLayouts/slideLayout1.xml');
		});
	});

	describe('slide .rels update logic', () => {
		it('computes correct relative target from slide to layout', () => {
			const layoutPath = 'ppt/slideLayouts/slideLayout3.xml';
			const relativeTarget = `../slideLayouts/${layoutPath.split('/').pop()}`;
			expect(relativeTarget).toBe('../slideLayouts/slideLayout3.xml');
		});

		it('preserves existing relationship structure when updating target', () => {
			const relsMap = new Map([
				['rId1', '../slideLayouts/slideLayout1.xml'],
				['rId2', '../notesSlides/notesSlide1.xml'],
			]);

			// Simulate updating the layout rel
			for (const [rId, target] of relsMap.entries()) {
				if (target.includes('slideLayout')) {
					relsMap.set(rId, '../slideLayouts/slideLayout2.xml');
					break;
				}
			}

			expect(relsMap.get('rId1')).toBe('../slideLayouts/slideLayout2.xml');
			expect(relsMap.get('rId2')).toBe('../notesSlides/notesSlide1.xml');
		});
	});

	describe('resolvePath', () => {
		it('resolves .. correctly', () => {
			expect(resolvePath('ppt/slides/slide1.xml', '../slideLayouts/slideLayout1.xml')).toBe(
				'ppt/slideLayouts/slideLayout1.xml',
			);
		});

		it('resolves multiple .. segments', () => {
			expect(resolvePath('ppt/slides/slide1.xml', '../../slideLayouts/slideLayout1.xml')).toBe(
				'slideLayouts/slideLayout1.xml',
			);
		});
	});
});

// ── Placeholder re-mapping tests ──────────────────────────────────────

const EMU_PER_PX = 9525;

/** Helper: build a placeholder info from a rawXml nvPr node. */
/**
 * Drive the real mixin rather than a copy of it.
 *
 * This file used to reimplement the whole algorithm locally, so every
 * assertion below passed against the copy while the shipping implementation
 * was free to drift, and it did: the copy never exercised the placeholder
 * scoring, the picture/graphic-frame slots, or the rawXml cloning.
 *
 * Two details make driving the real class awkward, and both are worked around
 * here rather than in production code. Entering the mixin chain at this module
 * trips a circular import (`SaveTableStyles` initialises before its base), so
 * the package root is imported first to force the canonical order. And
 * `remapElementsToNewLayout` is protected on a class whose constructor wants a
 * loaded archive, so the harness builds a bare prototype instance and supplies
 * the single helper the method actually reaches for.
 */
let remapImpl:
	| ((elements: PptxElement[], newLayoutXml: XmlObject, layoutPath: string) => PptxElement[])
	| undefined;
let harnessSlideRelsMap: Map<string, Map<string, string>> | undefined;
let harnessMasterXmlMap: Map<string, XmlObject> | undefined;

beforeAll(async () => {
	await import('../../../index');
	const { PptxHandlerRuntime } = await import('./PptxHandlerRuntimeLayoutSwitching');
	type Harness = {
		ensureArray: (value: unknown) => unknown[];
		slideRelsMap: Map<string, Map<string, string>>;
		masterXmlMap: Map<string, XmlObject>;
		remapElementsToNewLayout: (
			elements: PptxElement[],
			newLayoutXml: XmlObject,
			layoutPath: string,
		) => PptxElement[];
	};
	const harness = Object.create(PptxHandlerRuntime.prototype) as Harness;
	harness.ensureArray = (value: unknown) =>
		value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
	harness.slideRelsMap = new Map();
	harness.masterXmlMap = new Map();
	harnessSlideRelsMap = harness.slideRelsMap;
	harnessMasterXmlMap = harness.masterXmlMap;
	remapImpl = (elements, newLayoutXml, layoutPath) =>
		harness.remapElementsToNewLayout(elements, newLayoutXml, layoutPath);
});

beforeEach(() => {
	harnessSlideRelsMap?.clear();
	harnessMasterXmlMap?.clear();
});

function remapElementsToNewLayout(
	elements: PptxElement[],
	newLayoutXml: XmlObject,
	layoutPath = 'ppt/slideLayouts/target.xml',
): PptxElement[] {
	if (!remapImpl) {
		throw new Error('remapElementsToNewLayout harness was not initialised');
	}
	return remapImpl(elements, newLayoutXml, layoutPath);
}

/** Register a layout->master relationship and the master's XML for the harness. */
function registerMaster(layoutPath: string, masterPath: string, masterXml: XmlObject): void {
	if (!harnessSlideRelsMap || !harnessMasterXmlMap) {
		throw new Error('harness was not initialised');
	}
	harnessSlideRelsMap.set(
		layoutPath,
		new Map([['rId1', `../slideMasters/${masterPath.split('/').pop()}`]]),
	);
	harnessMasterXmlMap.set(masterPath, masterXml);
}
/** Helper: create a text element with a placeholder rawXml. */
function makePhElement(
	id: string,
	phType: string | undefined,
	phIdx: string | undefined,
	xPx: number,
	yPx: number,
	wPx: number,
	hPx: number,
	text: string = 'Hello',
): PptxElement {
	const phNode: XmlObject = {};
	if (phType) {
		phNode['@_type'] = phType;
	}
	if (phIdx !== undefined) {
		phNode['@_idx'] = phIdx;
	}

	return {
		type: 'text' as const,
		id,
		x: xPx,
		y: yPx,
		width: wPx,
		height: hPx,
		text,
		rawXml: {
			'p:nvSpPr': {
				'p:cNvPr': { '@_id': '1', '@_name': 'Title 1' },
				'p:cNvSpPr': {},
				'p:nvPr': { 'p:ph': phNode },
			},
			'p:spPr': {},
			'p:txBody': {
				'a:bodyPr': {},
				'a:p': { 'a:r': { 'a:t': text } },
			},
		},
	};
}

/** Helper: create a non-placeholder element. */
function makeNonPhElement(
	id: string,
	xPx: number,
	yPx: number,
	wPx: number,
	hPx: number,
): PptxElement {
	return {
		type: 'shape' as const,
		id,
		x: xPx,
		y: yPx,
		width: wPx,
		height: hPx,
		rawXml: {
			'p:nvSpPr': {
				'p:cNvPr': { '@_id': '99', '@_name': 'Freeform' },
				'p:cNvSpPr': {},
				'p:nvPr': {},
			},
			'p:spPr': {},
		},
	};
}

/** Helper: build a layout XML with placeholders. */
function makeLayoutXml(
	placeholders: Array<{
		phType?: string;
		phIdx?: string;
		xEmu: number;
		yEmu: number;
		cxEmu: number;
		cyEmu: number;
		/** Omit `a:xfrm` entirely, as a real layout does when it inherits
		 * position/size from the matching master placeholder instead. */
		noXfrm?: boolean;
	}>,
	layoutName = 'Test Layout',
): XmlObject {
	const shapes = placeholders.map((ph) => {
		const phNode: XmlObject = {};
		if (ph.phType) {
			phNode['@_type'] = ph.phType;
		}
		if (ph.phIdx !== undefined) {
			phNode['@_idx'] = ph.phIdx;
		}
		return {
			'p:nvSpPr': {
				'p:cNvPr': { '@_id': '1', '@_name': 'PH' },
				'p:cNvSpPr': {},
				'p:nvPr': { 'p:ph': phNode },
			},
			'p:spPr': ph.noXfrm
				? {}
				: {
						'a:xfrm': {
							'a:off': { '@_x': String(ph.xEmu), '@_y': String(ph.yEmu) },
							'a:ext': { '@_cx': String(ph.cxEmu), '@_cy': String(ph.cyEmu) },
						},
					},
		};
	});
	return {
		'p:sldLayout': {
			'p:cSld': {
				'@_name': layoutName,
				'p:spTree': {
					'p:sp': shapes.length === 1 ? shapes[0] : shapes,
				},
			},
		},
	};
}

/** Helper: a master's `p:spTree`, in the same shape as {@link makeLayoutXml}. */
function makeMasterXml(
	placeholders: Array<{
		phType?: string;
		phIdx?: string;
		xEmu: number;
		yEmu: number;
		cxEmu: number;
		cyEmu: number;
	}>,
): XmlObject {
	const shapes = placeholders.map((ph) => {
		const phNode: XmlObject = {};
		if (ph.phType) {
			phNode['@_type'] = ph.phType;
		}
		if (ph.phIdx !== undefined) {
			phNode['@_idx'] = ph.phIdx;
		}
		return {
			'p:nvSpPr': {
				'p:cNvPr': { '@_id': '1', '@_name': 'Master PH' },
				'p:cNvSpPr': {},
				'p:nvPr': { 'p:ph': phNode },
			},
			'p:spPr': {
				'a:xfrm': {
					'a:off': { '@_x': String(ph.xEmu), '@_y': String(ph.yEmu) },
					'a:ext': { '@_cx': String(ph.cxEmu), '@_cy': String(ph.cyEmu) },
				},
			},
		};
	});
	return {
		'p:sldMaster': {
			'p:cSld': {
				'p:spTree': {
					'p:sp': shapes.length === 1 ? shapes[0] : shapes,
				},
			},
		},
	};
}

/** Helper: a layout whose only placeholder is anchored on a `p:pic`. */
function makePictureFramedLayoutXml(xEmu: number, yEmu: number, cxEmu: number, cyEmu: number) {
	return {
		'p:sldLayout': {
			'p:cSld': {
				'@_name': 'Picture Layout',
				'p:spTree': {
					'p:pic': {
						'p:nvPicPr': {
							'p:cNvPr': { '@_id': '2', '@_name': 'Picture Placeholder' },
							'p:nvPr': { 'p:ph': { '@_type': 'pic', '@_idx': '1' } },
						},
						'p:spPr': {
							'a:xfrm': {
								'a:off': { '@_x': String(xEmu), '@_y': String(yEmu) },
								'a:ext': { '@_cx': String(cxEmu), '@_cy': String(cyEmu) },
							},
						},
					},
				},
			},
		},
	} satisfies XmlObject;
}

describe('placeholder re-mapping (GAP-E4 layout switching)', () => {
	it('matches placeholders by type and updates positions', () => {
		const titleEl = makePhElement('t1', 'title', undefined, 10, 10, 100, 50, 'My Title');
		const bodyEl = makePhElement('b1', 'body', undefined, 10, 70, 100, 200, 'Body text');

		const newLayout = makeLayoutXml([
			{ phType: 'title', xEmu: 190500, yEmu: 95250, cxEmu: 7620000, cyEmu: 1143000 },
			{ phType: 'body', xEmu: 190500, yEmu: 1524000, cxEmu: 7620000, cyEmu: 3429000 },
		]);

		const result = remapElementsToNewLayout([titleEl, bodyEl], newLayout);

		expect(result).toHaveLength(2);

		// Title should be repositioned
		const title = result.find((e) => e.id === 't1')!;
		expect(title.text).toBe('My Title'); // content preserved
		expect(title.x).toBe(Math.round(190500 / EMU_PER_PX));
		expect(title.y).toBe(Math.round(95250 / EMU_PER_PX));
		expect(title.width).toBe(Math.round(7620000 / EMU_PER_PX));
		expect(title.height).toBe(Math.round(1143000 / EMU_PER_PX));

		// Body should be repositioned
		const body = result.find((e) => e.id === 'b1')!;
		expect(body.text).toBe('Body text'); // content preserved
		expect(body.x).toBe(Math.round(190500 / EMU_PER_PX));
		expect(body.y).toBe(Math.round(1524000 / EMU_PER_PX));
	});

	it('resolves geometry from the master when the layout placeholder omits a:xfrm', () => {
		const layoutPath = 'ppt/slideLayouts/target.xml';
		const masterPath = 'ppt/slideMasters/slideMaster1.xml';
		registerMaster(
			layoutPath,
			masterPath,
			makeMasterXml([
				{ phType: 'title', xEmu: 500000, yEmu: 250000, cxEmu: 8000000, cyEmu: 1200000 },
				{ phType: 'body', phIdx: '1', xEmu: 500000, yEmu: 1800000, cxEmu: 8000000, cyEmu: 4000000 },
			]),
		);

		const titleEl = makePhElement('t1', 'title', undefined, 10, 10, 100, 50, 'My Title');
		const newLayout = makeLayoutXml([
			{ phType: 'title', xEmu: 0, yEmu: 0, cxEmu: 0, cyEmu: 0, noXfrm: true },
		]);

		const result = remapElementsToNewLayout([titleEl], newLayout, layoutPath);

		const title = result.find((e) => e.id === 't1')!;
		expect(title.x).toBe(Math.round(500000 / EMU_PER_PX));
		expect(title.y).toBe(Math.round(250000 / EMU_PER_PX));
		expect(title.width).toBe(Math.round(8000000 / EMU_PER_PX));
		expect(title.height).toBe(Math.round(1200000 / EMU_PER_PX));
	});

	it('leaves the element at its own position when neither layout nor master has geometry', () => {
		const titleEl = makePhElement('t1', 'title', undefined, 10, 10, 100, 50, 'My Title');
		const newLayout = makeLayoutXml([
			{ phType: 'title', xEmu: 0, yEmu: 0, cxEmu: 0, cyEmu: 0, noXfrm: true },
		]);

		const result = remapElementsToNewLayout([titleEl], newLayout);

		const title = result.find((e) => e.id === 't1')!;
		expect(title.x).toBe(10);
		expect(title.y).toBe(10);
		expect(title.width).toBe(100);
		expect(title.height).toBe(50);
	});

	it('keeps placeholder content the new layout has no slot for', () => {
		const titleEl = makePhElement('t1', 'title', undefined, 10, 10, 100, 50, 'Title');
		const subtitleEl = makePhElement('s1', 'subTitle', undefined, 10, 70, 100, 50, 'Subtitle');
		const pictureEl = makePhElement('p1', 'pic', undefined, 10, 130, 100, 100, 'Picture');

		// New layout offers a single title slot. The title claims it; the other
		// two have nowhere to go, and must survive as free-standing content
		// rather than being deleted along with the user's words.
		const newLayout = makeLayoutXml([
			{ phType: 'title', xEmu: 100000, yEmu: 100000, cxEmu: 5000000, cyEmu: 1000000 },
		]);

		const result = remapElementsToNewLayout([titleEl, subtitleEl, pictureEl], newLayout);

		expect(result.map((e) => e.id)).toStrictEqual(['t1', 's1', 'p1']);
		expect(result.find((e) => e.id === 't1')?.x).toBe(Math.round(100000 / EMU_PER_PX));
		// Unmatched content keeps its own position untouched.
		expect(result.find((e) => e.id === 's1')).toMatchObject({ text: 'Subtitle', x: 10, y: 70 });
		expect(result.find((e) => e.id === 'p1')).toMatchObject({ x: 10, y: 130 });
	});

	it('adds empty placeholders from new layout that are missing in slide', () => {
		const titleEl = makePhElement('t1', 'title', undefined, 10, 10, 100, 50, 'Title');

		// New layout has title AND body
		const newLayout = makeLayoutXml([
			{ phType: 'title', xEmu: 100000, yEmu: 100000, cxEmu: 5000000, cyEmu: 1000000 },
			{ phType: 'body', xEmu: 100000, yEmu: 1500000, cxEmu: 5000000, cyEmu: 3000000 },
		]);

		const result = remapElementsToNewLayout([titleEl], newLayout);

		expect(result).toHaveLength(2);
		expect(result[0].id).toBe('t1'); // existing title kept
		const newBody = result[1];
		expect(newBody.text).toBe(''); // empty placeholder
		expect(newBody.x).toBe(Math.round(100000 / EMU_PER_PX));
		expect(newBody.width).toBe(Math.round(5000000 / EMU_PER_PX));
	});

	it('keeps non-placeholder elements at their current positions', () => {
		const titleEl = makePhElement('t1', 'title', undefined, 10, 10, 100, 50);
		const freeform = makeNonPhElement('f1', 300, 400, 150, 80);

		const newLayout = makeLayoutXml([
			{ phType: 'title', xEmu: 200000, yEmu: 200000, cxEmu: 4000000, cyEmu: 800000 },
		]);

		const result = remapElementsToNewLayout([titleEl, freeform], newLayout);

		expect(result).toHaveLength(2);
		// Non-placeholder should be unchanged
		const kept = result.find((e) => e.id === 'f1')!;
		expect(kept.x).toBe(300);
		expect(kept.y).toBe(400);
		expect(kept.width).toBe(150);
		expect(kept.height).toBe(80);
	});

	it('matches by type+idx when idx is present', () => {
		const body1 = makePhElement('b1', 'body', '1', 10, 10, 100, 100, 'Left');
		const body2 = makePhElement('b2', 'body', '2', 200, 10, 100, 100, 'Right');

		const newLayout = makeLayoutXml([
			{ phType: 'body', phIdx: '1', xEmu: 50000, yEmu: 50000, cxEmu: 3000000, cyEmu: 2000000 },
			{ phType: 'body', phIdx: '2', xEmu: 4000000, yEmu: 50000, cxEmu: 3000000, cyEmu: 2000000 },
		]);

		const result = remapElementsToNewLayout([body1, body2], newLayout);

		expect(result).toHaveLength(2);
		const left = result.find((e) => e.id === 'b1')!;
		expect(left.text).toBe('Left');
		expect(left.x).toBe(Math.round(50000 / EMU_PER_PX));

		const right = result.find((e) => e.id === 'b2')!;
		expect(right.text).toBe('Right');
		expect(right.x).toBe(Math.round(4000000 / EMU_PER_PX));
	});

	it("falls back to type-only match when idx doesn't match", () => {
		const body1 = makePhElement('b1', 'body', '1', 10, 10, 100, 100, 'Content');

		// New layout has body with idx=5 (different idx)
		const newLayout = makeLayoutXml([
			{ phType: 'body', phIdx: '5', xEmu: 100000, yEmu: 100000, cxEmu: 6000000, cyEmu: 3000000 },
		]);

		const result = remapElementsToNewLayout([body1], newLayout);

		// Should still match by type fallback
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('b1');
		expect(result[0].text).toBe('Content');
		expect(result[0].x).toBe(Math.round(100000 / EMU_PER_PX));
	});

	it('skips footer/date-time/slide-number when adding empty placeholders', () => {
		const newLayout = makeLayoutXml([
			{ phType: 'title', xEmu: 100000, yEmu: 100000, cxEmu: 5000000, cyEmu: 1000000 },
			{ phType: 'ftr', xEmu: 100000, yEmu: 6000000, cxEmu: 2000000, cyEmu: 300000 },
			{ phType: 'dt', xEmu: 3000000, yEmu: 6000000, cxEmu: 2000000, cyEmu: 300000 },
			{ phType: 'sldNum', xEmu: 6000000, yEmu: 6000000, cxEmu: 1000000, cyEmu: 300000 },
		]);

		const result = remapElementsToNewLayout([], newLayout);

		// Only title should be added; ftr/dt/sldNum are skipped
		expect(result).toHaveLength(1);
		expect(result[0].id).toContain('title');
	});

	it('handles empty elements array', () => {
		const newLayout = makeLayoutXml([
			{ phType: 'title', xEmu: 100000, yEmu: 100000, cxEmu: 5000000, cyEmu: 1000000 },
		]);

		const result = remapElementsToNewLayout([], newLayout);
		expect(result).toHaveLength(1);
		expect(result[0].text).toBe('');
	});

	it('handles layout with no placeholders', () => {
		const titleEl = makePhElement('t1', 'title', undefined, 10, 10, 100, 50, 'Title');
		const freeform = makeNonPhElement('f1', 300, 400, 150, 80);

		const blankLayout: XmlObject = {
			'p:sldLayout': {
				'p:cSld': { '@_name': 'Blank', 'p:spTree': {} },
			},
		};

		const result = remapElementsToNewLayout([titleEl, freeform], blankLayout);

		// Switching to Blank must not erase the slide. PowerPoint keeps both the
		// former placeholder content and the free-form shape.
		expect(result.map((e) => e.id)).toStrictEqual(['t1', 'f1']);
		expect(result.find((e) => e.id === 't1')?.text).toBe('Title');
	});

	it('keeps every slot when a layout repeats a placeholder family', () => {
		const left = makePhElement('l1', 'body', '1', 10, 10, 100, 50, 'Left');
		const right = makePhElement('r1', 'body', '2', 10, 70, 100, 50, 'Right');

		// Two content boxes. Keying targets by family collapsed these onto one
		// entry, so the second element found nothing to move into.
		const twoContent = makeLayoutXml([
			{ phType: 'body', phIdx: '1', xEmu: 100000, yEmu: 200000, cxEmu: 3000000, cyEmu: 2000000 },
			{ phType: 'body', phIdx: '2', xEmu: 4000000, yEmu: 200000, cxEmu: 3000000, cyEmu: 2000000 },
		]);

		const result = remapElementsToNewLayout([left, right], twoContent);

		expect(result).toHaveLength(2);
		expect(result.find((e) => e.id === 'l1')?.x).toBe(Math.round(100000 / EMU_PER_PX));
		expect(result.find((e) => e.id === 'r1')?.x).toBe(Math.round(4000000 / EMU_PER_PX));
	});

	it('prefers a dedicated picture slot over the generic content box', () => {
		const body = makePhElement('b1', 'body', '1', 10, 10, 100, 50, 'Prose');
		const picture: PptxElement = {
			...makePhElement('i1', 'pic', '2', 10, 70, 100, 100, ''),
			type: 'image',
			src: 'data:image/png;base64,AAAA',
		} as PptxElement;

		const mixed = makeLayoutXml([
			{ phType: 'body', phIdx: '1', xEmu: 100000, yEmu: 200000, cxEmu: 3000000, cyEmu: 2000000 },
			{ phType: 'pic', phIdx: '2', xEmu: 4000000, yEmu: 200000, cxEmu: 3000000, cyEmu: 2000000 },
		]);

		const result = remapElementsToNewLayout([body, picture], mixed);

		// The image must land in the picture frame, not in the prose box.
		expect(result.find((e) => e.id === 'i1')?.x).toBe(Math.round(4000000 / EMU_PER_PX));
		expect(result.find((e) => e.id === 'b1')?.x).toBe(Math.round(100000 / EMU_PER_PX));
	});

	it('matches placeholders anchored on a p:pic in the target layout', () => {
		const picture = makePhElement('i1', 'pic', '1', 10, 10, 100, 100, '');
		const layout = makePictureFramedLayoutXml(500000, 600000, 2000000, 1500000);

		const result = remapElementsToNewLayout([picture], layout);

		expect(result).toHaveLength(1);
		expect(result[0].x).toBe(Math.round(500000 / EMU_PER_PX));
		expect(result[0].y).toBe(Math.round(600000 / EMU_PER_PX));
	});

	it('rewrites the moved element p:ph to name its new slot', () => {
		// The source deck numbered its body slot 14; the target layout calls the
		// equivalent slot 1. Leaving 14 behind made the saved deck reference a
		// placeholder the new layout does not define.
		const body = makePhElement('b1', 'body', '14', 10, 10, 100, 50, 'Body');
		const layout = makeLayoutXml([
			{ phType: 'body', phIdx: '1', xEmu: 100000, yEmu: 200000, cxEmu: 3000000, cyEmu: 2000000 },
		]);

		const result = remapElementsToNewLayout([body], layout);

		const ph = result[0].rawXml?.['p:nvSpPr']?.['p:nvPr']?.['p:ph'] as XmlObject;
		expect(ph['@_idx']).toBe('1');
		expect(ph['@_type']).toBe('body');
	});

	it('does not mutate the caller rawXml when repositioning', () => {
		const body = makePhElement('b1', 'body', '1', 10, 10, 100, 50, 'Body');
		const layout = makeLayoutXml([
			{ phType: 'body', phIdx: '1', xEmu: 100000, yEmu: 200000, cxEmu: 3000000, cyEmu: 2000000 },
		]);

		const result = remapElementsToNewLayout([body], layout);

		// The original element is still referenced by undo history and by the
		// caller's own slide model; writing the new transform into its shared
		// rawXml corrupted both.
		expect(body.rawXml?.['p:spPr']).toStrictEqual({});
		expect(result[0].rawXml).not.toBe(body.rawXml);
		expect((result[0].rawXml?.['p:spPr'] as XmlObject)?.['a:xfrm']).toBeDefined();
	});

	it('handles element without rawXml as non-placeholder', () => {
		const noRawXml: PptxElement = {
			type: 'shape' as const,
			id: 'no-raw',
			x: 50,
			y: 50,
			width: 200,
			height: 100,
		};

		const newLayout = makeLayoutXml([
			{ phType: 'title', xEmu: 100000, yEmu: 100000, cxEmu: 5000000, cyEmu: 1000000 },
		]);

		const result = remapElementsToNewLayout([noRawXml], newLayout);

		// Element without rawXml is treated as non-placeholder, kept as-is
		expect(result).toHaveLength(2); // 1 kept + 1 empty title added
		expect(result[0].id).toBe('no-raw');
		expect(result[0].x).toBe(50);
	});
});
