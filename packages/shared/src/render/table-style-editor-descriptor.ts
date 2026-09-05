/**
 * A pure decision function for the table-style DEFINITION editor: given a
 * loaded `ParsedTableStyleEntry` and the part the user has selected (one of
 * the 13 `CT_TableStyle` sections, or the synthetic `'background'` part for
 * `a:tblBg`), {@link describeTableStyleEditor} returns a framework-neutral
 * descriptor of that part's editable fields (fill colour/ref, text
 * bold/italic/underline/colour, per-side borders including both diagonals,
 * and the rarely-used cell3D bevel). Every binding (react/vue/angular/
 * svelte/vanilla) maps this descriptor onto its own template; none of them
 * re-derive which facet lives on which section.
 *
 * @module render/table-style-editor-descriptor
 */
import type {
	ParsedTableStyleBorder,
	ParsedTableStyleBorders,
	ParsedTableStyleEntry,
	ParsedTableStyleFill,
	ParsedTableStyleText,
	PptxTableCell3D,
	PptxThemeColorRef,
	PptxThemeColorSchemeName,
} from 'pptx-viewer-core';
import { resolveThemeColorRef } from 'pptx-viewer-core';

import type { TableStyleBorderSide, TableStyleEditorPartId } from './table-style-editor-parts';
import { isTableStylePartName, TABLE_STYLE_BORDER_SIDES } from './table-style-editor-parts';

/** A colour shown/edited by the panel: always a paintable hex, plus the theme ref when one applies. */
export interface TableStyleEditorColor {
	readonly hex: string;
	readonly ref: PptxThemeColorRef | undefined;
}

/** The selected part's fill facet. */
export interface TableStyleEditorFillField {
	readonly color: TableStyleEditorColor;
	readonly noFill: boolean;
	/** Whether this section defines a fill at all (vs. inheriting/rendering nothing). */
	readonly isSet: boolean;
}

/** The selected part's text facet (absent for the synthetic background part). */
export interface TableStyleEditorTextField {
	readonly bold: boolean;
	readonly italic: boolean;
	readonly underline: boolean;
	readonly color: TableStyleEditorColor;
	readonly isSet: boolean;
}

/** One border side's state. */
export interface TableStyleEditorBorderSideField {
	readonly color: TableStyleEditorColor;
	readonly width: number;
	readonly dash: string;
	readonly noFill: boolean;
	readonly isSet: boolean;
}

export type TableStyleEditorBorderFields = Readonly<
	Record<TableStyleBorderSide, TableStyleEditorBorderSideField>
>;

/** The selected part's 3D bevel facet (rare: none of PowerPoint's 74 built-ins use it). */
export interface TableStyleEditorCell3DField {
	readonly bevelWidth: number | undefined;
	readonly bevelHeight: number | undefined;
	readonly bevelPreset: string | undefined;
	readonly isSet: boolean;
}

/** Everything the panel needs to render the currently-selected part. */
export interface TableStyleEditorDescriptor {
	readonly styleId: string;
	readonly styleName: string;
	readonly selectedPart: TableStyleEditorPartId;
	/** `true` for the 13 real sections; `false` for the synthetic background part (fill only). */
	readonly hasTextAndBorders: boolean;
	readonly fill: TableStyleEditorFillField;
	readonly text: TableStyleEditorTextField;
	readonly borders: TableStyleEditorBorderFields;
	readonly cell3D: TableStyleEditorCell3DField;
}

const DEFAULT_FILL_HEX = '#ffffff';
const DEFAULT_TEXT_HEX = '#000000';
const DEFAULT_BORDER_HEX = '#808080';

/** Resolve a `ParsedTableStyleFill` (or a border's colour choice) to a paintable colour + ref. */
function fillToColor(
	fill: ParsedTableStyleFill | undefined,
	themeColorMap: Readonly<Record<string, string>> | undefined,
	fallbackHex: string,
): TableStyleEditorColor {
	if (!fill) {
		return { hex: fallbackHex, ref: undefined };
	}
	if (fill.schemeColor) {
		const ref: PptxThemeColorRef = {
			scheme: fill.schemeColor as PptxThemeColorSchemeName,
			tint: fill.tint,
			shade: fill.shade,
		};
		return { hex: resolveThemeColorRef(ref, themeColorMap) ?? fallbackHex, ref };
	}
	if (fill.color) {
		return { hex: fill.color, ref: undefined };
	}
	return { hex: fallbackHex, ref: undefined };
}

