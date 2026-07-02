<script setup lang="ts">
import type { PptxElement } from 'pptx-viewer-core';
import { ACTION_BUTTON_PRESETS } from 'pptx-viewer-shared';
import { computed } from 'vue';

/**
 * ActionButtonGlyphOverlay: draws the inner glyph (home, help, sound, movie,
 * info, arrows, etc.) centred on an `actionButton*` shape. Vue port of the
 * React `elements/ActionButtonGlyphOverlay.tsx`.
 *
 * Without this, all 14 OOXML action-button presets render as identical rounded
 * rectangles: the spec leaves the glyph to the renderer. The 24x24 icon paths
 * come from the shared `ACTION_BUTTON_PRESETS` so the slide renderer and the
 * ribbon's "Insert Action Button" picker stay in sync.
 */
const props = defineProps<{
	element: PptxElement;
	/** Override the glyph stroke colour. Defaults to the shape's text colour or white. */
	color?: string;
}>();

const GLYPH_BY_SHAPE: Record<string, string | undefined> = Object.fromEntries(
	ACTION_BUTTON_PRESETS.map((p) => [p.shapeType, p.iconPath]),
);
// PowerPoint aliases the "OrNext"/"OrPrevious" variants to the same glyphs.
GLYPH_BY_SHAPE['actionButtonForwardOrNext'] = GLYPH_BY_SHAPE['actionButtonForwardNext'];
GLYPH_BY_SHAPE['actionButtonBackOrPrevious'] = GLYPH_BY_SHAPE['actionButtonBackPrevious'];

const glyphPath = computed<string | undefined>(() => {
	const shapeType =
		'shapeType' in props.element ? (props.element as { shapeType?: string }).shapeType : undefined;
	if (!shapeType) {
		return undefined;
	}
	const path = GLYPH_BY_SHAPE[shapeType];
	return path && path.length > 0 ? path : undefined;
});

const stroke = computed<string>(() => {
	if (props.color) {
		return props.color;
	}
	const textColor =
		'textStyle' in props.element
			? (props.element as { textStyle?: { color?: string } }).textStyle?.color
			: undefined;
	return textColor || '#ffffff';
});
</script>

<template>
	<svg
		v-if="glyphPath"
		viewBox="0 0 24 24"
		width="100%"
		height="100%"
		preserveAspectRatio="xMidYMid meet"
		aria-hidden="true"
		style="position: absolute; inset: 0; pointer-events: none; padding: 20%"
	>
		<path
			:d="glyphPath"
			fill="none"
			:stroke="stroke"
			:stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
</template>
