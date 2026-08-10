import type {
	PptxElement,
	PptxSmartArtData,
	PptxSmartArtChrome,
	SmartArtLayout,
	SmartArtStyle,
} from 'pptx-viewer-core';
import {
	nodeOpacity as sharedNodeOpacity,
	paletteColour,
	resolvePalette as sharedResolvePalette,
	SMARTART_DEFAULT_PALETTE,
	styleShadow as sharedStyleShadow,
	styleStroke as sharedStyleStroke,
	truncate as sharedTruncate,
} from 'pptx-viewer-shared';
import React from 'react';

// ── Colour scheme palettes ──────────────────────────────────────────────────

export { PALETTES } from 'pptx-viewer-shared';

export const DEFAULT_PALETTE = SMARTART_DEFAULT_PALETTE;

/** Pick a colour from the palette, cycling for any index. */
export function colour(index: number, palette: string[] = DEFAULT_PALETTE): string {
	return paletteColour(index, palette);
}

/** Compute an opacity that fades slightly for later nodes. */
export function nodeOpacity(index: number, total: number, style?: SmartArtStyle): number {
	return sharedNodeOpacity(index, total, style ?? 'flat');
}

/** Get drop shadow filter for style intensity. */
export function styleShadow(style?: SmartArtStyle): string | undefined {
	return sharedStyleShadow(style ?? 'flat');
}

/** Stroke width for node outlines. */
export function styleStroke(style?: SmartArtStyle): number {
	return sharedStyleStroke(style ?? 'flat');
}

/** Truncate text at `max` chars, adding ellipsis when clipped. */
export function truncate(text: string, max: number): string {
	return sharedTruncate(text, max);
}

/** Resolve palette from smartArtData; prefers color-transform fills. */
export function resolvePalette(el: PptxElement): string[] {
	return el.type === 'smartArt' ? sharedResolvePalette(el.smartArtData) : DEFAULT_PALETTE;
}

/** Resolve style from smartArtData. */
export function resolveStyle(el: PptxElement): SmartArtStyle {
	if (el.type !== 'smartArt' || !el.smartArtData) {
		return 'flat';
	}
	return el.smartArtData.style ?? 'flat';
}

/** Resolve palette directly from a PptxSmartArtData object. */
export function resolveSmartArtDataPalette(data: PptxSmartArtData): string[] {
	return sharedResolvePalette(data);
}

// ── Tree helpers for hierarchy ─────────────────────────────────────────────

// Tree shape + builders live in shared: its `buildTree` also understands
// pre-nested `node.children`, which the React copy did not.
export { buildTree, treeDepth, treeWidth } from 'pptx-viewer-shared';
export type { TreeNode } from 'pptx-viewer-shared';

// ── Named layout → category mapping ────────────────────────────────────────

/** Map a named SmartArt layout to a layoutType string for rendering. */
export function layoutToCategory(layout?: SmartArtLayout): string {
	if (!layout) {
		return 'list';
	}
	const map: Record<SmartArtLayout, string> = {
		basicBlockList: 'list',
		alternatingHexagons: 'list',
		basicChevronProcess: 'process',
		basicCycle: 'cycle',
		basicPie: 'cycle',
		basicRadial: 'radial',
		basicVenn: 'venn',
		continuousBlockProcess: 'process',
		convergingRadial: 'radial',
		hierarchy: 'hierarchy',
		horizontalBulletList: 'list',
		linearVenn: 'venn',
		segmentedProcess: 'process',
		stackedList: 'list',
		tableList: 'list',
		trapezoidList: 'list',
		upwardArrow: 'process',
		basicFunnel: 'funnel',
		basicTarget: 'radial',
		interlockingGears: 'radial',
		basicTimeline: 'process',
		basicMatrix: 'matrix',
		basicPyramid: 'pyramid',
		invertedPyramid: 'pyramid',
		bendingProcess: 'process',
		stepDownProcess: 'stepdown',
		alternatingFlow: 'alternatingflow',
		descendingProcess: 'descending',
		pictureAccentList: 'pictureaccent',
		verticalBlockList: 'verticalblock',
		groupedList: 'grouped',
		pyramidList: 'pyramidlist',
		horizontalPictureList: 'horizontalpicture',
		accentProcess: 'accentprocess',
		verticalChevronList: 'verticalchevron',
	};
	return map[layout] ?? 'list';
}

// ── Chrome wrapper ──────────────────────────────────────────────────────────

/** Wrap SmartArt content in a chrome container with background and outline. */
export function withChrome(
	chrome: PptxSmartArtChrome | undefined,
	content: React.ReactNode,
): React.ReactNode {
	if (!chrome) {
		return content;
	}

	const wrapperStyle: React.CSSProperties = {};
	if (chrome.backgroundColor) {
		wrapperStyle.backgroundColor = chrome.backgroundColor;
	}
	if (chrome.outlineColor) {
		wrapperStyle.border = `${chrome.outlineWidth ?? 1}px solid ${chrome.outlineColor}`;
	}

	return (
		<div className='w-full h-full' style={wrapperStyle}>
			{content}
		</div>
	);
}