/** Bidirectional inverse of {@link fillToColor}: build the `ParsedTableStyleFill` a commit writes. */
export function colorToFill(hex: string, ref: PptxThemeColorRef | undefined): ParsedTableStyleFill {
	if (ref) {
		return { schemeColor: ref.scheme, tint: ref.tint, shade: ref.shade };
	}
	return { schemeColor: '', color: hex };
}

function describeFill(
	fill: ParsedTableStyleFill | undefined,
	themeColorMap: Readonly<Record<string, string>> | undefined,
): TableStyleEditorFillField {
	return {
		color: fillToColor(fill, themeColorMap, DEFAULT_FILL_HEX),
		noFill: fill?.noFill ?? false,
		isSet: fill !== undefined,
	};
}

function describeText(
	text: ParsedTableStyleText | undefined,
	themeColorMap: Readonly<Record<string, string>> | undefined,
): TableStyleEditorTextField {
	const asFill: ParsedTableStyleFill | undefined = text
		? {
				schemeColor: text.fontSchemeColor ?? '',
				tint: text.fontTint,
				shade: text.fontShade,
				color: text.fontColor,
			}
		: undefined;
	return {
		bold: text?.bold ?? false,
		italic: text?.italic ?? false,
		underline: text?.underline ?? false,
		color: fillToColor(asFill, themeColorMap, DEFAULT_TEXT_HEX),
		isSet: text !== undefined,
	};
}

function borderSideColor(
	border: ParsedTableStyleBorder | undefined,
	themeColorMap: Readonly<Record<string, string>> | undefined,
): TableStyleEditorColor {
	if (border?.fill) {
		return fillToColor(border.fill, themeColorMap, DEFAULT_BORDER_HEX);
	}
	if (border?.color) {
		return { hex: border.color, ref: undefined };
	}
	return { hex: DEFAULT_BORDER_HEX, ref: undefined };
}

function describeBorders(
	borders: ParsedTableStyleBorders | undefined,
	themeColorMap: Readonly<Record<string, string>> | undefined,
): TableStyleEditorBorderFields {
	const result = {} as Record<TableStyleBorderSide, TableStyleEditorBorderSideField>;
	for (const side of TABLE_STYLE_BORDER_SIDES) {
		const border = borders?.[side];
		result[side] = {
			color: borderSideColor(border, themeColorMap),
			width: border?.width ?? 1,
			dash: border?.dash ?? 'solid',
			noFill: border?.noFill ?? false,
			isSet: border !== undefined,
		};
	}
	return result;
}

function describeCell3D(cell3D: PptxTableCell3D | undefined): TableStyleEditorCell3DField {
	return {
		bevelWidth: cell3D?.bevelWidth,
		bevelHeight: cell3D?.bevelHeight,
		bevelPreset: cell3D?.bevelPreset,
		isSet: cell3D !== undefined,
	};
}

/** Widen `entry` so `${part}Fill` / `${part}Text` / ... dynamic keys read without an index signature. */
type SectionKeyed = Record<
	string,
	| ParsedTableStyleFill
	| ParsedTableStyleText
	| ParsedTableStyleBorders
	| PptxTableCell3D
	| undefined
>;

/**
 * Build the descriptor for `entry`'s `selectedPart`. Returns `undefined` only
 * when `entry` itself is `undefined` (no style loaded / selected yet).
 */
export function describeTableStyleEditor(
	entry: ParsedTableStyleEntry | undefined,
	selectedPart: TableStyleEditorPartId,
	themeColorMap: Readonly<Record<string, string>> | undefined,
): TableStyleEditorDescriptor | undefined {
	if (!entry) {
		return undefined;
	}
	const keyed = entry as unknown as SectionKeyed;
	const hasTextAndBorders = isTableStylePartName(selectedPart);

	const fill =
		selectedPart === 'background'
			? entry.tableBackground?.fill
			: (keyed[`${selectedPart}Fill`] as ParsedTableStyleFill | undefined);
	const text = hasTextAndBorders
		? (keyed[`${selectedPart}Text`] as ParsedTableStyleText | undefined)
		: undefined;
	const borders = hasTextAndBorders
		? (keyed[`${selectedPart}Borders`] as ParsedTableStyleBorders | undefined)
		: undefined;
	const cell3D = hasTextAndBorders
		? (keyed[`${selectedPart}Cell3D`] as PptxTableCell3D | undefined)
		: undefined;

	return {
		styleId: entry.styleId,
		styleName: entry.styleName ?? '',
		selectedPart,
		hasTextAndBorders,
		fill: describeFill(fill, themeColorMap),
		text: describeText(text, themeColorMap),
		borders: describeBorders(borders, themeColorMap),
		cell3D: describeCell3D(cell3D),
	};
}
