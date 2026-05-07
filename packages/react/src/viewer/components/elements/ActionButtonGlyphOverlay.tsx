/**
 * Renders the inner glyph (home, help, sound, movie, info, etc.) on top of an
 * `actionButton*` shape. Without this, all 14 OOXML action-button presets render
 * as identical rounded rectangles because their geometry is intentionally just
 * a rounded rect — the spec leaves the glyph to the renderer.
 *
 * The icon SVG paths come from {@link ACTION_BUTTON_PRESETS} so the slide
 * renderer and the toolbar's "Insert Action Button" picker stay in sync.
 *
 * @module ActionButtonGlyphOverlay
 */

import type { PptxElement } from 'pptx-viewer-core';
import React from 'react';

import { ACTION_BUTTON_PRESETS } from '../../constants/action-buttons';

const GLYPH_BY_SHAPE: Record<string, string | undefined> = Object.fromEntries(
	ACTION_BUTTON_PRESETS.map((p) => [p.shapeType, p.iconPath]),
);

// PowerPoint maps "ForwardOrNext"/"BackOrPrevious" to the same glyph as the
// non-Or variants; alias the iconPath so both shapeTypes render identically.
GLYPH_BY_SHAPE['actionButtonForwardOrNext'] = GLYPH_BY_SHAPE['actionButtonForwardNext'];
GLYPH_BY_SHAPE['actionButtonBackOrPrevious'] = GLYPH_BY_SHAPE['actionButtonBackPrevious'];

/** True when an element is one of the 14 OOXML built-in action-button shapes. */
export function isActionButtonShape(shapeType: string | undefined): boolean {
	return Boolean(shapeType && shapeType in GLYPH_BY_SHAPE);
}

/**
 * Get the SVG path data string for an action button's glyph, or `undefined`
 * if the shape is not an action button (or is `actionButtonBlank`).
 */
export function getActionButtonGlyphPath(shapeType: string | undefined): string | undefined {
	if (!shapeType) {
		return undefined;
	}
	const path = GLYPH_BY_SHAPE[shapeType];
	return path && path.length > 0 ? path : undefined;
}

interface ActionButtonGlyphOverlayProps {
	element: PptxElement;
	/** Override the glyph stroke colour. Defaults to the shape's text colour or white. */
	color?: string;
}

/**
 * Overlays the action-button glyph centred on the shape. The icon paths use a
 * 24x24 logical viewBox (matching the toolbar picker) and are scaled to fit
 * the shape's smaller dimension at ~50% so the glyph reads at small sizes.
 */
export function ActionButtonGlyphOverlay({
	element,
	color,
}: ActionButtonGlyphOverlayProps): React.ReactNode {
	const shapeType =
		'shapeType' in element ? (element as { shapeType?: string }).shapeType : undefined;
	const path = getActionButtonGlyphPath(shapeType);
	if (!path) {
		return null;
	}
	// Resolve glyph colour: explicit prop > element text colour > white (action
	// buttons typically render with a coloured fill so white reads well by default).
	const stroke =
		color ??
		(('textStyle' in element && (element as { textStyle?: { color?: string } }).textStyle?.color) ||
			'#ffffff');

	return (
		<svg
			viewBox='0 0 24 24'
			width='100%'
			height='100%'
			preserveAspectRatio='xMidYMid meet'
			style={{
				position: 'absolute',
				inset: 0,
				pointerEvents: 'none',
				padding: '20%',
			}}
			aria-hidden='true'
		>
			<path
				d={path}
				fill='none'
				stroke={stroke}
				strokeWidth={2}
				strokeLinecap='round'
				strokeLinejoin='round'
			/>
		</svg>
	);
}
