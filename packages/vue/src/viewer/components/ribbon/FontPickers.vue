<script setup lang="ts">
/**
 * The Home font family and size fields. They sit on the first row of the Font group
 * (see TextSection), beside Grow, Shrink and Clear.
 */
import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import {
	buildFontCatalog,
	COMMON_FONT_SIZES,
	resolveDefaultFontFamily,
	textFontSizePtToPx,
	textFontSizePxToPt,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { TableCellEditorState } from './ribbon-types';

interface Props {
	canEdit: boolean;
	selectedElement?: PptxElement | null;
	tableEditorState?: TableCellEditorState | null;
	onUpdateTextStyle?: (style: Partial<TextStyle>) => void;
	/** Theme major/minor latin faces, leading the font dropdown. */
	themeFonts?: { heading?: string; body?: string };
	/** Families the deck embeds, offered as their own dropdown group. */
	embeddedFontFamilies?: readonly string[];
	/** Families registered this session via File > Options > Fonts. */
	customFontFamilies?: readonly string[];
}
const props = defineProps<Props>();

const { t } = useI18n();

/**
 * With nothing overriding it on the element, the font box shows the family the
 * deck would actually render: the theme's major font inside a title
 * placeholder and its minor font elsewhere. It used to show a hardcoded
 * "Segoe UI", which misreported every themed deck.
 *
 * Explicit model font sizes are CSS pixels, while the control displays
 * PowerPoint points. An element without an explicit size keeps the existing
 * 18pt presentation fallback.
 */
function extractFontInfo(element?: PptxElement | null): { fontFamily: string; fontSize: string } {
	const placeholderType = (element as { placeholderType?: string } | null | undefined)
		?.placeholderType;
	const fontFamilyDefault = resolveDefaultFontFamily(placeholderType, props.themeFonts);
	if (!element) {
		return { fontFamily: fontFamilyDefault, fontSize: '24' };
	}
	if (!hasTextProperties(element)) {
		return { fontFamily: fontFamilyDefault, fontSize: '24' };
	}

	const segStyle = element.textSegments?.[0]?.style;
	const textStyle = element.textStyle;

	const fontFamily = segStyle?.fontFamily ?? textStyle?.fontFamily ?? fontFamilyDefault;
	const fontSize = segStyle?.fontSize ?? textStyle?.fontSize;

	return {
		fontFamily,
		fontSize: fontSize !== undefined ? String(textFontSizePxToPt(fontSize)) : '18',
	};
}

const fontInfo = computed(() => extractFontInfo(props.selectedElement));
const canFormat = computed(
	() =>
		props.canEdit &&
		Boolean(props.onUpdateTextStyle) &&
		Boolean(
			props.selectedElement &&
			(hasTextProperties(props.selectedElement) ||
				(props.selectedElement.type === 'table' &&
					props.tableEditorState?.elementId === props.selectedElement.id)),
		),
);
const fontFamily = computed(() => fontInfo.value.fontFamily);
const fontSize = computed(() => fontInfo.value.fontSize);

const fontGroups = computed(() =>
	buildFontCatalog({
		themeFonts: props.themeFonts,
		embeddedFonts: props.embeddedFontFamilies,
		customFonts: props.customFontFamilies,
	}),
);

function handlePickFont(f: string): void {
	props.onUpdateTextStyle?.({ fontFamily: f });
}

function handlePickSize(s: number): void {
	props.onUpdateTextStyle?.({
		fontSize:
			props.selectedElement && hasTextProperties(props.selectedElement) ? textFontSizePtToPx(s) : s,
	});
}
</script>

<template>
	<div data-pptx-chrome="font-picker-controls">
		<pptx-ui-select
			variant="ribbon-font"
			data-font-picker="family"
			data-ribbon-control="home.font.fontFamily"
			:aria-label="t('pptx.ribbon.fontFamily')"
			:disabled="!canFormat"
			:value="fontFamily"
			@change="handlePickFont(($event.target as HTMLSelectElement).value)"
		>
			<optgroup v-for="group in fontGroups" :key="group.id" :label="t(group.labelKey)">
				<option
					v-for="entry in group.entries"
					:key="entry.family"
					:value="entry.family"
					:style="{ fontFamily: entry.family }"
					:data-display-label="entry.family"
					:data-description="entry.themeRole ? t(`pptx.font.role.${entry.themeRole}`) : undefined"
				>
					{{ entry.family }}
				</option>
			</optgroup>
		</pptx-ui-select>
		<pptx-ui-select
			variant="ribbon-font"
			data-font-picker="size"
			data-ribbon-control="home.font.fontSize"
			:aria-label="t('pptx.ribbon.fontSize')"
			:disabled="!canFormat"
			:value="fontSize"
			@change="handlePickSize(Number(($event.target as HTMLSelectElement).value))"
		>
			<option v-for="size in COMMON_FONT_SIZES" :key="size" :value="size">{{ size }}</option>
		</pptx-ui-select>
	</div>
</template>
