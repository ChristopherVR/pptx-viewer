<script setup lang="ts">
import type { EffectSoundState } from 'pptx-viewer-shared';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

defineProps<{
	soundState: EffectSoundState;
}>();
const emit = defineEmits<{
	pick: [pick: { dataUrl: string; fileName?: string } | undefined];
}>();
const { t } = useI18n();

const fileInput = ref<HTMLInputElement | null>(null);

function onSelectChange(event: Event): void {
	const value = (event.target as HTMLSelectElement).value;
	if (value === 'custom') {
		fileInput.value?.click();
		return;
	}
	emit('pick', undefined);
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
</script>

<template>
	<label
		>{{ t('pptx.animation.sound') }}
		<select
			:aria-label="t('pptx.animation.sound')"
			:value="soundState.hasSound ? 'custom' : 'none'"
			@change="onSelectChange"
		>
			<option value="none">{{ t('pptx.animation.sound.none') }}</option>
			<option value="custom">
				{{
					soundState.hasSound && soundState.fileName
						? soundState.fileName
						: t('pptx.animation.sound.custom')
				}}
			</option>
		</select>
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
</style>
