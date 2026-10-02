import { buildFontCatalog } from './font-catalog';
import type { FontCatalogInput } from './font-catalog';
import { applyRibbonGalleryItem, buildRibbonGallery } from './ribbon-galleries';
import type { RibbonGalleryContext, RibbonGalleryId } from './ribbon-galleries';
import type {
	RibbonHomeControlState,
	RibbonHomeFamily,
	RibbonHomeItem,
	RibbonHomeViewState,
} from './ribbon-home-spec';
import { homeFamilyControls } from './ribbon-home-spec';

/** Home controls whose popover content is a shared gallery: the host supplies the editing context. */
export function homeGalleryControls(
	family: RibbonHomeFamily,
	context: RibbonGalleryContext,
	editable: boolean,
): RibbonHomeViewState['controls'] {
	const controls: Record<string, RibbonHomeControlState> = {};
	for (const spec of homeFamilyControls(family)) {
		if (spec.gallery) {
			controls[spec.id] = {
				gallery: {
					descriptor: buildRibbonGallery(spec.gallery.id as RibbonGalleryId, context),
					disabled: !editable,
				},
			};
		}
	}
	return controls as RibbonHomeViewState['controls'];
}

/** Merge gallery state into a family's gating (gallery entries add to, never replace, it). */
export function withHomeGalleries(
	base: RibbonHomeViewState['controls'],
	galleries: RibbonHomeViewState['controls'],
	editable: boolean,
): RibbonHomeViewState['controls'] {
	const merged: Record<string, RibbonHomeControlState | undefined> = { ...base };
	for (const [key, value] of Object.entries(galleries)) {
		merged[key] = { ...merged[key], ...value, disabled: merged[key]?.disabled ?? !editable };
	}
	return merged as RibbonHomeViewState['controls'];
}

/** The edit a picked tile of a Home gallery stands for, or undefined for a foreign id. */
export function homeGalleryApply(
	family: RibbonHomeFamily,
	controlId: string,
	itemId: string,
	context: RibbonGalleryContext,
) {
	const spec = homeFamilyControls(family).find((entry) => entry.id === controlId && entry.gallery);
	return spec?.gallery
		? applyRibbonGalleryItem(spec.gallery.id as RibbonGalleryId, itemId, context)
		: undefined;
}

export interface FontPickerHomeInput extends FontCatalogInput {
	enabled: boolean;
	fontFamily: string;
	/** Size in points, as shown. */
	fontSize: string | number;
}

/** Translated, grouped rows of the Font family select; theme faces carry their role. */
export function fontFamilyItems(
	catalog: FontCatalogInput,
	t: (key: string) => string,
): RibbonHomeItem[] {
	return buildFontCatalog(catalog).flatMap((group) =>
		group.entries.map((entry) => ({
			value: entry.family,
			label: entry.family,
			group: t(group.labelKey),
			fontFamily: entry.family,
			...(entry.themeRole && { description: t(`pptx.font.role.${entry.themeRole}`) }),
		})),
	);
}

/** Font family and size selects: current values and the translated family rows. */
export function fontPickerHomeControls(
	input: FontPickerHomeInput,
	t: (key: string) => string,
): RibbonHomeViewState['controls'] {
	const disabled = !input.enabled;
	return {
		'home.font.fontFamily': { disabled, value: input.fontFamily, items: fontFamilyItems(input, t) },
		'home.font.fontSize': { disabled, value: String(input.fontSize) },
	};
}

export interface ArrangeShapeHomeInput {
	editable: boolean;
	canGroup: boolean;
	canUngroup: boolean;
	canMerge: boolean;
	canCrop: boolean;
	/** On-canvas crop mode is active (the Crop button is pressed). */
	cropActive: boolean;
	canStrokeWidth: boolean;
	strokeWidth: number;
	/** Host-hidden Merge Shapes and Crop buttons. */
	hideMerge?: boolean;
	hideCrop?: boolean;
}

/** Group, Ungroup, Merge Shapes, Crop and the outline width spinner. */
export function arrangeShapeHomeControls(
	input: ArrangeShapeHomeInput,
): RibbonHomeViewState['controls'] {
	const crop = { disabled: !input.editable || !input.canCrop, hidden: input.hideCrop };
	return {
		'home.arrange.group': { disabled: !input.canGroup },
		'home.arrange.ungroup': { disabled: !input.canUngroup },
		'home.arrange.mergeShapes': {
			disabled: !input.editable || !input.canMerge,
			hidden: input.hideMerge,
		},
		'home.arrange.crop': { ...crop, pressed: input.cropActive },
		'home.arrange.crop#caret': crop,
		'home.arrange.outlineWidth': { disabled: !input.canStrokeWidth, value: input.strokeWidth },
	};
}

/** The second Format Painter pill in Arrange mirrors the Clipboard one. */
export function arrangePainterHomeControls(input: {
	editable: boolean;
	active: boolean;
	canFormatPaint: boolean;
	show: boolean;
}): RibbonHomeViewState['controls'] {
	return {
		'home.clipboard.formatPainter': {
			disabled: !input.editable || (!input.canFormatPaint && !input.active),
			pressed: input.active,
			hidden: !input.show,
		},
	};
}

export type HomeDrawingArrangeCommand = 'forward' | 'backward' | 'front' | 'back';
