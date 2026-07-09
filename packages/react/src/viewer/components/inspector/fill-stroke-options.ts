import type React from 'react';

// ---------------------------------------------------------------------------
// Option arrays for fill / stroke properties
//
// NOTE: `label` keeps the English fallback text (existing consumers still
// render `option.label` directly). Each option also carries an `i18nKey`
// pointing at the shared i18n dictionary, matching the `{ value, i18nKey }`
// convention already used elsewhere in this codebase, so a render site can
// switch to `t(option.i18nKey)` without a data-shape change.
// ---------------------------------------------------------------------------

export const COMPOUND_LINE_OPTIONS = [
	{ value: 'sng', label: 'Single', i18nKey: 'pptx.strokeOptions.compoundSingle' },
	{ value: 'dbl', label: 'Double', i18nKey: 'pptx.strokeOptions.compoundDouble' },
	{ value: 'thickThin', label: 'Thick-Thin', i18nKey: 'pptx.strokeOptions.compoundThickThin' },
	{ value: 'thinThick', label: 'Thin-Thick', i18nKey: 'pptx.strokeOptions.compoundThinThick' },
	{ value: 'tri', label: 'Triple', i18nKey: 'pptx.strokeOptions.compoundTriple' },
];

export const LINE_JOIN_OPTIONS = [
	{ value: 'round', label: 'Round', i18nKey: 'pptx.strokeOptions.joinRound' },
	{ value: 'bevel', label: 'Bevel', i18nKey: 'pptx.strokeOptions.joinBevel' },
	{ value: 'miter', label: 'Miter', i18nKey: 'pptx.strokeOptions.joinMiter' },
];

export const LINE_CAP_OPTIONS = [
	{ value: 'flat', label: 'Flat', i18nKey: 'pptx.strokeOptions.capFlat' },
	{ value: 'rnd', label: 'Round', i18nKey: 'pptx.strokeOptions.capRound' },
	{ value: 'sq', label: 'Square', i18nKey: 'pptx.strokeOptions.capSquare' },
];

export const FILL_MODE_OPTIONS = [
	{ value: 'solid', label: 'Solid', i18nKey: 'pptx.fill.solid' },
	{ value: 'gradient', label: 'Gradient', i18nKey: 'pptx.fill.gradient' },
	{ value: 'pattern', label: 'Pattern', i18nKey: 'pptx.table.fillPattern' },
	{ value: 'image', label: 'Image', i18nKey: 'pptx.inspector.image' },
	{ value: 'none', label: 'None', i18nKey: 'pptx.fill.none' },
];

