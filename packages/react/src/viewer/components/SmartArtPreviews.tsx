import type { SmartArtLayout } from 'pptx-viewer-core';
import {
	buildSmartArtPreviewElement,
	SMARTART_PREVIEW_ELEMENT_HEIGHT,
	SMARTART_PREVIEW_ELEMENT_WIDTH,
} from 'pptx-viewer-shared';
import React from 'react';

import { SmartArtRenderer } from './elements/SmartArtRenderer';

// ── Live gallery previews ────────────────────────────────────────────────────
//
// Each preview is the real SmartArtRenderer output for the exact element the
// preset inserts (same layout, default items, colour scheme, and style),
// scaled down to gallery size, so the preview always matches the chart that
// appears on the slide. The element itself (box + preset node data) comes
// from the shared `buildSmartArtPreviewElement` (render/preview-elements.ts),
// which React, Vue, Angular, and Vanilla all used to hand-roll identically.

/** Gallery tile width in px (the dialog's `w-16` container). */
const PREVIEW_TILE_WIDTH = 64;

// ── Resolver ─────────────────────────────────────────────────────────────────

export function getPreviewForLayout(layout: SmartArtLayout): React.ReactElement {
	const scale = PREVIEW_TILE_WIDTH / SMARTART_PREVIEW_ELEMENT_WIDTH;
	return (
		<div
			aria-hidden
			className='overflow-hidden pointer-events-none'
			style={{
				width: PREVIEW_TILE_WIDTH,
				height: Math.round(SMARTART_PREVIEW_ELEMENT_HEIGHT * scale),
			}}
		>
			<div
				style={{
					width: SMARTART_PREVIEW_ELEMENT_WIDTH,
					height: SMARTART_PREVIEW_ELEMENT_HEIGHT,
					transform: `scale(${scale})`,
					transformOrigin: 'top left',
				}}
			>
				<SmartArtRenderer element={buildSmartArtPreviewElement(layout)} />
			</div>
		</div>
	);
}
