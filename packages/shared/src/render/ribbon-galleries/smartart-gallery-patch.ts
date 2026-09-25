/**
 * The SmartArt style / colour-scheme patch every binding's inspector and the
 * SmartArt Design galleries share: merge the change into `smartArtData`, then
 * rebuild drawing shapes a structural edit had cleared (exactly what React's
 * `SmartArtPropertiesPanel.applySmartArtData` does with the element's box).
 *
 * Also the gallery catalogues: the core model offers five colour schemes and
 * three style intensities; each is named after the PowerPoint gallery entry
 * it writes (`Application.SmartArtColors` / `SmartArtQuickStyles` names, and
 * the accents `smartart-fabrication-styles.ts` puts in the fabricated
 * `dgm:colorsDef`).
 *
 * @module render/ribbon-galleries/smartart-gallery-patch
 */
import type {
	PptxElement,
	PptxSmartArtData,
	PptxThemeColorScheme,
	SmartArtColorScheme,
	SmartArtStyle,
} from 'pptx-viewer-core';

import { resolvePalette } from '../smartart-drawing';
import { rebuildDrawingShapesIfCleared } from '../smartart-reflow-to-shapes';

/** `data` with `patch` merged, drawing shapes rebuilt when a structural edit cleared them. */
export function applySmartArtDataPatch(
	data: PptxSmartArtData,
	patch: Partial<PptxSmartArtData>,
	box?: { width: number; height: number },
	elementId = 'inspector',
): PptxSmartArtData {
	const next = { ...data, ...patch };
	return box
		? rebuildDrawingShapesIfCleared(
				next,
				next.layout,
				resolvePalette(next),
				next.style ?? 'flat',
				elementId,
				box,
			)
		: next;
}

/** The element patch for a SmartArt style / colour change, or null for a non-SmartArt. */
export function smartArtElementPatch(
	element: PptxElement | null,
	patch: Partial<PptxSmartArtData>,
): { elementId: string; patch: Partial<PptxElement> } | null {
	if (element?.type !== 'smartArt' || !element.smartArtData) {
		return null;
	}
	const smartArtData = applySmartArtDataPatch(
		element.smartArtData,
		patch,
		{ width: element.width, height: element.height },
		element.id,
	);
	return { elementId: element.id, patch: { smartArtData } as Partial<PptxElement> };
}

export interface SmartArtColorEntry {
	id: SmartArtColorScheme;
	section: 'colorful' | 'accent1' | 'accent2';
	/** PowerPoint's gallery name. */
	name: string;
	labelKey: string;
	/** Theme accents the scheme fills nodes with, in cycle order. */
	accents: ReadonlyArray<keyof PptxThemeColorScheme>;
}

export const SMARTART_COLOR_ENTRIES: readonly SmartArtColorEntry[] = [
	{
		id: 'colorful1',
		section: 'colorful',
		name: 'Colorful - Accent Colors',
		labelKey: 'pptx.gallery.smartArtColors.colorful1',
		accents: ['accent1', 'accent2', 'accent3'],
	},
	{
		id: 'colorful2',
		section: 'colorful',
		name: 'Colorful Range - Accent Colors 2 to 3',
		labelKey: 'pptx.gallery.smartArtColors.colorfulRange',
		accents: ['accent2', 'accent3', 'accent4'],
	},
	{
		id: 'colorful3',
		section: 'colorful',
		name: 'Colorful Range - Accent Colors 3 to 4',
		labelKey: 'pptx.gallery.smartArtColors.colorfulRange',
		accents: ['accent3', 'accent4', 'accent5'],
	},
	{
		id: 'monochromatic1',
		section: 'accent1',
		name: 'Colored Fill - Accent 1',
		labelKey: 'pptx.gallery.smartArtColors.coloredFill',
		accents: ['accent1'],
	},
	{
		id: 'monochromatic2',
		section: 'accent2',
		name: 'Colored Fill - Accent 2',
		labelKey: 'pptx.gallery.smartArtColors.coloredFill',
		accents: ['accent2'],
	},
];

export interface SmartArtStyleEntry {
	id: SmartArtStyle;
	name: string;
	labelKey: string;
}

export const SMARTART_STYLE_ENTRIES: readonly SmartArtStyleEntry[] = [
	{ id: 'flat', name: 'Simple Fill', labelKey: 'pptx.gallery.smartArtStyles.simpleFill' },
	{
		id: 'moderate',
		name: 'Moderate Effect',
		labelKey: 'pptx.gallery.smartArtStyles.moderateEffect',
	},
	{ id: 'intense', name: 'Intense Effect', labelKey: 'pptx.gallery.smartArtStyles.intenseEffect' },
];