export const PATTERN_PRESET_OPTIONS = [
	{ value: 'pct5', label: '5%', i18nKey: 'pptx.fillPatterns.pct5' },
	{ value: 'pct10', label: '10%', i18nKey: 'pptx.fillPatterns.pct10' },
	{ value: 'pct20', label: '20%', i18nKey: 'pptx.fillPatterns.pct20' },
	{ value: 'pct25', label: '25%', i18nKey: 'pptx.fillPatterns.pct25' },
	{ value: 'pct30', label: '30%', i18nKey: 'pptx.fillPatterns.pct30' },
	{ value: 'pct40', label: '40%', i18nKey: 'pptx.fillPatterns.pct40' },
	{ value: 'pct50', label: '50%', i18nKey: 'pptx.fillPatterns.pct50' },
	{ value: 'pct60', label: '60%', i18nKey: 'pptx.fillPatterns.pct60' },
	{ value: 'pct70', label: '70%', i18nKey: 'pptx.fillPatterns.pct70' },
	{ value: 'pct75', label: '75%', i18nKey: 'pptx.fillPatterns.pct75' },
	{ value: 'pct80', label: '80%', i18nKey: 'pptx.fillPatterns.pct80' },
	{ value: 'pct90', label: '90%', i18nKey: 'pptx.fillPatterns.pct90' },
	{ value: 'horz', label: 'Horizontal', i18nKey: 'pptx.fillPatterns.horizontal' },
	{ value: 'vert', label: 'Vertical', i18nKey: 'pptx.fillPatterns.vertical' },
	{ value: 'ltHorz', label: 'Light Horizontal', i18nKey: 'pptx.fillPatterns.lightHorizontal' },
	{ value: 'ltVert', label: 'Light Vertical', i18nKey: 'pptx.fillPatterns.lightVertical' },
	{ value: 'dkHorz', label: 'Dark Horizontal', i18nKey: 'pptx.fillPatterns.darkHorizontal' },
	{ value: 'dkVert', label: 'Dark Vertical', i18nKey: 'pptx.fillPatterns.darkVertical' },
	{ value: 'narHorz', label: 'Narrow Horizontal', i18nKey: 'pptx.fillPatterns.narrowHorizontal' },
	{ value: 'narVert', label: 'Narrow Vertical', i18nKey: 'pptx.fillPatterns.narrowVertical' },
	{ value: 'wdHorz', label: 'Wide Horizontal', i18nKey: 'pptx.fillPatterns.wideHorizontal' },
	{ value: 'wdVert', label: 'Wide Vertical', i18nKey: 'pptx.fillPatterns.wideVertical' },
	{ value: 'dashHorz', label: 'Dashed Horizontal', i18nKey: 'pptx.fillPatterns.dashedHorizontal' },
	{ value: 'dashVert', label: 'Dashed Vertical', i18nKey: 'pptx.fillPatterns.dashedVertical' },
	{ value: 'cross', label: 'Cross', i18nKey: 'pptx.fillPatterns.cross' },
	{ value: 'dnDiag', label: 'Down Diagonal', i18nKey: 'pptx.fillPatterns.downDiagonal' },
	{ value: 'upDiag', label: 'Up Diagonal', i18nKey: 'pptx.fillPatterns.upDiagonal' },
	{
		value: 'ltDnDiag',
		label: 'Light Down Diagonal',
		i18nKey: 'pptx.fillPatterns.lightDownDiagonal',
	},
	{ value: 'ltUpDiag', label: 'Light Up Diagonal', i18nKey: 'pptx.fillPatterns.lightUpDiagonal' },
	{ value: 'dkDnDiag', label: 'Dark Down Diagonal', i18nKey: 'pptx.fillPatterns.darkDownDiagonal' },
	{ value: 'dkUpDiag', label: 'Dark Up Diagonal', i18nKey: 'pptx.fillPatterns.darkUpDiagonal' },
	{ value: 'wdDnDiag', label: 'Wide Down Diagonal', i18nKey: 'pptx.fillPatterns.wideDownDiagonal' },
	{ value: 'wdUpDiag', label: 'Wide Up Diagonal', i18nKey: 'pptx.fillPatterns.wideUpDiagonal' },
	{
		value: 'dashDnDiag',
		label: 'Dashed Down Diagonal',
		i18nKey: 'pptx.fillPatterns.dashedDownDiagonal',
	},
	{
		value: 'dashUpDiag',
		label: 'Dashed Up Diagonal',
		i18nKey: 'pptx.fillPatterns.dashedUpDiagonal',
	},
	{ value: 'diagCross', label: 'Diagonal Cross', i18nKey: 'pptx.fillPatterns.diagonalCross' },
	{ value: 'smCheck', label: 'Small Check', i18nKey: 'pptx.fillPatterns.smallCheck' },
	{ value: 'lgCheck', label: 'Large Check', i18nKey: 'pptx.fillPatterns.largeCheck' },
	{ value: 'smGrid', label: 'Small Grid', i18nKey: 'pptx.fillPatterns.smallGrid' },
	{ value: 'lgGrid', label: 'Large Grid', i18nKey: 'pptx.fillPatterns.largeGrid' },
	{ value: 'dotGrid', label: 'Dot Grid', i18nKey: 'pptx.fillPatterns.dotGrid' },
	{ value: 'smConfetti', label: 'Small Confetti', i18nKey: 'pptx.fillPatterns.smallConfetti' },
	{ value: 'lgConfetti', label: 'Large Confetti', i18nKey: 'pptx.fillPatterns.largeConfetti' },
	{ value: 'horzBrick', label: 'Horizontal Brick', i18nKey: 'pptx.fillPatterns.horizontalBrick' },
	{ value: 'diagBrick', label: 'Diagonal Brick', i18nKey: 'pptx.fillPatterns.diagonalBrick' },
	{ value: 'solidDmnd', label: 'Solid Diamond', i18nKey: 'pptx.fillPatterns.solidDiamond' },
	{ value: 'openDmnd', label: 'Open Diamond', i18nKey: 'pptx.fillPatterns.openDiamond' },
	{ value: 'dotDmnd', label: 'Dotted Diamond', i18nKey: 'pptx.fillPatterns.dottedDiamond' },
	{ value: 'plaid', label: 'Plaid', i18nKey: 'pptx.fillPatterns.plaid' },
	{ value: 'sphere', label: 'Sphere', i18nKey: 'pptx.fillPatterns.sphere' },
	{ value: 'weave', label: 'Weave', i18nKey: 'pptx.fillPatterns.weave' },
	{ value: 'divot', label: 'Divot', i18nKey: 'pptx.fillPatterns.divot' },
	{ value: 'shingle', label: 'Shingle', i18nKey: 'pptx.fillPatterns.shingle' },
	{ value: 'wave', label: 'Wave', i18nKey: 'pptx.fillPatterns.wave' },
	{ value: 'trellis', label: 'Trellis', i18nKey: 'pptx.fillPatterns.trellis' },
	{ value: 'zigZag', label: 'Zig Zag', i18nKey: 'pptx.fillPatterns.zigZag' },
];

