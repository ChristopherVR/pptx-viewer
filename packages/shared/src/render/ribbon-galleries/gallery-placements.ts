/**
 * Where each gallery sits in the ribbon, and which contextual tabs the
 * current selection shows. Bindings render these lists; they never decide
 * placement themselves.
 *
 * @module render/ribbon-galleries/gallery-placements
 */
import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

import type { ResolvedCustomization } from '../customization/customization-resolve';
import type { RibbonControlId, RibbonGroupId } from '../customization/ribbon-control-ids';
import { RIBBON_CONTEXTUAL_TABS } from '../toolbar-actions';
import type { RibbonContextualTabId } from '../toolbar-actions';
import type { RibbonGalleryId } from './gallery-types';

/** One gallery inside a group: the gallery and the control id it is tagged with. */
export interface RibbonGalleryPlacement {
	gallery: RibbonGalleryId;
	control: RibbonControlId;
	/**
	 * `inline`: a strip of the first tiles in the ribbon plus a "more" button
	 * (PowerPoint's in-ribbon galleries). `dropdown`: a single trigger button.
	 */
	mode: 'inline' | 'dropdown';
}

export interface RibbonGalleryGroupPlacement {
	group: RibbonGroupId;
	/** i18n key of the group caption. */
	labelKey: string;
	label: string;
	galleries: readonly RibbonGalleryPlacement[];
}

/** The groups each contextual tab renders, in order. */
export const CONTEXTUAL_TAB_GROUPS: Record<
	RibbonContextualTabId,
	readonly RibbonGalleryGroupPlacement[]
> = {
	shapeFormat: [
		{
			group: 'shapeFormat.shapeStyles',
			labelKey: 'pptx.ribbon.groupShapeStyles',
			label: 'Shape Styles',
			galleries: [
				{ gallery: 'shapeStyles', control: 'shapeFormat.shapeStyles.gallery', mode: 'inline' },
				{
					gallery: 'shapeEffects',
					control: 'shapeFormat.shapeStyles.shapeEffects',
					mode: 'dropdown',
				},
			],
		},
		{
			group: 'shapeFormat.wordArtStyles',
			labelKey: 'pptx.ribbon.groupWordArtStyles',
			label: 'WordArt Styles',
			galleries: [
				{ gallery: 'wordArtStyles', control: 'shapeFormat.wordArtStyles.gallery', mode: 'inline' },
			],
		},
	],
	pictureFormat: [
		{
			group: 'pictureFormat.pictureStyles',
			labelKey: 'pptx.ribbon.groupPictureStyles',
			label: 'Picture Styles',
			galleries: [
				{
					gallery: 'pictureStyles',
					control: 'pictureFormat.pictureStyles.gallery',
					mode: 'inline',
				},
				{
					gallery: 'shapeEffects',
					control: 'pictureFormat.pictureStyles.pictureEffects',
					mode: 'dropdown',
				},
			],
		},
	],
	tableDesign: [
		{
			group: 'tableDesign.tableStyles',
			labelKey: 'pptx.ribbon.groupTableStyles',
			label: 'Table Styles',
			galleries: [
				{ gallery: 'tableStyles', control: 'tableDesign.tableStyles.gallery', mode: 'inline' },
			],
		},
	],
	chartDesign: [
		{
			group: 'chartDesign.chartLayouts',
			labelKey: 'pptx.ribbon.groupChartLayouts',
			label: 'Chart Layouts',
			galleries: [
				{
					gallery: 'chartQuickLayout',
					control: 'chartDesign.chartLayouts.quickLayout',
					mode: 'dropdown',
				},
			],
		},
		{
			group: 'chartDesign.chartStyles',
			labelKey: 'pptx.ribbon.groupChartStyles',
			label: 'Chart Styles',
			galleries: [
				{
					gallery: 'chartColors',
					control: 'chartDesign.chartStyles.changeColors',
					mode: 'dropdown',
				},
				{ gallery: 'chartStyles', control: 'chartDesign.chartStyles.gallery', mode: 'inline' },
			],
		},
	],
	smartArtDesign: [
		{
			group: 'smartArtDesign.smartArtStyles',
			labelKey: 'pptx.ribbon.groupSmartArtStyles',
			label: 'SmartArt Styles',
			galleries: [
				{
					gallery: 'smartArtColors',
					control: 'smartArtDesign.smartArtStyles.changeColors',
					mode: 'dropdown',
				},
				{
					gallery: 'smartArtStyles',
					control: 'smartArtDesign.smartArtStyles.gallery',
					mode: 'inline',
				},
			],
		},
	],
};

/**
 * Galleries that live on the fixed tabs, as dropdown triggers inside groups
 * those tabs already render: Home > Drawing (Quick Styles, Shape Effects,
 * replacing the old disabled Shape Effects placeholder), Home > Paragraph
 * (the Bullets / Numbering libraries, next to their toggles) and Design >
 * Variants (a new group after Themes).
 */
export const FIXED_TAB_GALLERIES: readonly RibbonGalleryPlacement[] = [
	{ gallery: 'shapeStyles', control: 'home.drawing.quickStyles', mode: 'dropdown' },
	{ gallery: 'shapeEffects', control: 'home.drawing.shapeEffects', mode: 'dropdown' },
	{ gallery: 'bullets', control: 'home.paragraph.bullets', mode: 'dropdown' },
	{ gallery: 'numbering', control: 'home.paragraph.numbering', mode: 'dropdown' },
	{ gallery: 'themeColors', control: 'design.variants.colors', mode: 'dropdown' },
	{ gallery: 'themeFonts', control: 'design.variants.fonts', mode: 'dropdown' },
];

/** The contextual tabs a selection of `element` brings up, in PowerPoint's order. */
export function contextualTabsForElement(element: PptxElement | null): RibbonContextualTabId[] {
	if (!element) {
		return [];
	}
	switch (element.type) {
		case 'image':
		case 'picture':
			return ['pictureFormat'];
		case 'table':
			return ['tableDesign'];
		case 'chart':
			return ['chartDesign'];
		case 'smartArt':
			return ['smartArtDesign'];
		default:
			return hasShapeProperties(element) ? ['shapeFormat'] : [];
	}
}

/** {@link contextualTabsForElement} minus the tabs the host hid. */
export function visibleContextualTabs(
	element: PptxElement | null,
	resolved?: ResolvedCustomization,
): RibbonContextualTabId[] {
	return contextualTabsForElement(element).filter(
		(tab) => !resolved?.hiddenContextualTabs.has(tab),
	);
}

/** i18n key of a contextual tab's caption. */
export function contextualTabLabelKey(tab: RibbonContextualTabId): string {
	return RIBBON_CONTEXTUAL_TABS.find((t) => t.id === tab)?.labelKey ?? tab;
}

/**
 * The tab to show: `active` unless it is a contextual tab the selection no
 * longer brings up, in which case the ribbon falls back to Home (as
 * PowerPoint does when you deselect a picture while on Picture Format).
 */
export function resolveActiveRibbonTab<T extends string>(
	active: T | RibbonContextualTabId,
	visibleContextual: readonly RibbonContextualTabId[],
	fallback: T,
): T | RibbonContextualTabId {
	const isContextual = RIBBON_CONTEXTUAL_TABS.some((t) => t.id === active);
	if (isContextual && !visibleContextual.includes(active as RibbonContextualTabId)) {
		return fallback;
	}
	return active;
}
