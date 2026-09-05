import type { OpenXmlCoverageFacets } from './openxml-coverage';
import { testEvidence } from './openxml-coverage-evidence';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

assign(
	[
		'drawing:complexType:CT_TableStyle',
		'drawing:complexType:CT_TableStyleList',
		'drawing:complexType:CT_TableBackgroundStyle',
		'drawing:complexType:CT_TableStyleTextStyle',
		'drawing:complexType:CT_TableStyleCellStyle',
		'drawing:element:wholeTbl',
		'drawing:element:band1H',
		'drawing:element:band2H',
		'drawing:element:band1V',
		'drawing:element:band2V',
		'drawing:element:lastCol',
		'drawing:element:firstCol',
		'drawing:element:lastRow',
		'drawing:element:firstRow',
		'drawing:element:neCell',
		'drawing:element:nwCell',
		'drawing:element:seCell',
		'drawing:element:swCell',
		'drawing:element:tblBg',
		'drawing:element:tableStyleId',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: "All 13 CT_TableStyle sections plus tblBg resolve into per-cell styling with correct band/corner/first-row-and-column precedence; a table style id can be assigned when a table is created. Since wave 3 (W3-E), editing an existing deck-authored tableStyles.xml section IS independently modeled and written natively: table-style-save.ts's applyTableStyleEntryToNode writes fill (table-style-fill-write.ts: solidFill/noFill/gradient/pattern, an image fill left untouched since a relationship cannot be synthesised), text (table-style-text-write.ts: a:fontRef colour, bold/italic/underline), borders including both diagonals and legacy bl2tr migration (table-style-border-write.ts), cell3D bevel/material/light-rig, and a:tblBg (inline solid fill or a style-matrix fillRef with colour transform, preserving an existing effectLst) for all 4 facets (fill/text/borders/cell3D) x 13 sections. Since wave 4 (W4-E/E2) every binding's inspector also exposes an Edit style... panel over the same writer (shared table-style-editor-*.ts and table-style-map-edits.ts), with edits rendering live and persisting on save.",
		evidence: [
			testEvidence(
				'src/core/utils/table-style-resolver.test.ts',
				[
					'applies wholeTbl fill to any cell',
					'band1H for even band index (row 0)',
					'band1V for even band index (col 0)',
					'firstRow fill overrides band1H fill',
					'lastCol fill overrides band1V',
					'neCell: firstRow && lastCol corner',
				],
				['parse'],
			),
			testEvidence(
				'src/core/core/builders/table-data-parser.test.ts',
				[
					'parses table style ID from a:tblStyle/@val',
					'parses table style ID from spec-form <a:tableStyleId> child element',
				],
				['parse'],
			),
			testEvidence(
				'src/core/builders/sdk/create-from-scratch.test.ts',
				['contains ppt/tableStyles.xml'],
				['edit', 'serialize'],
			),
			testEvidence(
				'src/core/core/runtime/table-style-save.test.ts',
				[
					'writes noFill, gradient, and pattern fills',
					'writes every border side including the diagonals',
					'writes material, bevel, and light rig',
					'writes a style-matrix fillRef with a colour transform',
					"writes the scheme colour as a:tcTxStyle's own child beside a:fontRef, as PowerPoint does",
					'leaves an untouched facet byte-for-byte: a fill edit does not re-emit borders or text',
				],
				['preserve', 'edit', 'serialize'],
			),
			testEvidence(
				'src/__tests__/integration/table-styles-default-id-preserved-on-save.test.ts',
				['keeps the previously-set default GUID across a later, unrelated table-style edit'],
				['preserve', 'serialize'],
			),
		],
	},
);

