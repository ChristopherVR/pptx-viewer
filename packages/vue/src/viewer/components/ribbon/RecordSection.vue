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
	<button
		type="button"
		:class="pill"
		disabled
		data-ribbon-group="record.camera"
		data-ribbon-control="record.camera.cameo"
	>
		<span class="h-3 w-3 rounded-full border border-current" aria-hidden="true" />
		{{ t('pptx.record.cameo') }}
	</button>
	<div :class="SEP" />
	<button
		type="button"
		:class="pill"
		data-ribbon-group="record.record"
		data-ribbon-control="record.record.fromBeginning"
		@click="props.onRecordFromBeginning()"
	>
		<Video :class="ic" />
		{{ t('pptx.slideShow.fromBeginning') }}
	</button>
	<button
		type="button"
		:class="pill"
		data-ribbon-group="record.record"
		data-ribbon-control="record.record.fromCurrent"
		@click="props.onRecordFromCurrent()"
	>
		<Play :class="ic" />
		{{ t('pptx.slideShow.fromCurrent') }}
	</button>
	<div :class="SEP" />
	<button
		type="button"
		:class="pill"
		disabled
		data-ribbon-group="record.manage"
		data-ribbon-control="record.manage.clear"
	>
		<Eraser :class="ic" />
		{{ t('pptx.record.clear') }}
	</button>
	<button
		type="button"
		:class="pill"
		disabled
		data-ribbon-group="record.manage"
		data-ribbon-control="record.manage.reset"
	>
		<RotateCcw :class="ic" />
		{{ t('pptx.record.resetToCameo') }}
	</button>
	<div :class="SEP" />
	<button
		type="button"
		:class="pill"
		disabled
		data-ribbon-group="record.help"
		data-ribbon-control="record.help.learnMore"
	>
		<CircleHelp :class="ic" />
		{{ t('pptx.record.learnMore') }}
	</button>
</template>
