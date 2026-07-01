/**
 * Text-warp (WordArt "Transform") inspector-gallery data: the full ordered list
 * of OOXML warp presets with display labels, plus a miniature SVG preview-path
 * generator used to draw each swatch. Framework-free pure data / geometry,
 * consumed by every binding's text-warp gallery (React / Vue / Angular).
 *
 * This is the UI catalogue only; the runtime warp path/CSS-transform builders
 * live in `text-warp.ts`.
 */
import type { PptxTextWarpPreset } from 'pptx-viewer-core';

/** All standard OOXML text warp presets with display labels. */
export const TEXT_WARP_PRESETS: ReadonlyArray<{
	value: PptxTextWarpPreset;
	label: string;
}> = [
	{ value: 'textNoShape', label: 'No Transform' },
	{ value: 'textPlain', label: 'Plain' },
	{ value: 'textArchUp', label: 'Arch Up' },
	{ value: 'textArchDown', label: 'Arch Down' },
	{ value: 'textCircle', label: 'Circle' },
	{ value: 'textButton', label: 'Button' },
	{ value: 'textCurveUp', label: 'Curve Up' },
	{ value: 'textCurveDown', label: 'Curve Down' },
	{ value: 'textCanUp', label: 'Can Up' },
	{ value: 'textCanDown', label: 'Can Down' },
	{ value: 'textWave1', label: 'Wave 1' },
	{ value: 'textWave2', label: 'Wave 2' },
	{ value: 'textWave4', label: 'Wave 4' },
	{ value: 'textDoubleWave1', label: 'Double Wave' },
	{ value: 'textInflate', label: 'Inflate' },
	{ value: 'textDeflate', label: 'Deflate' },
	{ value: 'textInflateBottom', label: 'Inflate Bottom' },
	{ value: 'textInflateTop', label: 'Inflate Top' },
	{ value: 'textDeflateBottom', label: 'Deflate Bottom' },
	{ value: 'textDeflateTop', label: 'Deflate Top' },
	{ value: 'textFadeUp', label: 'Fade Up' },
	{ value: 'textFadeDown', label: 'Fade Down' },
	{ value: 'textFadeLeft', label: 'Fade Left' },
	{ value: 'textFadeRight', label: 'Fade Right' },
	{ value: 'textSlantUp', label: 'Slant Up' },
	{ value: 'textSlantDown', label: 'Slant Down' },
	{ value: 'textCascadeUp', label: 'Cascade Up' },
	{ value: 'textCascadeDown', label: 'Cascade Down' },
	{ value: 'textTriangle', label: 'Triangle' },
	{ value: 'textTriangleInverted', label: 'Triangle Inverted' },
	{ value: 'textChevron', label: 'Chevron' },
	{ value: 'textChevronInverted', label: 'Chevron Inverted' },
	{ value: 'textRingInside', label: 'Ring Inside' },
	{ value: 'textRingOutside', label: 'Ring Outside' },
	{ value: 'textStop', label: 'Stop' },
	{ value: 'textArchUpPour', label: 'Arch Up Pour' },
	{ value: 'textArchDownPour', label: 'Arch Down Pour' },
	{ value: 'textCirclePour', label: 'Circle Pour' },
	{ value: 'textButtonPour', label: 'Button Pour' },
];

