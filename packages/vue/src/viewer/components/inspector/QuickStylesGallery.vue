<script setup lang="ts">
import type { ShapeStyle } from 'pptx-viewer-core';
import { SHAPE_QUICK_STYLES } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

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
				class="pptx-vue-quickstyles-swatch h-7 w-full rounded border border-border hover:border-primary transition-colors"
				:style="{
					background: swatchBackground(qs.style),
					boxShadow: swatchBoxShadow(qs.style),
					border: swatchBorder(qs.style),
				}"
				@click="$emit('select', qs.style)"
			/>
		</div>
	</div>
</template>
