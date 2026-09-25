/**
 * Every string a gallery hands a binding (trigger caption, section heading,
 * tile name, contextual tab and group caption) must exist in the English
 * dictionary, or a binding shows the English fallback / the raw key and the
 * locales never get a translation. Keys are built from catalogue data at
 * runtime, so a source grep cannot find a missing one; this test builds every
 * gallery against a selection it applies to and checks what comes back.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { translationsEn } from '../../i18n/translations-en';
import { RIBBON_CONTEXTUAL_TABS } from '../toolbar-actions';
import { CONTEXTUAL_TAB_GROUPS } from './gallery-placements';
import { buildRibbonGallery, RIBBON_GALLERY_IDS } from './gallery-registry';
import type { RibbonGalleryId } from './gallery-types';

const box = { x: 0, y: 0, width: 200, height: 100 };

const textShape = {
	...box,
	id: 's1',
	type: 'shape',
	shapeType: 'rect',
	shapeStyle: {},
	text: 'Text',
	textSegments: [{ text: 'Text', style: {} }],
} as unknown as PptxElement;

const picture = {
	...box,
	id: 'p1',
	type: 'picture',
	shapeType: 'rect',
	shapeStyle: {},
} as unknown as PptxElement;

const table = {
	...box,
	id: 't1',
	type: 'table',
	tableData: { columnWidths: [1], rows: [{ cells: [{ text: 'A' }] }] },
} as unknown as PptxElement;

const chart = {
	...box,
	id: 'c1',
	type: 'chart',
	chartData: {
		chartType: 'bar',
		barDirection: 'col',
		categories: ['a'],
		series: [{ name: 'S', values: [1] }],
	},
} as unknown as PptxElement;

const smartArt = {
	...box,
	id: 'sa1',
	type: 'smartArt',
	smartArtData: { nodes: [{ id: 'n1', text: 'One' }] },
} as unknown as PptxElement;

const ELEMENT_FOR: Record<RibbonGalleryId, PptxElement | null> = {
	shapeStyles: textShape,
	shapeEffects: textShape,
	wordArtStyles: textShape,
	pictureStyles: picture,
	bullets: textShape,
	numbering: textShape,
	tableStyles: table,
	chartStyles: chart,
	chartColors: chart,
	chartQuickLayout: chart,
	smartArtStyles: smartArt,
	smartArtColors: smartArt,
	themeColors: null,
	themeFonts: null,
};

const themeColorMap = { dk1: '#000000', lt1: '#FFFFFF', accent1: '#156082', accent2: '#E97132' };

function galleryKeys(id: RibbonGalleryId): string[] {
	const d = buildRibbonGallery(id, { element: ELEMENT_FOR[id], themeColorMap });
	return [
		d.labelKey,
		...d.sections.flatMap((s) => [
			...(s.titleKey ? [s.titleKey] : []),
			...s.items.map((i) => i.labelKey),
		]),
	];
}

describe('ribbon gallery strings', () => {
	it.each(RIBBON_GALLERY_IDS)('%s has every key in the English dictionary', (id) => {
		const missing = [...new Set(galleryKeys(id))].filter((key) => !(key in translationsEn));
		expect(missing).toStrictEqual([]);
	});

	it('names every contextual tab and gallery group', () => {
		const keys = [
			...RIBBON_CONTEXTUAL_TABS.map((t) => t.labelKey),
			...Object.values(CONTEXTUAL_TAB_GROUPS).flatMap((groups) => groups.map((g) => g.labelKey)),
		];
		expect(keys.filter((key) => !(key in translationsEn))).toStrictEqual([]);
	});
});
