/**
 * The 14 named parts a table style DEFINITION can be edited section-by-section:
 * the 13 `CT_TableStyle` regions (`TABLE_STYLE_PART_SEQUENCE`, from core) plus
 * the table-level `a:tblBg` background, which core models as a distinct field
 * (`ParsedTableStyleEntry.tableBackground`) rather than a 14th
 * `TableStylePartName`. Every binding's table-style editor UI walks this one
 * list so a part's label and picker position are fixed in a single place.
 *
 * @module render/table-style-editor-parts
 */
import type { TableStylePartName } from 'pptx-viewer-core';
import { TABLE_STYLE_PART_SEQUENCE } from 'pptx-viewer-core';

/** A real `TableStylePartName`, plus the synthetic `'background'` part for `a:tblBg`. */
export type TableStyleEditorPartId = TableStylePartName | 'background';

/** One entry in the part picker: its id and the i18n key for its label. */
export interface TableStyleEditorPartDescriptor {
	readonly id: TableStyleEditorPartId;
	readonly labelKey: string;
}

/**
 * Every editable part, in the display order PowerPoint's own "Modify Table
 * Style" dialog uses (structural regions grouped, background last) - NOT
 * `TABLE_STYLE_PART_SEQUENCE`'s order, which exists to answer "which section
 * wins on a given cell" rather than "what order to list them in a picker".
 */
export const TABLE_STYLE_EDITOR_PARTS: readonly TableStyleEditorPartDescriptor[] = [
	{ id: 'wholeTbl', labelKey: 'pptx.tableStyleEditor.part.wholeTbl' },
	{ id: 'firstRow', labelKey: 'pptx.tableStyleEditor.part.firstRow' },
	{ id: 'lastRow', labelKey: 'pptx.tableStyleEditor.part.lastRow' },
	{ id: 'firstCol', labelKey: 'pptx.tableStyleEditor.part.firstCol' },
	{ id: 'lastCol', labelKey: 'pptx.tableStyleEditor.part.lastCol' },
	{ id: 'band1H', labelKey: 'pptx.tableStyleEditor.part.band1H' },
	{ id: 'band2H', labelKey: 'pptx.tableStyleEditor.part.band2H' },
	{ id: 'band1V', labelKey: 'pptx.tableStyleEditor.part.band1V' },
	{ id: 'band2V', labelKey: 'pptx.tableStyleEditor.part.band2V' },
	{ id: 'neCell', labelKey: 'pptx.tableStyleEditor.part.neCell' },
	{ id: 'nwCell', labelKey: 'pptx.tableStyleEditor.part.nwCell' },
	{ id: 'seCell', labelKey: 'pptx.tableStyleEditor.part.seCell' },
	{ id: 'swCell', labelKey: 'pptx.tableStyleEditor.part.swCell' },
	{ id: 'background', labelKey: 'pptx.tableStyleEditor.part.background' },
];

/** Whether a part id is one of the 13 real `CT_TableStyle` sections (not the synthetic background). */
export function isTableStylePartName(id: TableStyleEditorPartId): id is TableStylePartName {
	return (TABLE_STYLE_PART_SEQUENCE as readonly string[]).includes(id);
}

/** The 8 border sides a section's `a:tcStyle/a:tcBdr` can carry (both diagonals included). */
export const TABLE_STYLE_BORDER_SIDES = [
	'left',
	'right',
	'top',
	'bottom',
	'insideH',
	'insideV',
	'tl2br',
	'tr2bl',
] as const;

export type TableStyleBorderSide = (typeof TABLE_STYLE_BORDER_SIDES)[number];

/** i18n key for each border side's label. */
export const TABLE_STYLE_BORDER_SIDE_LABEL_KEYS: Readonly<Record<TableStyleBorderSide, string>> = {
	left: 'pptx.tableStyleEditor.side.left',
	right: 'pptx.tableStyleEditor.side.right',
	top: 'pptx.tableStyleEditor.side.top',
	bottom: 'pptx.tableStyleEditor.side.bottom',
	insideH: 'pptx.tableStyleEditor.side.insideH',
	insideV: 'pptx.tableStyleEditor.side.insideV',
	tl2br: 'pptx.tableStyleEditor.side.tl2br',
	tr2bl: 'pptx.tableStyleEditor.side.tr2bl',
};

/** OOXML `a:prstDash@val` choices offered by the dash picker. */
export const TABLE_STYLE_DASH_PRESETS = [
	'solid',
	'dot',
	'dash',
	'lgDash',
	'dashDot',
	'lgDashDot',
	'lgDashDotDot',
	'sysDash',
	'sysDot',
	'sysDashDot',
	'sysDashDotDot',
] as const;
