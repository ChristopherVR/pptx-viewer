<script setup lang="ts">
import { Play } from 'lucide-vue-next';
import { EFFECT_SOUND_CATALOGUE, getEffectSoundAsset } from 'pptx-viewer-shared';
import type { EffectSoundState } from 'pptx-viewer-shared';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { playAnimationSound } from '../../composables/animation-sound';

const NONE_VALUE = 'none';
const CURRENT_VALUE = 'current';
const OTHER_VALUE = 'other';

const props = defineProps<{
	soundState: EffectSoundState;
}>();
const emit = defineEmits<{
	pick: [pick: { dataUrl: string; fileName?: string } | undefined];
	pickStock: [catalogueId: string];
}>();
const { t } = useI18n();

const fileInput = ref<HTMLInputElement | null>(null);

function selectedValue(): string {
	return props.soundState.catalogueId ?? (props.soundState.hasSound ? CURRENT_VALUE : NONE_VALUE);
}

function onSelectChange(event: Event): void {
	const value = (event.target as HTMLSelectElement).value;
	if (value === OTHER_VALUE) {
		fileInput.value?.click();
		return;
	}
	if (value === NONE_VALUE) {
		emit('pick', undefined);
		return;
	}
	if (value === CURRENT_VALUE) {
		return;
	}
	emit('pickStock', value);
}

function onFileChange(event: Event): void {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];
	input.value = '';
	if (!file) {
		return;
	}
	const reader = new FileReader();
	reader.onload = () => {
		if (typeof reader.result === 'string') {
			emit('pick', { dataUrl: reader.result, fileName: file.name });
		}
	};
	reader.readAsDataURL(file);
}

function onPreview(): void {
	if (!props.soundState.catalogueId) {
		return;
	}
	const asset = getEffectSoundAsset(props.soundState.catalogueId);
	if (asset) {
		playAnimationSound(asset.dataUrl);
	}
}
</script>

<template>
	<label
		>{{ t('pptx.animation.sound') }}
		<div class="pptx-vue-sound-row">
			<select
				:aria-label="t('pptx.animation.sound')"
				:value="selectedValue()"
				@change="onSelectChange"
			>
				<option :value="NONE_VALUE">{{ t('pptx.animation.sound.none') }}</option>
				<option v-if="soundState.hasSound && !soundState.catalogueId" :value="CURRENT_VALUE">
					{{ soundState.fileName ?? t('pptx.animation.sound.custom') }}
				</option>
				<option v-for="entry in EFFECT_SOUND_CATALOGUE" :key="entry.id" :value="entry.id">
					{{ t(entry.i18nKey) }}
				</option>
				<option :value="OTHER_VALUE">{{ t('pptx.animation.sound.other') }}</option>
			</select>
			<button
				type="button"
				:aria-label="t('pptx.animation.sound.preview')"
				:disabled="!soundState.catalogueId"
				class="pptx-vue-sound-preview"
				@click="onPreview"
			>
				<Play :size="12" />
			</button>
		</div>
		<input
			ref="fileInput"
			type="file"
			accept="audio/*"
			:aria-label="t('pptx.animation.sound.chooseFile')"
			class="pptx-vue-hidden-file-input"
			tabindex="-1"
			@change="onFileChange"
		/>
	</label>
</template>

<style scoped>
.pptx-vue-hidden-file-input {
	display: none;
}
.pptx-vue-sound-row {
	display: flex;
	align-items: center;
	gap: 4px;
}
.pptx-vue-sound-preview {
	flex-shrink: 0;
}
.pptx-vue-sound-preview:disabled {
	opacity: 0.4;
}
</style>
