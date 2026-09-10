<script setup lang="ts">
import type { ShapeStyle } from 'pptx-viewer-core';
import { getDensePanelTouchTargetPx, SHAPE_QUICK_STYLES } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useIsMobile } from '../../composables/useIsMobile';

/**
 * QuickStylesGallery: a 6-column swatch grid over the shared
 * `SHAPE_QUICK_STYLES` presets (PowerPoint-inspired Shape Styles gallery).
 *
 * Clicking a swatch emits `select` with that preset's `Partial<ShapeStyle>`.
 * The parent (`EffectsPanel`) owns the current `shapeStyle` and merges the
 * preset onto it, then forwards the FULL merged sub-object via its own
 * `update` patch, so this component stays pure presentation.
 */
defineEmits<{
	select: [style: Partial<ShapeStyle>];
}>();

const { t } = useI18n();
// Each preset is a dense-gallery swatch but, unlike a colour swatch, a
// discrete individually-named action button, so it gets the shared WCAG
// touch-target decision below the mobile breakpoint rather than an
// exemption (CLAUDE.md Rule 2: never hand-duplicate the threshold here).
const { viewportWidth } = useIsMobile();
const swatchMinHeight = computed(() => `${getDensePanelTouchTargetPx(viewportWidth.value)}px`);

function swatchBackground(style: Partial<ShapeStyle>): string {
	return style.fillGradient || style.fillColor || 'transparent';
}

function swatchBoxShadow(style: Partial<ShapeStyle>): string | undefined {
	if (!style.shadowColor) {
		return undefined;
	}
	const x = style.shadowOffsetX ?? 2;
	const y = style.shadowOffsetY ?? 2;
	const blur = style.shadowBlur ?? 4;
	return `${x}px ${y}px ${blur}px ${style.shadowColor}`;
}

function swatchBorder(style: Partial<ShapeStyle>): string | undefined {
	if (!style.strokeColor) {
		return undefined;
	}
	return `${style.strokeWidth ?? 1}px solid ${style.strokeColor}`;
}
</script>

<template>
	<div class="pptx-vue-quickstyles flex flex-col gap-1">
		<span class="pptx-vue-quickstyles-label text-muted-foreground">{{
			t('pptx.shape.quickStyles')
		}}</span>
		<div class="pptx-vue-quickstyles-grid grid grid-cols-6 gap-1">
			<button
				v-for="(qs, idx) in SHAPE_QUICK_STYLES"
				:key="idx"
				type="button"
				:title="qs.name"
				:aria-label="qs.name"
				class="pptx-vue-quickstyles-swatch w-full rounded border border-border hover:border-primary transition-colors"
				:style="{
					background: swatchBackground(qs.style),
					boxShadow: swatchBoxShadow(qs.style),
					border: swatchBorder(qs.style),
					minHeight: swatchMinHeight,
				}"
				@click="$emit('select', qs.style)"
			/>
		</div>
	</div>
</template>
