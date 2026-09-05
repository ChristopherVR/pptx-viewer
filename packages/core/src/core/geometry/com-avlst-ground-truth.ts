/**
 * PowerPoint COM ground truth for `avLst` adjustment-guide names/defaults,
 * gathered 2026-09-05 for the W3-F geometry audit.
 *
 * Method: `Presentation.Slides(1).Shapes.AddShape(<MsoAutoShapeType>, 0, 0,
 * 200, 100)` for each id below, then `Shape.Adjustments.Count` and
 * `Shape.Adjustments.Item(i)` read back BEFORE saving (PowerPoint omits
 * `<a:avLst>` entirely from the saved file when every guide is still at its
 * built-in default, so the file itself is NOT a usable source for this - the
 * live COM object's `Adjustments` collection is). `Adjustments.Item(i)`
 * returns the guide's value as a plain 0..1 fraction; multiplying by 100000
 * recovers the OOXML `<a:gd fmla="val …"/>` integer (cross-checked against
 * `roundRect`, whose known-correct default of 16667 read back as exactly
 * `0.16667`). Adjustment guide NAMES are positional by ECMA-376 convention
 * (`"adj"` alone for a single guide, else `"adj1"..."adjN"` in order), which
 * this repo's own spec-accurate `gear9` CONNECTION-SITES table
 * (`preset-connection-sites-gear9.ts`, transcribed independently from
 * `presetShapeDefinitions.xml` for hit-testing, not for this render path)
 * independently confirms for gear9's `adj1`/`adj2` names and defaults.
 *
 * `preset-shape-definitions-tabs-decorations-test.ts` and
 * `preset-shape-definitions-action-buttons.test.ts` assert the corresponding
 * `PRESET_SHAPE_GEOMETRY_TABLE` entries directly; this file's own test
 * (`com-avlst-ground-truth.test.ts`) diffs the FULL table against every
 * preset recorded here, so a future edit that silently reintroduces a wrong
 * guide count/name/default fails immediately instead of waiting for another
 * COM audit to notice.
 *
 * This is NOT a full 187-preset sweep (that would require either a reliable
 * ECMA-name -> MsoAutoShapeType mapping for all 187 presets, which this repo
 * does not have catalogued anywhere, or per-preset raw-XML probing; both are
 * out of scope for this pass) - it covers the three preset families the W3-F
 * brief flagged as known-wrong (`actionButton*`, `gear6`, `gear9`) plus a
 * couple of already-correct presets kept in as regression anchors so the
 * diff test itself is proven to catch a real mismatch, not just an absent
 * one.
 */

/** `msoAutoShapeType` id -> the COM-verified `avLst` ground truth. */
export interface ComAvLstGroundTruthEntry {
	/** ECMA-376 `ST_ShapeType` / `a:prstGeom/@prst` name. */
	prst: string;
	/** `Shape.Adjustments.Count`. */
	count: number;
	/** Guide name -> default value in the OOXML `1/100000` integer scale. */
	guides: Record<string, number>;
}

export const COM_AVLST_GROUND_TRUTH: ComAvLstGroundTruthEntry[] = [
	// Calibration anchors (already correct pre-audit; COM-reconfirmed).
	{ prst: 'rect', count: 0, guides: {} },
	{ prst: 'roundRect', count: 1, guides: { adj: 16667 } },
	{ prst: 'sun', count: 1, guides: { adj: 25000 } },

	// The 12 actionButton* presets: COM-verified 0 adjustment handles each
	// (this repo previously modelled a nonexistent `adj: 6250`).
	{ prst: 'actionButtonBlank', count: 0, guides: {} },
	{ prst: 'actionButtonHome', count: 0, guides: {} },
	{ prst: 'actionButtonHelp', count: 0, guides: {} },
	{ prst: 'actionButtonInformation', count: 0, guides: {} },
	{ prst: 'actionButtonForwardNext', count: 0, guides: {} },
	{ prst: 'actionButtonBackPrevious', count: 0, guides: {} },
	{ prst: 'actionButtonEnd', count: 0, guides: {} },
	{ prst: 'actionButtonBeginning', count: 0, guides: {} },
	{ prst: 'actionButtonReturn', count: 0, guides: {} },
	{ prst: 'actionButtonDocument', count: 0, guides: {} },
	{ prst: 'actionButtonSound', count: 0, guides: {} },
	{ prst: 'actionButtonMovie', count: 0, guides: {} },

	// gear6 / gear9: COM-verified 2 adjustment handles each (this repo
	// previously modelled only a single `adj`).
	{ prst: 'gear6', count: 2, guides: { adj1: 15000, adj2: 3526 } },
	{ prst: 'gear9', count: 2, guides: { adj1: 10000, adj2: 1763 } },
];
