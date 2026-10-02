<script setup lang="ts">
/**
 * HomeSection: the Vue 3 port of React's
 * `toolbar/HomeSection.tsx`. Renders the Home ribbon tab's Clipboard, Slides and
 * Font groups (Paste/Cut/Copy/Format Painter, New Slide + layout picker, and the
 * font-family / font-size dropdowns). A faithful, mechanical port for visual +
 * behavioral parity: class strings are copied verbatim, React's
 * `useState`/`useEffect(mousedown)` dropdown plumbing becomes `useDropdown`, and
 * the copied/cut feedback flashes use a `ref` + `setTimeout`.
 */
import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxLayoutPreview, TextStyle } from 'pptx-viewer-core';
import {
	fontPickerHomeControls,
	homeSnapshotTranslator,
	resolveDefaultFontFamily,
	textFontSizePtToPx,
	textFontSizePxToPt,
} from 'pptx-viewer-shared';
import type { RibbonHomeRequestEvent, SlideTemplateId } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import ClipboardGroup from './ClipboardGroup.vue';
import { SEP } from './ribbon-constants';
import type { ElementClipboardPayload, LayoutOption, TableCellEditorState } from './ribbon-types';
import SlidesGroup from './SlidesGroup.vue';

interface Props {
	canEdit: boolean;
	clipboardPayload: ElementClipboardPayload | null;
	formatPainterActive?: boolean;
	canActivateFormatPainter?: boolean;
	onCopy: () => void;
	onCut: () => void;
	onPaste: () => void;
	onToggleFormatPainter?: () => void;
	layoutOptions: LayoutOption[];
	/** Marks the active tile in the Layout menu. */
	currentLayoutPath?: string;
	/** Supplies gallery artwork; without it the menus stay name-only. */
	loadLayoutPreviews?: () => Promise<PptxLayoutPreview[]>;
	onInsertSlideFromLayout: (path: string, name?: string) => void;
	onInsertSlideFromTemplate?: (templateId: SlideTemplateId) => void;
	/** Deck scheme map so template previews show the deck's theme colours. */
	templateScheme?: Record<string, string>;
	onApplyLayout?: (path: string) => void;
	onResetSlide?: () => void;
	onAddSection?: () => void;
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

const { t, locale } = useI18n();

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
// Cut and Copy act on the selection, so with nothing selected they are no-ops.
// They used to render live anyway, offering a button that could not do anything.
const hasSelection = computed(() => Boolean(props.selectedElement));
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

const fontState = computed(() => ({
	controls: fontPickerHomeControls(
		{
			enabled: canFormat.value,
			fontFamily: fontFamily.value,
			fontSize: fontSize.value,
			themeFonts: props.themeFonts,
			embeddedFonts: props.embeddedFontFamilies,
			customFonts: props.customFontFamilies,
		},
		t,
	),
	// The locale is read so a language switch re-translates the shared labels.
	locale: locale.value,
	translate: homeSnapshotTranslator(['font-picker'], t),
}));

function requestFont(event: RibbonHomeRequestEvent): void {
	const { id, value } = event.detail;
	if (id === 'home.font.fontFamily') {
		props.onUpdateTextStyle?.({ fontFamily: String(value) });
	} else if (id === 'home.font.fontSize') {
		const size = Number(value);
		props.onUpdateTextStyle?.({
			fontSize:
				props.selectedElement && hasTextProperties(props.selectedElement)
					? textFontSizePtToPx(size)
					: size,
		});
	}
}
</script>

<template>
	<!-- Clipboard group -->
	<ClipboardGroup
		:can-edit="props.canEdit"
		:has-selection="hasSelection"
		:clipboard-payload="props.clipboardPayload"
		:format-painter-active="props.formatPainterActive"
		:can-activate-format-painter="props.canActivateFormatPainter"
		:on-copy="props.onCopy"
		:on-cut="props.onCut"
		:on-paste="props.onPaste"
		:on-toggle-format-painter="props.onToggleFormatPainter"
	/>

	<div :class="SEP" />

	<!-- Slides group -->
	<SlidesGroup
		:can-edit="props.canEdit"
		:layout-options="props.layoutOptions"
		:current-layout-path="props.currentLayoutPath"
		:load-layout-previews="props.loadLayoutPreviews"
		:on-insert-slide-from-layout="props.onInsertSlideFromLayout"
		:on-insert-slide-from-template="props.onInsertSlideFromTemplate"
		:template-scheme="props.templateScheme"
		:on-apply-layout="props.onApplyLayout"
		:on-reset-slide="props.onResetSlide"
		:on-add-section="props.onAddSection"
	/>

	<div :class="SEP" />

	<!-- Font family and size: the shared font-picker element -->
	<pptx-ui-ribbon-home-font-picker :state.prop="fontState" @home-request="requestFont" />

	<div :class="SEP" />
</template>
