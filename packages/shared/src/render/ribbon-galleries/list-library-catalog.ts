/**
 * PowerPoint's Bullet Library and Numbering Library (Home > Bullets /
 * Numbering drop-downs).
 *
 * Ground truth: `scripts/capture-effects-gallery-com.ps1` (slide 4) sets
 * `ParagraphFormat.Bullet.Type` / `.Font.Name` / `.Character` and
 * `.Bullet.Style` through COM and saves; the `a:buFont` (typeface, panose,
 * pitchFamily, charset) and `a:buChar` / `a:buAutoNum` below are that
 * capture. `preview` is only the tile's stand-in glyph, since a browser has
 * no Wingdings.
 *
 * @module render/ribbon-galleries/list-library-catalog
 */

export interface BulletFontSpec {
	typeface: string;
	panose: string;
	pitchFamily: number;
	charset: number;
}

const ARIAL: BulletFontSpec = {
	typeface: 'Arial',
	panose: '020B0604020202020204',
	pitchFamily: 34,
	charset: 0,
};
const COURIER_NEW: BulletFontSpec = {
	typeface: 'Courier New',
	panose: '02070309020205020404',
	pitchFamily: 49,
	charset: 0,
};
const WINGDINGS: BulletFontSpec = {
	typeface: 'Wingdings',
	panose: '05000000000000000000',
	pitchFamily: 2,
	charset: 2,
};

export interface BulletLibrarySpec {
	key: string;
	label: string;
	char: string;
	font: BulletFontSpec;
	preview: string;
}

export const BULLET_LIBRARY: readonly BulletLibrarySpec[] = [
	{ key: 'filledRound', label: 'Filled Round Bullets', char: '•', font: ARIAL, preview: '•' },
	{ key: 'hollowRound', label: 'Hollow Round Bullets', char: 'o', font: COURIER_NEW, preview: 'o' },
	{
		key: 'filledSquare',
		label: 'Filled Square Bullets',
		char: '§',
		font: WINGDINGS,
		preview: '▪',
	},
	{
		key: 'hollowSquare',
		label: 'Hollow Square Bullets',
		char: 'q',
		font: WINGDINGS,
		preview: '❑',
	},
	{ key: 'star', label: 'Star Bullets', char: 'v', font: WINGDINGS, preview: '❖' },
	{ key: 'arrow', label: 'Arrow Bullets', char: 'Ø', font: WINGDINGS, preview: '➢' },
	{ key: 'checkmark', label: 'Checkmark Bullets', char: 'ü', font: WINGDINGS, preview: '✔' },
];

export const NUMBERING_LIBRARY: ReadonlyArray<{ type: string; label: string }> = [
	{ type: 'arabicPeriod', label: '1. 2. 3.' },
	{ type: 'arabicParenR', label: '1) 2) 3)' },
	{ type: 'romanUcPeriod', label: 'I. II. III.' },
	{ type: 'alphaUcPeriod', label: 'A. B. C.' },
	{ type: 'alphaLcParenR', label: 'a) b) c)' },
	{ type: 'alphaLcPeriod', label: 'a. b. c.' },
	{ type: 'romanLcPeriod', label: 'i. ii. iii.' },
];
