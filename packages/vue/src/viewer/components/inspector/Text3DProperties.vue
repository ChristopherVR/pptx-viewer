<script setup lang="ts">
import type { BevelPresetType, MaterialPresetType, Text3DStyle, TextStyle } from 'pptx-viewer-core';
import { MATERIAL_PRESETS, normalizeHexColor } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { emuToPt, ptToEmu } from '../../composables/useTextEffects';
import Text3DBevelSection from './Text3DBevelSection.vue';

/**
 * Text3DProperties: 3D-text (WordArt) authoring UI, mirroring the React
 * `Text3DProperties`. Exposes an extrusion toggle with depth/colour, top and
 * bottom bevels, and a surface material. Widths/heights use EMU<->pt conversion
 * (1pt = 12700 EMU). Emits `update` with a PARTIAL `TextStyle` patch carrying
 * the FULL merged `text3d` sub-object; the parent (`TextPanel`) merges into
 * `textStyle`.
 */
const props = defineProps<{
	ts: TextStyle | undefined;
}>();

const emit = defineEmits<{
	update: [patch: Partial<TextStyle>];
}>();

const { t } = useI18n();

const t3d = computed<Text3DStyle | undefined>(() => props.ts?.text3d);
const hasExtrusion = computed(() =>
	Boolean(t3d.value?.extrusionHeight && t3d.value.extrusionHeight > 0),
);

function update3d(partial: Partial<Text3DStyle>): void {
	const merged: Text3DStyle = { ...props.ts?.text3d, ...partial };
	emit('update', { text3d: merged });
}

function toggleExtrusion(checked: boolean): void {
	if (checked) {
		update3d({ extrusionHeight: ptToEmu(6) });
	} else {
		emit('update', { text3d: undefined });
	}
}

function onDepth(event: Event): void {
	const v = Number((event.target as HTMLInputElement).value);
	if (Number.isFinite(v)) {
		update3d({ extrusionHeight: ptToEmu(Math.max(0, Math.min(100, v))) });
	}
}

function onMaterial(event: Event): void {
	const v = (event.target as HTMLSelectElement).value;
	update3d({ presetMaterial: v ? (v as MaterialPresetType) : undefined });
}

const INPUT_CLS = 'bg-muted border border-border rounded px-2 py-1';
const COLOR_CLS = 'h-8 bg-muted border border-border rounded px-1';
</script>

<template>
	<div class="pptx-vue-text3d mt-2 rounded border border-border bg-card p-2 space-y-2">
		<div class="text-[11px] uppercase tracking-wide text-muted-foreground">
			{{ t('pptx.text3d.title') }}
		</div>

		<!-- Extrusion toggle -->
		<div class="space-y-1.5">
			<label class="inline-flex items-center gap-2 text-foreground">
				<input
					type="checkbox"
					:checked="hasExtrusion"
					@change="toggleExtrusion(($event.target as HTMLInputElement).checked)"
				/>
				{{ t('pptx.text3d.extrusion') }}
			</label>
			<div v-if="hasExtrusion" class="grid grid-cols-2 gap-2 pl-4">
				<label class="flex flex-col gap-1">
					<span class="text-muted-foreground">{{ t('pptx.text3d.depth') }}</span>
					<input
						type="number"
						min="0"
						max="100"
						step="1"
						:class="INPUT_CLS"
						:value="emuToPt(t3d?.extrusionHeight)"
						@input="onDepth"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-muted-foreground">{{ t('pptx.text3d.color') }}</span>
					<input
						type="color"
						:class="COLOR_CLS"
						:value="normalizeHexColor(t3d?.extrusionColor, '#888888')"
						@input="update3d({ extrusionColor: ($event.target as HTMLInputElement).value })"
					/>
				</label>
			</div>
		</div>

		<template v-if="hasExtrusion">
			<Text3DBevelSection
				:label="t('pptx.text3d.topBevel')"
				:bevel-type="t3d?.bevelTopType"
				:bevel-width="t3d?.bevelTopWidth"
				:bevel-height="t3d?.bevelTopHeight"
				@type-change="(v: BevelPresetType) => update3d({ bevelTopType: v || undefined })"
				@width-change="(v: number) => update3d({ bevelTopWidth: ptToEmu(v) })"
				@height-change="(v: number) => update3d({ bevelTopHeight: ptToEmu(v) })"
			/>
			<Text3DBevelSection
				:label="t('pptx.text3d.bottomBevel')"
				:bevel-type="t3d?.bevelBottomType"
				:bevel-width="t3d?.bevelBottomWidth"
				:bevel-height="t3d?.bevelBottomHeight"
				@type-change="(v: BevelPresetType) => update3d({ bevelBottomType: v || undefined })"
				@width-change="(v: number) => update3d({ bevelBottomWidth: ptToEmu(v) })"
				@height-change="(v: number) => update3d({ bevelBottomHeight: ptToEmu(v) })"
			/>

			<label class="flex flex-col gap-1 pl-4">
				<span class="text-muted-foreground">{{ t('pptx.text3d.material') }}</span>
				<select :class="INPUT_CLS" :value="t3d?.presetMaterial ?? ''" @change="onMaterial">
					<option v-for="opt in MATERIAL_PRESETS" :key="opt.value" :value="opt.value">
						{{ opt.label }}
					</option>
				</select>
			</label>
		</template>
	</div>
</template>