assign(
	[
		'drawing:attribute:gridSpan',
		'drawing:attribute:rowSpan',
		'drawing:attribute:hMerge',
		'drawing:attribute:vMerge',
	],
	{
		parse: 'native',
		preserve: 'unassessed',
		edit: 'native',
		serialize: 'native',
		note: 'Table cell merge state (gridSpan, rowSpan, hMerge, vMerge) parses and is recomputed on save from the current merge model, including L-shaped merge origins and continuation cells. No dedicated round-trip test evidencing preserve was found, so preserve is left unassessed rather than assumed.',
		evidence: [
			testEvidence(
				'src/core/core/builders/table-data-parser.test.ts',
				['parses gridSpan for horizontal merge', 'parses rowSpan and vMerge for vertical merge'],
				['parse'],
			),
			testEvidence(
				'src/core/core/runtime/save-table-merge-helpers.test.ts',
				[
					'should set gridSpan when > 1',
					'should handle a complex L-shape merge origin (gridSpan + rowSpan)',
					'should handle a continuation cell with both hMerge and vMerge',
				],
				['edit', 'serialize'],
			),
		],
	},
);

assign(['drawing:element:lnTlToBr', 'drawing:element:lnBlToTr'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'native',
	serialize: 'native',
	note: 'Table cell diagonal borders (top-left-to-bottom-right and bottom-left-to-top-right) parse and re-serialize independently. No dedicated round-trip test evidencing preserve was found, so preserve is left unassessed rather than assumed.',
	evidence: [
		testEvidence(
			'src/core/core/builders/table-cell-fill-border-helpers.test.ts',
			['applies diagonal borders'],
			['parse'],
		),
		testEvidence(
			'src/core/core/runtime/table-cell-save-helpers.test.ts',
			[
				'should serialize diagonal down border (a:lnTlToBr)',
				'should serialize diagonal up border (a:lnBlToTr)',
				'should serialize both diagonal borders',
			],
			['edit', 'serialize'],
		),
	],
});

assign(
	[
		'drawing:attribute:vert',
		'drawing:attribute:anchor',
		'drawing:attribute:anchorCtr',
		'drawing:attribute:horzOverflow',
	],
	{
		parse: 'native',
		preserve: 'unassessed',
		edit: 'native',
		serialize: 'native',
		note: 'Table cell text direction, vertical anchor, anchor-centering, and horizontal-overflow attributes are typed and re-serialized. No dedicated round-trip test evidencing preserve was found, so preserve is left unassessed rather than assumed. This id is shared with other non-table usages of the same attribute name elsewhere in the manifest.',
		evidence: [
			testEvidence(
				'src/core/core/builders/table-cell-text-style-helpers.test.ts',
				[
					"sets vAlign to middle for anchor 'ctr'",
					"sets textDirection to vert for 'vert'",
					"sets anchorCtr when '@_anchorCtr' is '1'",
					"captures horzOverflow 'clip'",
				],
				['parse'],
			),
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeSaveTableStyles.test.ts',
				['should set vertical alignment', 'should set text direction for vertical'],
				['edit', 'serialize'],
			),
		],
	},
);

assign(['drawing:complexType:CT_Cell3D', 'drawing:element:cell3D'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'Cell 3-D bevel width/height/preset, material, and light-rig fields parse into a typed style, both per-cell (a:tcPr/a:cell3D) and, since issue G5, at the table-style level (a:tblStyleLst/a:tblStyle/.../a:tcStyle/a:cell3D), resolved per band by the shared cascade the same way fill and borders are. No save-path test was found demonstrating independent re-serialization or round-trip preservation after an edit, so those facets are left unassessed rather than assumed.',
	evidence: [
		testEvidence(
			'src/core/core/builders/table-cell-fill-border-helpers.test.ts',
			['parses bevel width/height/preset, material, and light rig'],
			['parse'],
		),
		testEvidence(
			'src/core/core/runtime/table-style-border-parse.test.ts',
			[
				'parses material, bevel, and light rig from a:tcStyle/a:cell3D',
				'returns undefined when a:tcStyle has no a:cell3D',
			],
			['parse'],
		),
		testEvidence(
			'src/core/core/runtime/table-style-entry-parse.test.ts',
			[
				'parses a whole-table cell3D bevel into wholeTblCell3D',
				'leaves wholeTblCell3D undefined when no section defines one',
			],
			['parse'],
		),
	],
});

