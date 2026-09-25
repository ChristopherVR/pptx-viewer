import type { PptxElement, ResolvedStyleMatrix, XmlObject } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveCustomization } from '../customization/customization-resolve';
import {
	CONTEXTUAL_TAB_GROUPS,
	contextualTabsForElement,
	FIXED_TAB_GALLERIES,
	resolveActiveRibbonTab,
	visibleContextualTabs,
} from './gallery-placements';
import { applyRibbonGalleryItem, buildRibbonGallery, RIBBON_GALLERY_IDS } from './gallery-registry';
import { galleryItemLabel, inlineGalleryItems } from './gallery-view';

const colorMap = { dk1: '#000000', lt1: '#FFFFFF', accent1: '#156082', accent2: '#E97132' };

function shape(): PptxElement {
	return {
		id: 's1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle: {
			fillColor: '#FF0000',
			fillMode: 'solid',
			glowColor: '#00FF00',
			connectorEndArrow: 'triangle',
		},
		textSegments: [{ text: 'Hi', style: { color: '#000000' } }],
	} as unknown as PptxElement;
}

describe('ribbon gallery registry', () => {
	it('builds every gallery without a selection', () => {
		for (const id of RIBBON_GALLERY_IDS) {
			const descriptor = buildRibbonGallery(id, { element: null, themeColorMap: colorMap });
			expect(descriptor.id).toBe(id);
			expect(descriptor.labelKey).toMatch(/^pptx\./u);
		}
	});

	it('places every gallery on a tab', () => {
		const placed = new Set([
			...FIXED_TAB_GALLERIES.map((p) => p.gallery),
			...Object.values(CONTEXTUAL_TAB_GROUPS).flatMap((groups) =>
				groups.flatMap((group) => group.galleries.map((g) => g.gallery)),
			),
		]);
		for (const id of RIBBON_GALLERY_IDS) {
			expect(placed.has(id)).toBeTruthy();
		}
	});
});

describe('shape Styles gallery', () => {
	it('offers PowerPoint 42 theme styles and 35 presets as SVG tiles', () => {
		const descriptor = buildRibbonGallery('shapeStyles', {
			element: shape(),
			themeColorMap: colorMap,
		});
		expect(descriptor.disabled).toBeFalsy();
		expect(descriptor.sections.map((s) => s.items.length)).toStrictEqual([42, 35]);
		const first = descriptor.sections[0].items[0];
		expect(first.previewSvg.startsWith('<svg')).toBeTruthy();
		expect(inlineGalleryItems(descriptor)).toHaveLength(6);
		expect(galleryItemLabel(first, (key) => key)).toBe('Colored Outline - Dark 1');
	});

	it('applies a theme style as the p:style references PowerPoint writes', () => {
		const calls: XmlObject[] = [];
		const resolveStyleMatrix = (xml: XmlObject): ResolvedStyleMatrix => {
			calls.push(xml);
			return {
				shapeStyle: { fillRefIdx: 1, lnRefIdx: 2, fillMode: 'solid', fillColor: '#156082' },
				fontColor: '#FFFFFF',
			};
		};
		const element = shape();
		const result = applyRibbonGalleryItem('shapeStyles', 'theme-1-1', {
			element,
			themeColorMap: colorMap,
			resolveStyleMatrix,
		});
		expect(calls[0]).toStrictEqual({
			'a:lnRef': {
				'@_idx': '2',
				'a:schemeClr': { '@_val': 'accent1', 'a:shade': { '@_val': '15000' } },
			},
			'a:fillRef': { '@_idx': '1', 'a:schemeClr': { '@_val': 'accent1' } },
			'a:effectRef': { '@_idx': '0', 'a:schemeClr': { '@_val': 'accent1' } },
			'a:fontRef': { '@_idx': 'minor', 'a:schemeClr': { '@_val': 'lt1' } },
		});
		expect(result?.kind).toBe('element');
		if (result?.kind !== 'element') {
			return;
		}
		const style = (result.patch as { shapeStyle: Record<string, unknown> }).shapeStyle;
		expect(style.fillRefIdx).toBe(1);
		expect(style.glowColor).toBeUndefined();
		expect(style.connectorEndArrow).toBe('triangle');
		const segments = (result.patch as { textSegments: Array<{ style: { color: string } }> })
			.textSegments;
		expect(segments[0].style.color).toBe('#FFFFFF');
	});

	it('writes presets in theme-colour terms', () => {
		const result = applyRibbonGalleryItem('shapeStyles', 'preset-2-2', {
			element: shape(),
			themeColorMap: colorMap,
		});
		if (result?.kind !== 'element') {
			throw new Error('expected an element patch');
		}
		const style = (result.patch as { shapeStyle: Record<string, unknown> }).shapeStyle;
		expect(style.fillColorRef).toStrictEqual({ scheme: 'accent2', alpha: 0.5 });
		expect(style.fillOpacity).toBe(0.5);
		expect(style.strokeWidth).toBe(0);
	});

	it('ignores unknown ids and non-shape selections', () => {
		expect(applyRibbonGalleryItem('shapeStyles', 'theme-9-9', { element: shape() })).toBeNull();
		expect(applyRibbonGalleryItem('shapeStyles', 'theme-0-0', { element: null })).toBeNull();
	});
});

describe('contextual tabs', () => {
	it('follows the selection kind', () => {
		expect(contextualTabsForElement(shape())).toStrictEqual(['shapeFormat']);
		expect(contextualTabsForElement({ ...shape(), type: 'table' } as PptxElement)).toStrictEqual([
			'tableDesign',
		]);
		expect(contextualTabsForElement(null)).toStrictEqual([]);
	});

	it('honours hidden contextual tabs and falls back to Home', () => {
		const resolved = resolveCustomization({ ribbon: { hiddenTabs: ['shapeFormat'] } });
		expect(visibleContextualTabs(shape(), resolved)).toStrictEqual([]);
		expect(resolveActiveRibbonTab('shapeFormat', [], 'home')).toBe('home');
		expect(resolveActiveRibbonTab('shapeFormat', ['shapeFormat'], 'home')).toBe('shapeFormat');
		expect(resolveActiveRibbonTab('insert', [], 'home')).toBe('insert');
	});
});
