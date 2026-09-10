/**
 * Per-1000-em glyph advance widths for common SmartArt/theme minor fonts,
 * measured from REAL PowerPoint via COM automation. GENERATED BARREL FILE:
 * do not hand-edit; regenerate BOTH this and the per-font
 * `font-advance-widths-*.generated.ts` files with
 * `pwsh -File scripts/make-font-advance-table.ps1`.
 *
 * Method (see the script's own header comment for the full derivation): for
 * each printable ASCII code point 32-126, PowerPoint measured the difference
 * in `Shape.Width` (`TextFrame.AutoSize = ppAutoSizeShapeToFitText`,
 * `TextFrame.WordWrap = False`) between two run lengths of the same glyph
 * sandwiched between fixed anchor characters, isolating the glyph's own
 * advance in points at a 100pt reference size, independent of the text box's
 * own margins. Stored per-1000-em (`advance_pt / 100 * 1000`), so it applies
 * at any font size.
 *
 * `marginLeftPt`/`marginRightPt`/`marginTopPt`/`marginBottomPt` are
 * PowerPoint's OWN default `a:bodyPr` text-frame insets for this font (read
 * back from the measuring shape), in points. `lineHeightRatio` is the font's
 * own line-height-to-font-size multiple, read back from `Shape.Height / 2` of
 * a two-line word-wrapped run (not assumed as a flat 1.2).
 *
 * Split into one small file per font (this barrel plus
 * `font-advance-widths-<font-slug>.generated.ts`) because a combined table
 * over ~2 fonts exceeds the repo's per-file line-count convention once
 * formatted (oxfmt expands a 95-key object literal to one key per line).
 */

import {
	FONT_NAME as aptos_display_NAME,
	TABLE as aptos_display_TABLE,
} from './font-advance-widths-aptos-display.generated';
import {
	FONT_NAME as aptos_NAME,
	TABLE as aptos_TABLE,
} from './font-advance-widths-aptos.generated';
import {
	FONT_NAME as arial_NAME,
	TABLE as arial_TABLE,
} from './font-advance-widths-arial.generated';
import {
	FONT_NAME as calibri_light_NAME,
	TABLE as calibri_light_TABLE,
} from './font-advance-widths-calibri-light.generated';
import {
	FONT_NAME as calibri_NAME,
	TABLE as calibri_TABLE,
} from './font-advance-widths-calibri.generated';
import {
	FONT_NAME as segoe_ui_NAME,
	TABLE as segoe_ui_TABLE,
} from './font-advance-widths-segoe-ui.generated';
import {
	FONT_NAME as times_new_roman_NAME,
	TABLE as times_new_roman_TABLE,
} from './font-advance-widths-times-new-roman.generated';

export interface FontAdvanceTable {
	/** Per-1000-em advance width for ASCII code points 32..126 (space..~). */
	advances: Record<number, number>;
	/** Average per-1000-em advance across every measured glyph in this font. */
	averageAdvance: number;
	marginLeftPt: number;
	marginRightPt: number;
	marginTopPt: number;
	marginBottomPt: number;
	/** Line-height-to-font-size multiple (e.g. 1.2 means a line is 1.2x the font size tall). */
	lineHeightRatio: number;
}

export const FONT_ADVANCE_TABLES: Record<string, FontAdvanceTable> = {
	[calibri_NAME]: calibri_TABLE,
	[calibri_light_NAME]: calibri_light_TABLE,
	[arial_NAME]: arial_TABLE,
	[times_new_roman_NAME]: times_new_roman_TABLE,
	[segoe_ui_NAME]: segoe_ui_TABLE,
	[aptos_NAME]: aptos_TABLE,
	[aptos_display_NAME]: aptos_display_TABLE,
};

/**
 * Generic proportional fallback for a font not in {@link FONT_ADVANCE_TABLES}:
 * the per-glyph AVERAGE across every measured font, so an unknown font still
 * gets a real-metrics-shaped guess instead of a single flat ratio.
 */
export const DEFAULT_FONT_ADVANCE_TABLE: FontAdvanceTable = {
	advances: {
		32: 238,
		33: 301,
		34: 386,
		35: 535,
		36: 529,
		37: 810,
		38: 702,
		39: 210,
		40: 311,
		41: 311,
		42: 453,
		43: 562,
		44: 255,
		45: 341,
		46: 256,
		47: 342,
		48: 529,
		49: 512,
		50: 529,
		51: 529,
		52: 529,
		53: 529,
		54: 529,
		55: 529,
		56: 529,
		57: 529,
		58: 264,
		59: 264,
		60: 560,
		61: 560,
		62: 560,
		63: 485,
		64: 930,
		65: 627,
		66: 602,
		67: 633,
		68: 679,
		69: 557,
		70: 521,
		71: 696,
		72: 688,
		73: 269,
		74: 355,
		75: 594,
		76: 500,
		77: 847,
		78: 702,
		79: 721,
		80: 568,
		81: 724,
		82: 615,
		83: 545,
		84: 537,
		85: 684,
		86: 620,
		87: 919,
		88: 592,
		89: 575,
		90: 542,
		91: 304,
		92: 340,
		93: 304,
		94: 530,
		95: 488,
		96: 377,
		97: 502,
		98: 544,
		99: 472,
		100: 544,
		101: 510,
		102: 296,
		103: 509,
		104: 537,
		105: 237,
		106: 242,
		107: 480,
		108: 245,
		109: 824,
		110: 537,
		111: 542,
		112: 544,
		113: 544,
		114: 339,
		115: 438,
		116: 310,
		117: 538,
		118: 477,
		119: 725,
		120: 461,
		121: 472,
		122: 440,
		123: 335,
		124: 303,
		125: 335,
		126: 557,
	},
	averageAdvance: 500.3,
	marginLeftPt: 7.2,
	marginRightPt: 7.2,
	marginTopPt: 3.6,
	marginBottomPt: 3.6,
	lineHeightRatio: 1.2,
};
