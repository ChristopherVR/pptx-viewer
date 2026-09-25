<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next';
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
	DEFAULT_FONT_SIZE,
	resolveDefaultFontFamily,
	textFontSizePtToPx,
	textFontSizePxToPt,
} from 'pptx-viewer-shared';
import type { SlideTemplateId } from 'pptx-viewer-shared';
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { vAnchoredPopup } from './anchored-popup';
import ClipboardGroup from './ClipboardGroup.vue';
import FontFamilyMenu from './FontFamilyMenu.vue';
import { COMMON_SIZES, MENU_ITEM, MENU_PANEL, SEP } from './ribbon-constants';
import type { ElementClipboardPayload, LayoutOption, TableCellEditorState } from './ribbon-types';
import SlidesGroup from './SlidesGroup.vue';
import { useDropdown } from './use-dropdown';

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
		return { fontFamily: fontFamilyDefault, fontSize: String(DEFAULT_FONT_SIZE) };
	}
	if (!hasTextProperties(element)) {
		return { fontFamily: fontFamilyDefault, fontSize: String(DEFAULT_FONT_SIZE) };
	}

	const segStyle = element.textSegments?.[0]?.style;
	const textStyle = element.textStyle;

	const fontFamily = segStyle?.fontFamily ?? textStyle?.fontFamily ?? fontFamilyDefault;
	const fontSize = segStyle?.fontSize ?? textStyle?.fontSize;

	return {
		fontFamily,
		fontSize:
			fontSize !== undefined ? String(textFontSizePxToPt(fontSize)) : String(DEFAULT_FONT_SIZE),
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

const fontMenu = useDropdown();
const sizeMenu = useDropdown();
watch(canFormat, (enabled) => {
	if (!enabled) {
		fontMenu.close();
		sizeMenu.close();
	}
});

function handlePickFont(f: string): void {
	props.onUpdateTextStyle?.({ fontFamily: f });
	fontMenu.close();
}

function handlePickSize(s: number): void {
	props.onUpdateTextStyle?.({
		fontSize:
			props.selectedElement && hasTextProperties(props.selectedElement) ? textFontSizePtToPx(s) : s,
	});
	sizeMenu.close();
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

	<!-- Font group -->
	<div class="flex flex-col items-center gap-0.5" data-ribbon-group="home.font">
		<div class="flex items-center gap-1">
			<div :ref="fontMenu.root" class="relative" data-ribbon-control="home.font.fontFamily">
				<button
					type="button"
					:aria-label="t('pptx.ribbon.fontFamily')"
					:disabled="!canFormat"
					class="inline-flex items-center justify-between px-2 py-1 rounded-sm border border-border/60 bg-background/60 text-[11px] text-foreground min-w-[120px] truncate enabled:hover:bg-accent/40 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
					@click="fontMenu.toggle()"
				>
					<span class="truncate">{{ fontFamily }}</span>
					<ChevronDown class="w-3 h-3 ml-1 shrink-0 text-muted-foreground" />
				</button>
				<FontFamilyMenu
					v-if="fontMenu.open.value && canFormat"
					:anchor="fontMenu.root.value"
					:theme-fonts="props.themeFonts"
					:embedded-fonts="props.embeddedFontFamilies"
					:custom-fonts="props.customFontFamilies"
					@select="handlePickFont"
				/>
			</div>
			<div :ref="sizeMenu.root" class="relative" data-ribbon-control="home.font.fontSize">
				<button
					type="button"
					:aria-label="t('pptx.ribbon.fontSize')"
					:disabled="!canFormat"
					class="inline-flex items-center justify-between px-2 py-1 rounded-sm border border-border/60 bg-background/60 text-[11px] text-foreground min-w-[50px] text-center enabled:hover:bg-accent/40 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
					@click="sizeMenu.toggle()"
				>
					<span class="truncate">{{ fontSize }}</span>
					<ChevronDown class="w-3 h-3 ml-1 shrink-0 text-muted-foreground" />
				</button>
				<div
					v-if="sizeMenu.open.value && canFormat"
					class="z-50 flex flex-col w-48 pt-1"
					v-anchored-popup="{ anchor: sizeMenu.root.value }"
				>
					<div :class="MENU_PANEL">
						<button
							v-for="s in COMMON_SIZES"
							:key="s"
							type="button"
							:class="MENU_ITEM"
							@click="handlePickSize(s)"
						>
							{{ s }}
						</button>
					</div>
				</div>
			</div>
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">{{ t('pptx.ribbon.font') }}</span>
	</div>

	<div :class="SEP" />
</template>
