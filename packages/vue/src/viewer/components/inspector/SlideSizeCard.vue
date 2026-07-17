<script setup lang="ts">
/**
 * SlideSizeCard: SLIDE SIZE card (W / H pixel inputs), mirroring React's
 * `SlideSizeCard` in `inspector/PresentationSettingsCards.tsx`.
 */
import { useI18n } from 'vue-i18n';

import type { CanvasSize } from '../../types';
import { CARD, HEADING, INPUT } from './inspector-cards';

const props = withDefaults(
	defineProps<{
		canvasSize: CanvasSize;
		canEdit?: boolean;
	}>(),
	{ canEdit: true },
);

const emit = defineEmits<{ update: [size: CanvasSize] }>();

const { t } = useI18n();

const FIELDS = [
	['W', 'width'],
	['H', 'height'],
] as const;

function onFieldInput(key: 'width' | 'height', event: Event): void {
	const value = Number((event.target as HTMLInputElement).value);
	if (!Number.isFinite(value)) {
		return;
	}
	emit('update', { ...props.canvasSize, [key]: value });
}
</script>

<template>
	<div :class="CARD">
		<div :class="HEADING">{{ t('pptx.slideSize.title') }}</div>
		<div class="grid grid-cols-2 gap-1.5 text-[11px]">
			<label v-for="[label, key] in FIELDS" :key="key" class="flex items-center gap-1">
				<span class="text-muted-foreground">{{ label }}</span>
				<input
					type="number"
					:class="INPUT"
					:disabled="!props.canEdit"
					:value="props.canvasSize[key]"
					@input="(e) => onFieldInput(key, e)"
				/>
			</label>
		</div>
	</div>
</template>
