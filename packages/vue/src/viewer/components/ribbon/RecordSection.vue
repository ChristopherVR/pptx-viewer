<script setup lang="ts">
import { CircleHelp, Eraser, Play, RotateCcw, Video } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import { ic, pill, SEP } from './ribbon-constants';

const props = defineProps<{
	onRecordFromBeginning: () => void;
	onRecordFromCurrent: () => void;
}>();

const { t } = useI18n();
</script>

<template>
	<button type="button" :class="pill" disabled>
		<span class="h-3 w-3 rounded-full border border-current" aria-hidden="true" />
		{{ t('pptx.record.cameo') }}
	</button>
	<div :class="SEP" />
	<button type="button" :class="pill" @click="props.onRecordFromBeginning()">
		<Video :class="ic" />
		{{ t('pptx.slideShow.fromBeginning') }}
	</button>
	<button type="button" :class="pill" @click="props.onRecordFromCurrent()">
		<Play :class="ic" />
		{{ t('pptx.slideShow.fromCurrent') }}
	</button>
	<div :class="SEP" />
	<button type="button" :class="pill" disabled>
		<Eraser :class="ic" />
		{{ t('pptx.record.clear') }}
	</button>
	<button type="button" :class="pill" disabled>
		<RotateCcw :class="ic" />
		{{ t('pptx.record.resetToCameo') }}
	</button>
	<div :class="SEP" />
	<button type="button" :class="pill" disabled>
		<CircleHelp :class="ic" />
		{{ t('pptx.record.learnMore') }}
	</button>
</template>
