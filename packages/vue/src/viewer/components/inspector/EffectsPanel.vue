<script setup lang="ts">
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import EffectsGlowReflectionSection from './EffectsGlowReflectionSection.vue';
import EffectsShadowSection from './EffectsShadowSection.vue';
import QuickStylesGallery from './QuickStylesGallery.vue';

/**
 * EffectsPanel: element opacity plus every shape visual effect PowerPoint's
 * Format Shape > Effects pane exposes: outer shadow, inner shadow, glow, soft
 * edge, and reflection.
 *
 * Every effect's state extraction AND patch-building comes from shared's
 * `effects-helpers.ts` / `effects-shadow-helpers.ts` (`effectsStateOf`,
 * `enable*Patch`/`disable*Patch`/`update*Patch`), the same pure decision
 * functions Angular's `effects-panel.component.ts` already consumes. This
 * component itself only owns opacity (the one field that is NOT part of
 * `shapeStyle`) and the shape-like gate; the shadow and glow/reflection/soft-edge
 * controls live in {@link EffectsShadowSection} / {@link
 * EffectsGlowReflectionSection}, split out to keep every file under this
 * repo's 300-LOC budget. Both children re-emit the same `update` patch shape,
 * so this file forwards them untouched.
 *
 * Shadow/glow/reflection/soft-edge controls only apply to shape-like elements
 * (core `hasShapeProperties`). For other elements a muted note is shown.
 */
const props = defineProps<{
	element: PptxElement;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const { t } = useI18n();

const isShapeLike = computed(() => hasShapeProperties(props.element));

/**
 * Apply a Quick Styles gallery preset (a `Partial<ShapeStyle>` of unrelated
 * fields, e.g. fill/outline) on top of the CURRENT shapeStyle. Unlike the
 * shadow/glow/reflection/soft-edge sections, a preset is not itself a shared
 * decision function, just a plain merge, so it stays local.
 */
function onQuickStyleSelect(preset: Partial<ShapeStyle>): void {
	const base: ShapeStyle = hasShapeProperties(props.element)
		? (props.element.shapeStyle ?? {})
		: {};
	emit('update', { shapeStyle: { ...base, ...preset } } as Partial<PptxElement>);
}

// ---------------------------------------------------------------------------
// Opacity (element-level, shallow patch)
// ---------------------------------------------------------------------------

const opacityPercent = computed(() => Math.round((props.element.opacity ?? 1) * 100));

function onOpacity(value: string): void {
	const n = Number(value);
	if (!Number.isFinite(n)) {
		return;
	}
	emit('update', { opacity: Math.max(0, Math.min(100, n)) / 100 });
}
</script>

<template>
	<div class="pptx-vue-effects flex flex-col gap-3 text-xs">
		<label class="pptx-vue-effects-field flex flex-col gap-1">
			<span class="pptx-vue-effects-label text-muted-foreground">{{
				t('pptx.effects.opacityPercent', { value: opacityPercent })
			}}</span>
			<input
				type="range"
				class="pptx-vue-effects-range w-full accent-primary"
				min="0"
				max="100"
				:value="opacityPercent"
				@input="onOpacity(($event.target as HTMLInputElement).value)"
			/>
		</label>

		<template v-if="isShapeLike">
			<QuickStylesGallery @select="onQuickStyleSelect" />
			<EffectsShadowSection :element="element" @update="(patch) => emit('update', patch)" />
			<EffectsGlowReflectionSection :element="element" @update="(patch) => emit('update', patch)" />
		</template>

		<p v-else class="pptx-vue-effects-note text-muted-foreground italic">
			{{ t('pptx.effects.shapeOnlyNote') }}
		</p>
	</div>
</template>
