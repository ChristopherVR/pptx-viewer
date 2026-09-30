<script setup lang="ts">
import type { TextStyle } from 'pptx-viewer-core';
import { useI18n } from 'vue-i18n';

import { gB, gL, grp, FMT, pill, ic } from './ribbon-constants';
import RibbonIcon from './RibbonIcon';

const props = defineProps<{ disabled: boolean; textStyle?: TextStyle | null }>();
const emit = defineEmits<{
	format: [flag: string];
	shadow: [];
	increase: [];
	decrease: [];
	clear: [];
}>();
const { t } = useI18n();
</script>

<template>
	<div :class="grp" data-pptx-chrome="control-cluster">
		<button
			v-for="(b, i) in FMT"
			:key="b.id"
			type="button"
			:data-ribbon-control="`home.font.${b.id}`"
			:disabled="props.disabled"
			:class="i < FMT.length - 1 ? gB : gL"
			:title="t(b.labelKey)"
			@mousedown.prevent
			@click="emit('format', b.id)"
		>
			<RibbonIcon :name="`home.font.${b.id}`" :class="ic" />
		</button>
	</div>

	<!-- Text Shadow toggle -->
	<button
		type="button"
		data-ribbon-control="home.font.shadow"
		:disabled="props.disabled"
		:class="[pill, props.textStyle?.textShadowColor ? 'bg-primary/20 ring-1 ring-primary' : '']"
		:title="t('pptx.textEffects.shadow')"
		:aria-label="t('pptx.textEffects.shadow')"
		@mousedown.prevent
		@click="emit('shadow')"
	>
		<RibbonIcon name="home.font.shadow" :class="ic" />
	</button>

	<!-- Font size increase / decrease / clear formatting -->
	<div :class="grp" data-pptx-chrome="control-cluster">
		<button
			type="button"
			data-ribbon-control="home.font.increaseFontSize"
			:disabled="props.disabled"
			:class="gB"
			:title="t('pptx.text.increaseFontSize')"
			@mousedown.prevent
			@click="emit('increase')"
		>
			<RibbonIcon name="home.font.increaseFontSize" :class="ic" />
		</button>
		<button
			type="button"
			data-ribbon-control="home.font.decreaseFontSize"
			:disabled="props.disabled"
			:class="gB"
			:title="t('pptx.text.decreaseFontSize')"
			@mousedown.prevent
			@click="emit('decrease')"
		>
			<RibbonIcon name="home.font.decreaseFontSize" :class="ic" />
		</button>
		<button
			type="button"
			data-ribbon-control="home.font.clearFormatting"
			:disabled="props.disabled"
			:class="gL"
			:title="t('pptx.text.clearFormatting')"
			@mousedown.prevent
			@click="emit('clear')"
		>
			<RibbonIcon name="home.font.clearFormatting" :class="ic" />
		</button>
	</div>
</template>
