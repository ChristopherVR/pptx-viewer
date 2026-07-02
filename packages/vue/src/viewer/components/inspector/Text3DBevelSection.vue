<script setup lang="ts">
import type { BevelPresetType } from 'pptx-viewer-core';
import { BEVEL_PRESETS } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

import { clamp, emuToPt } from '../../composables/useTextEffects';

/**
 * Text3DBevelSection: one bevel editor (type / width / height), reused for the
 * top and bottom bevels of `Text3DProperties`. Widths and heights are shown in
 * points and emitted in points; the parent converts to EMU. Mirrors the React
 * `BevelSection` sub-component.
 */
const props = defineProps<{
	label: string;
	bevelType: BevelPresetType | undefined;
	bevelWidth: number | undefined;
	bevelHeight: number | undefined;
}>();

const emit = defineEmits<{
	typeChange: [value: BevelPresetType];
	widthChange: [value: number];
	heightChange: [value: number];
}>();

const { t } = useI18n();

const INPUT_CLS = 'bg-muted border border-border rounded px-2 py-1';

function onType(event: Event): void {
	emit('typeChange', (event.target as HTMLSelectElement).value as BevelPresetType);
}
function onWidth(event: Event): void {
	const v = Number((event.target as HTMLInputElement).value);
	if (Number.isFinite(v)) {
		emit('widthChange', clamp(v, 0, 50));
	}
}
function onHeight(event: Event): void {
	const v = Number((event.target as HTMLInputElement).value);
	if (Number.isFinite(v)) {
		emit('heightChange', clamp(v, 0, 50));
	}
}
</script>

<template>
	<div class="pptx-vue-text3d-bevel space-y-1 pl-4">
		<span class="text-[11px] text-muted-foreground">{{ props.label }}</span>
		<div class="grid grid-cols-3 gap-2">
			<label class="flex flex-col gap-1">
				<span class="text-muted-foreground">{{ t('pptx.text3d.type') }}</span>
				<select :class="INPUT_CLS" :value="props.bevelType ?? 'none'" @change="onType">
					<option v-for="opt in BEVEL_PRESETS" :key="opt.value" :value="opt.value">
						{{ opt.label }}
					</option>
				</select>
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-muted-foreground">{{ t('pptx.text3d.width') }}</span>
				<input
					type="number"
					min="0"
					max="50"
					step="1"
					:class="INPUT_CLS"
					:value="emuToPt(props.bevelWidth)"
					@input="onWidth"
				/>
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-muted-foreground">{{ t('pptx.text3d.height') }}</span>
				<input
					type="number"
					min="0"
					max="50"
					step="1"
					:class="INPUT_CLS"
					:value="emuToPt(props.bevelHeight)"
					@input="onHeight"
				/>
			</label>
		</div>
	</div>
</template>