/** Miniature SVG preview path for a warp preset (simplified visual hint). */
export function warpPreviewPath(preset: PptxTextWarpPreset): string {
	const w = 40;
	const h = 20;
	switch (preset) {
		case 'textNoShape':
		case 'textPlain':
			return `M 2,${h / 2} L ${w - 2},${h / 2}`;
		case 'textArchUp':
		case 'textArchUpPour':
			return `M 2,${h - 2} A ${w / 2 - 2},${h - 4} 0 0,1 ${w - 2},${h - 2}`;
		case 'textArchDown':
		case 'textArchDownPour':
			return `M 2,2 A ${w / 2 - 2},${h - 4} 0 0,0 ${w - 2},2`;
		case 'textCircle':
		case 'textCirclePour':
			return `M ${w / 2},2 A ${w / 2 - 2},${h / 2 - 2} 0 1,1 ${w / 2},${h - 2} A ${w / 2 - 2},${h / 2 - 2} 0 1,1 ${w / 2},2`;
		case 'textButton':
		case 'textButtonPour':
			return `M 2,${h / 2} Q ${w / 2},2 ${w - 2},${h / 2}`;
		case 'textCurveUp':
			return `M 2,${h - 4} Q ${w / 2},2 ${w - 2},${h - 4}`;
		case 'textCurveDown':
			return `M 2,4 Q ${w / 2},${h - 2} ${w - 2},4`;
		case 'textWave1':
			return `M 2,${h / 2} C ${w / 3},${h / 2 - 6} ${(2 * w) / 3},${h / 2 + 6} ${w - 2},${h / 2}`;
		case 'textWave2':
			return `M 2,${h / 2} C ${w / 3},${h / 2 + 6} ${(2 * w) / 3},${h / 2 - 6} ${w - 2},${h / 2}`;
		case 'textWave4':
		case 'textDoubleWave1':
			return `M 2,${h / 2} C ${w / 4},${h / 2 - 5} ${w / 2},${h / 2 + 5} ${w / 2},${h / 2} C ${w / 2},${h / 2 - 5} ${(3 * w) / 4},${h / 2 + 5} ${w - 2},${h / 2}`;
		case 'textInflate':
		case 'textInflateBottom':
		case 'textInflateTop':
			return `M 2,${h / 2} Q ${w / 2},2 ${w - 2},${h / 2}`;
		case 'textDeflate':
		case 'textDeflateBottom':
		case 'textDeflateTop':
			return `M 2,${h / 2} Q ${w / 2},${h - 2} ${w - 2},${h / 2}`;
		case 'textSlantUp':
			return `M 2,${h - 4} L ${w - 2},4`;
		case 'textSlantDown':
			return `M 2,4 L ${w - 2},${h - 4}`;
		case 'textCascadeUp':
			return `M 2,${h - 4} L ${w - 2},4`;
		case 'textCascadeDown':
			return `M 2,4 L ${w - 2},${h - 4}`;
		case 'textFadeUp':
			return `M ${w / 4},${h - 2} L ${w / 2},2 L ${(3 * w) / 4},${h - 2}`;
		case 'textFadeDown':
			return `M ${w / 4},2 L ${w / 2},${h - 2} L ${(3 * w) / 4},2`;
		case 'textFadeLeft':
			return `M 2,${h / 2} L ${w - 2},2 L ${w - 2},${h - 2} Z`;
		case 'textFadeRight':
			return `M 2,2 L ${w - 2},${h / 2} L 2,${h - 2} Z`;
		case 'textTriangle':
		case 'textTriangleInverted':
			return `M ${w / 2},2 L ${w - 2},${h - 2} L 2,${h - 2} Z`;
		case 'textChevron':
		case 'textChevronInverted':
			return `M 2,2 L ${w / 2},${h - 2} L ${w - 2},2`;
		case 'textRingInside':
		case 'textRingOutside':
			return `M ${w / 2},2 A ${w / 2 - 2},${h / 2 - 2} 0 1,1 ${w / 2},${h - 2} A ${w / 2 - 2},${h / 2 - 2} 0 1,1 ${w / 2},2`;
		case 'textStop':
			return `M ${w * 0.2},2 L ${w * 0.8},2 L ${w - 2},${h * 0.3} L ${w - 2},${h * 0.7} L ${w * 0.8},${h - 2} L ${w * 0.2},${h - 2} L 2,${h * 0.7} L 2,${h * 0.3} Z`;
		case 'textCanUp':
		case 'textCanDown':
			return `M 2,${h - 2} A ${w / 2 - 2},4 0 0,1 ${w - 2},${h - 2}`;
		default:
			return `M 2,${h / 2} L ${w - 2},${h / 2}`;
	}
}
