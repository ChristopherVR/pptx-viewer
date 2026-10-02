<script setup lang="ts">
/**
 * FontDecorationControls: Home > Font character toggles, Text Shadow, size
 * steps and Clear Formatting. The buttons come from the shared
 * `pptx-ui-ribbon-home-font` element; this adapter reflects the effective text
 * style into it and re-emits the one intent as the existing typed events.
 */
import type { TextStyle } from 'pptx-viewer-core';
import { fontHomeControls, homeSnapshotTranslator } from 'pptx-viewer-shared';
import type { RibbonHomeRequestEvent } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ disabled: boolean; textStyle?: TextStyle | null }>();
const emit = defineEmits<{
	format: [flag: string];
	shadow: [];
	increase: [];
	decrease: [];
	clear: [];
}>();
const { t } = useI18n();

const state = computed(() => ({
	controls: fontHomeControls({
		enabled: !props.disabled,
		bold: Boolean(props.textStyle?.bold),
		italic: Boolean(props.textStyle?.italic),
		underline: Boolean(props.textStyle?.underline),
		strikethrough: Boolean(props.textStyle?.strikethrough),
		shadow: Boolean(props.textStyle?.textShadowColor),
	}),
	translate: homeSnapshotTranslator(['font'], t),
}));

function request(event: RibbonHomeRequestEvent): void {
	const id = event.detail.id.replace('home.font.', '');
	switch (id) {
		case 'bold':
		case 'italic':
		case 'underline':
		case 'strikethrough':
			emit('format', id);
			break;
		case 'shadow':
			emit('shadow');
			break;
		case 'increaseFontSize':
			emit('increase');
			break;
		case 'decreaseFontSize':
			emit('decrease');
			break;
		case 'clearFormatting':
			emit('clear');
	}
}
</script>

<template>
	<pptx-ui-ribbon-home-font :state.prop="state" @home-request="request" />
</template>
