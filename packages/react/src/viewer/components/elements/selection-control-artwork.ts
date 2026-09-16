import { getSelectionControlArtworkStyle, getSelectionOutlineColor } from 'pptx-viewer-shared';
import type { CSSProperties } from 'react';

const appearance = { fill: 'var(--color-primary)', borderColor: '#ffffff' };
const cornerSize = 'var(--pptx-react-corner-default, 12px)';
const edgeLength = 'var(--pptx-react-edge-length-default, 20px)';
const edgeThickness = 'var(--pptx-react-edge-thickness-default, 8px)';
const rotateSize = 'var(--pptx-react-rotate-default, 20px)';

// These local defaults preserve the binding's existing max-md artwork sizes.
export const RESIZE_DEFAULT_CLASSES =
	'[--pptx-react-corner-default:12px] max-md:[--pptx-react-corner-default:22px] [--pptx-react-edge-length-default:20px] max-md:[--pptx-react-edge-length-default:32px] [--pptx-react-edge-thickness-default:8px] max-md:[--pptx-react-edge-thickness-default:12px]';
export const ROTATE_DEFAULT_CLASSES =
	'[--pptx-react-rotate-default:20px] max-md:[--pptx-react-rotate-default:28px]';

export const RESIZE_ARTWORK = {
	corner: getSelectionControlArtworkStyle('corner', {
		...appearance,
		width: cornerSize,
		height: cornerSize,
		radius: '9999px',
	}),
	horizontal: getSelectionControlArtworkStyle('horizontal-edge', {
		...appearance,
		width: edgeLength,
		height: edgeThickness,
		radius: 'var(--radius-sm, 0.25rem)',
	}),
	vertical: getSelectionControlArtworkStyle('vertical-edge', {
		...appearance,
		width: edgeThickness,
		height: edgeLength,
		radius: 'var(--radius-sm, 0.25rem)',
	}),
};
export const ROTATE_ARTWORK = getSelectionControlArtworkStyle('rotate', {
	...appearance,
	width: rotateSize,
	height: rotateSize,
	radius: '9999px',
	foreground: '#ffffff',
});

export function selectionOutlineStyle(color: 'blue-400' | 'blue-500'): CSSProperties {
	const outlineColor = getSelectionOutlineColor(`var(--color-${color})`);
	return {
		outlineColor,
		'--tw-ring-color': `color-mix(in oklab, ${outlineColor} 50%, transparent)`,
	} as CSSProperties;
}