export const GRADIENT_TYPE_OPTIONS = [
	{ value: 'linear', label: 'Linear', i18nKey: 'pptx.gradient.linear' },
	{ value: 'radial', label: 'Radial', i18nKey: 'pptx.gradient.radial' },
];

export const IMAGE_MODE_OPTIONS = [
	{ value: 'stretch', label: 'Stretch', i18nKey: 'pptx.image.stretch' },
	{ value: 'tile', label: 'Tile', i18nKey: 'pptx.image.tile' },
];

/**
 * Generate preview style for compound line types.
 * Shows a horizontal line with the appropriate visual appearance.
 */
export function getCompoundLinePreviewStyle(type: string): React.CSSProperties {
	const baseColor = '#6b7280'; // gray-500

	switch (type) {
		case 'sng':
			return {
				borderTop: `2px solid ${baseColor}`,
				width: '100%',
			};

		case 'dbl': {
			const lineWidth = 2;
			const gap = 2;
			return {
				position: 'relative' as const,
				height: `${lineWidth * 2 + gap}px`,
				width: '100%',
				boxShadow: `inset 0 ${lineWidth + gap}px 0 ${-lineWidth}px ${baseColor}, inset 0 ${-(lineWidth + gap)}px 0 ${-lineWidth}px ${baseColor}`,
			};
		}

		case 'thickThin': {
			const thickWidth = 3;
			const thinWidth = 1;
			const gap = 1;
			return {
				position: 'relative' as const,
				height: `${thickWidth + thinWidth + gap}px`,
				width: '100%',
				boxShadow: `inset 0 ${thickWidth / 2 + gap}px 0 ${-thickWidth}px ${baseColor}, inset 0 ${-(thickWidth / 2 + gap + thinWidth)}px 0 ${-thinWidth}px ${baseColor}`,
			};
		}

		case 'thinThick': {
			const thinWidth = 1;
			const thickWidth = 3;
			const gap = 1;
			return {
				position: 'relative' as const,
				height: `${thinWidth + thickWidth + gap}px`,
				width: '100%',
				boxShadow: `inset 0 ${thickWidth / 2 + gap}px 0 ${-thinWidth}px ${baseColor}, inset 0 ${-(thickWidth / 2 + gap + thinWidth)}px 0 ${-thickWidth}px ${baseColor}`,
			};
		}

		case 'tri': {
			const lineWidth = 1;
			const gap = 1;
			const offset1 = lineWidth + gap;
			const offset2 = (lineWidth + gap) * 2;
			return {
				position: 'relative' as const,
				height: `${lineWidth * 3 + gap * 2}px`,
				width: '100%',
				boxShadow: `inset 0 0 0 ${-lineWidth}px ${baseColor}, inset 0 ${offset1}px 0 ${-lineWidth}px ${baseColor}, inset 0 ${-offset2}px 0 ${-lineWidth}px ${baseColor}`,
			};
		}

		default:
			return {};
	}
}
