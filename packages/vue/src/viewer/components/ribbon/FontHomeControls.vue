<script setup lang="ts">
/**
 * FontHomeControls: Home > Font character strip plus character spacing, change
 * case and the font / highlight colour popovers. Everything renders in the
 * shared `pptx-ui-ribbon-home-font` element; this adapter reflects the
 * effective text style and deck colours into it and re-emits each intent as a
 * typed event that TextSection turns into the undoable edit.
 */
import type { PptxThemeColorRef, TextStyle } from 'pptx-viewer-core';
import { fontHomeControls, homeSnapshotTranslator } from 'pptx-viewer-shared';
import type { ChangeCaseMode, RibbonHomeRequestEvent } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useHomeColours } from './use-home-colours';

const props = defineProps<{
	disabled: boolean;
	textStyle?: TextStyle | null;
	color?: string;
	colorRef?: PptxThemeColorRef;
	highlight?: string;
}>();
const emit = defineEmits<{
	format: [flag: string];
	shadow: [];
	increase: [];
	decrease: [];
	clear: [];
	color: [hex: string, ref?: PptxThemeColorRef];
	highlight: [hex: string];
	spacing: [value: number];
	case: [mode: ChangeCaseMode];
}>();
const { t, locale } = useI18n();
const colours = useHomeColours();

const state = computed(() => ({
	controls: fontHomeControls({
		enabled: !props.disabled,
		bold: Boolean(props.textStyle?.bold),
		italic: Boolean(props.textStyle?.italic),
		underline: Boolean(props.textStyle?.underline),
		strikethrough: Boolean(props.textStyle?.strikethrough),
		shadow: Boolean(props.textStyle?.textShadowColor),
		characterSpacing: props.textStyle?.characterSpacing,
		fontColor: {
			value: props.color ?? '#000000',
			ref: props.colorRef,
			themeColors: colours.themeColors.value,
			recent: colours.recent.value,
		},
		highlight: { value: props.highlight ?? '#ffff00', recent: colours.recent.value },
	}),
	// The locale is read so a language switch re-translates the shared labels.
	locale: locale.value,
	translate: homeSnapshotTranslator(['font'], t),
}));

function request(event: RibbonHomeRequestEvent): void {
	const { id, value, ref } = event.detail;
	switch (id.replace('home.font.', '')) {
		case 'bold':
		case 'italic':
		case 'underline':
		case 'strikethrough':
			emit('format', id.replace('home.font.', ''));
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
			break;
		case 'characterSpacing':
			emit('spacing', Number(value));
			break;
		case 'changeCase':
			emit('case', value as ChangeCaseMode);
			break;
		case 'fontColor':
			colours.push(String(value));
			emit('color', String(value), ref);
			break;
		case 'highlightColor':
			colours.push(String(value));
			emit('highlight', String(value));
	}
}
</script>

<template>
	<pptx-ui-ribbon-home-font :state.prop="state" @home-request="request" />
</template>
