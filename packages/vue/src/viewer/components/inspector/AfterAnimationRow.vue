<script setup lang="ts">
import type { PptxAfterAnimationAction } from 'pptx-viewer-core';
import { AFTER_ANIMATION_VALUES } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

import { injectRecentColors } from '../../composables/recent-colors-context';

defineProps<{
	action: PptxAfterAnimationAction;
	color: string | undefined;
}>();
const emit = defineEmits<{
	action: [action: PptxAfterAnimationAction];
	color: [color: string];
}>();
const { t } = useI18n();
const recentColors = injectRecentColors();

function onActionChange(event: Event): void {
	emit('action', (event.target as HTMLSelectElement).value as PptxAfterAnimationAction);
}
function onColorChange(event: Event): void {
	const hex = (event.target as HTMLInputElement).value;
	emit('color', hex);
	recentColors?.push(hex);
}
</script>

<template>
	<div class="pptx-vue-after-animation">
		<label
			>{{ t('pptx.animation.afterAnimation') }}
			<select
				:aria-label="t('pptx.animation.afterAnimation')"
				:value="action"
				@change="onActionChange"
			>
				<option v-for="value in AFTER_ANIMATION_VALUES" :key="value" :value="value">
					{{ t(`pptx.animation.afterAnimation.${value}`) }}
				</option>
			</select>
		</label>
		<label v-if="action === 'dimToColor'" class="pptx-vue-after-animation-color"
			>{{ t('pptx.animation.afterAnimation.color') }}
			<input
				type="color"
				:aria-label="t('pptx.animation.afterAnimation.color')"
				:value="color ?? '#808080'"
				@change="onColorChange"
			/>
		</label>
	</div>
</template>

<style scoped>
.pptx-vue-after-animation {
	display: grid;
	gap: 6px;
}
.pptx-vue-after-animation-color {
	display: flex;
	align-items: center;
	gap: 6px;
}
.pptx-vue-after-animation-color input[type='color'] {
	width: 40px;
	height: 24px;
	padding: 0;
}
</style>
