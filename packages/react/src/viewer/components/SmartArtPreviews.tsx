import type { SmartArtLayout, SmartArtPptxElement } from 'pptx-viewer-core';
import { buildSmartArtPresetData, PRESETS } from 'pptx-viewer-shared';
import React from 'react';

import { SmartArtRenderer } from './elements/SmartArtRenderer';

// ── Live gallery previews ────────────────────────────────────────────────────
//
// Each preview is the real SmartArtRenderer output for the exact element the
// preset inserts (same layout, default items, colour scheme, and style),
// scaled down to gallery size, so the preview always matches the chart that
// appears on the slide.

/** Element size the insert handler creates; previews render the same box. */
const PREVIEW_ELEMENT_WIDTH = 600;
const PREVIEW_ELEMENT_HEIGHT = 340;
/** Gallery tile width in px (the dialog's `w-16` container). */
const PREVIEW_TILE_WIDTH = 64;

const FALLBACK_ITEMS = ['1', '2', '3'];

function buildPreviewElement(layout: SmartArtLayout): SmartArtPptxElement {
	const preset = PRESETS.find((p) => p.layout === layout);
	return {
		id: `smartart-preview-${layout}`,
		type: 'smartArt',
		x: 0,
		y: 0,
		width: PREVIEW_ELEMENT_WIDTH,
		height: PREVIEW_ELEMENT_HEIGHT,
		smartArtData: buildSmartArtPresetData(layout, preset?.defaultItems ?? FALLBACK_ITEMS),
	} as SmartArtPptxElement;
}

// ── Resolver ─────────────────────────────────────────────────────────────────

export function getPreviewForLayout(layout: SmartArtLayout): React.ReactElement {
	const scale = PREVIEW_TILE_WIDTH / PREVIEW_ELEMENT_WIDTH;
	return (
		<div
			aria-hidden
			className='overflow-hidden pointer-events-none'
			style={{
				width: PREVIEW_TILE_WIDTH,
				height: Math.round(PREVIEW_ELEMENT_HEIGHT * scale),
			}}
		>
			<div
				style={{
					width: PREVIEW_ELEMENT_WIDTH,
					height: PREVIEW_ELEMENT_HEIGHT,
					transform: `scale(${scale})`,
					transformOrigin: 'top left',
				}}
			>
				<SmartArtRenderer element={buildPreviewElement(layout)} />
			</div>
		</div>
	);
}