assign(['drawing:complexType:CT_RelativeRect', 'drawing:element:srcRect'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'native',
	serialize: 'native',
	note: 'Picture source-rect crop is a signed ST_Percentage: a negative inset (PowerPoint dragging a crop handle outward past the source bitmap) pads the image inside its frame instead of clamping to 0, matching the sibling a:fillRect handling. The sign now survives parse, the render-side clamp (fill-style.ts clampCropValue), the interactive crop-editor patch (image-adjustments.ts), and save, not just parse; srcRect is deleted when no crop values remain. No dedicated round-trip test evidencing preserve was found, so preserve is left unassessed rather than assumed.',
	evidence: [
		testEvidence(
			'src/core/core/runtime/PptxHandlerRuntimeGeometryParsing.test.ts',
			[
				'should parse crop from a:srcRect',
				'should parse partial crop from a:srcRect (only left and right)',
				'preserves the sign of a negative a:srcRect inset (issue: outward crop was clamped to 0)',
				'preserves a negative a:srcRect inset (outward crop pads the image; issue G2)',
			],
			['parse'],
		),
		testEvidence(
			'src/core/core/runtime/PptxHandlerRuntimeSaveImageEffects.test.ts',
			[
				'should delete srcRect when no crop values are set',
				'should set srcRect for valid crop values',
				'preserves a negative outward-crop inset instead of clamping to 0 (issue G2)',
				'writes a negative srcRect inset instead of dropping it (issue G2)',
			],
			['edit', 'serialize'],
		),
	],
});

assign(
	[
		'drawing:complexType:CT_StretchInfoProperties',
		'drawing:complexType:CT_TileInfoProperties',
		'drawing:element:stretch',
		'drawing:element:fillRect',
		'drawing:element:tile',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'unassessed',
		serialize: 'unassessed',
		note: 'Stretch fillRect (including negative insets) and tile placement parse into typed fields and are read by shared rendering. Per the picture/table audit, neither is independently re-serialized from those typed fields on save and no binding exposes them as editable, so edit/serialize are left unassessed rather than a fabricated grade; an authored value survives only because save mutates the preserved raw XML in place.',
		evidence: [
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeGeometryParsing.test.ts',
				[
					'maps a:stretch/a:fillRect to the fillRect placement fields, signs preserved',
					'keeps a:srcRect and a:stretch/a:fillRect as independent axes',
				],
				['parse', 'preserve'],
			),
		],
	},
);

assign(
	[
		'drawing:element:cNvPr',
		'drawing:element:cNvSpPr',
		'drawing:element:cNvGrpSpPr',
		'drawing:element:cNvPicPr',
	],
	{
		parse: 'native',
		preserve: 'unassessed',
		edit: 'native',
		serialize: 'native',
		note: 'Non-visual property containers are resolved per shape kind (sp/pic/cxnSp/graphicFrame/grpSp) and carry typed lock children through edits. No dedicated round-trip test evidencing preserve was found, so preserve is left unassessed rather than assumed.',
		evidence: [
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeElementActions.test.ts',
				[
					'should resolve p:cNvPr from p:nvSpPr for p:sp key',
					'should resolve p:cNvPr from p:nvPicPr for p:pic key',
					'should resolve p:cNvPr from p:nvGrpSpPr for p:grpSp key',
					'writes a:spLocks onto p:cNvSpPr for a shape',
					'writes a:grpSpLocks onto p:cNvGrpSpPr for a group',
				],
				['parse', 'edit', 'serialize'],
			),
		],
	},
);

export const OPENXML_TABLE_STYLE_PICTURE_FILL_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
