<script setup lang="ts">
/**
 * ViewerFileDialogs: the File / Help menu surfaces (document properties,
 * version history and its compare view, print, keyboard-shortcut help,
 * Options, header & footer).
 *
 * Lifted out of `PowerPointViewer.vue` unchanged and kept in their original
 * sibling order. As in {@link ViewerEditDialogs}, the two locally-owned open
 * flags arrive as a value plus a close callback (a parent `ref` read in the
 * parent's template is auto-unwrapped, so a `Ref`-typed prop would receive a
 * plain boolean).
 */
import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxHeaderFooter,
	PptxSlide,
} from 'pptx-viewer-core';
import type { ViewerAddinStatus, ViewerOptions, ViewerOptionsStore } from 'pptx-viewer-shared';

import type { LocaleCatalogEntry } from '../../i18n';
import type { ThemeCatalogEntry } from '../../theme';
import type { UseDocumentPropertiesDialogResult } from '../composables/useDocumentPropertiesDialog';
import type { UseHeaderFooterDialogResult } from '../composables/useHeaderFooterDialog';
import type { UsePrintResult } from '../composables/usePrint';
import type { UseVersionHistoryWiringResult } from '../composables/useVersionHistoryWiring';
import type { CanvasSize } from '../types';
import ComparePanel from './ComparePanel.vue';
import DocumentPropertiesDialog from './DocumentPropertiesDialog.vue';
import HeaderFooterPanel from './HeaderFooterPanel.vue';
import ModalDialog from './ModalDialog.vue';
import PrintDialog from './PrintDialog.vue';
import SettingsDialog from './SettingsDialog.vue';
import ShortcutPanel from './ShortcutPanel.vue';
import VersionHistoryPanel from './VersionHistoryPanel.vue';

defineProps<{
	slides: PptxSlide[];
	activeSlideIndex: number;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	coreProperties: PptxCoreProperties | undefined;
	customProperties: PptxCustomProperty[];
	appProperties: PptxAppProperties | undefined;
	headerFooter: PptxHeaderFooter | undefined;
	documentProperties: UseDocumentPropertiesDialogResult;
	versionHistory: UseVersionHistoryWiringResult;
	printer: UsePrintResult;
	headerFooterDialog: UseHeaderFooterDialogResult;
	showShortcuts: boolean;
	onCloseShortcuts: () => void;
	showSettings: boolean;
	onCloseSettings: () => void;
	optionsStore: ViewerOptionsStore;
	viewerOptions: ViewerOptions;
	/** Availability flags for the Add-ins pane. */
	addinStatus?: ViewerAddinStatus;
	themeKey: string;
	onThemeSelect: (key: string) => void;
	localeCode: string;
	onLocaleSelect: (code: string) => void;
	availableThemes?: ThemeCatalogEntry[];
	availableLocales: LocaleCatalogEntry[];
	aiEnabled: boolean;
	/** Families registered this session via File > Options > Fonts. */
	customFontFamilies?: readonly string[];
	onClearCache: () => void;
}>();

const emit = defineEmits<{
	/** A font file was registered; the ribbon adds the family to its list. */
	(e: 'customFontRegistered', family: string): void;
}>();
</script>

<template>
	<!-- Document properties (General / Statistics / Custom) -->
	<DocumentPropertiesDialog
		:open="documentProperties.propertiesOpen.value"
		:core-properties="coreProperties"
		:custom-properties="customProperties"
		:app-properties="appProperties"
		:slides="slides"
		@save="documentProperties.onPropertiesSave"
		@close="documentProperties.propertiesOpen.value = false"
	/>

	<!-- File > Version History -->
	<VersionHistoryPanel
		:open="versionHistory.showVersionHistory.value"
		:versions="versionHistory.versionHistory.versions.value"
		:canvas-size="canvasSize"
		:media-data-urls="mediaDataUrls"
		@close="versionHistory.showVersionHistory.value = false"
		@restore="versionHistory.onVersionRestore"
		@delete="versionHistory.onVersionDelete"
		@compare="versionHistory.onVersionCompare"
	/>

	<!-- Version history > compare against current -->
	<ComparePanel
		:open="versionHistory.showCompare.value"
		:compare-result="versionHistory.compareResult.value"
		:canvas-size="canvasSize"
		:media-data-urls="mediaDataUrls"
		@close="versionHistory.onCompareClose"
		@accept-all="versionHistory.onCompareAcceptAll"
	/>

	<!-- Print -->
	<PrintDialog
		:open="printer.isPrintDialogOpen.value"
		:slides="slides"
		:active-slide-index="activeSlideIndex"
		@print="printer.print"
		@close="printer.closePrintDialog"
	/>

	<!-- Keyboard shortcut help -->
	<ShortcutPanel :open="showShortcuts" @close="onCloseShortcuts" />

	<!-- File / Help > Options -->
	<SettingsDialog
		:open="showSettings"
		:options="viewerOptions"
		:on-option-change="(group, key, value) => optionsStore.setValue(group, key, value)"
		:on-restore-options="(snapshot) => optionsStore.setOptions(snapshot)"
		:on-ribbon-tab-hidden-change="(tabId, hidden) => optionsStore.setRibbonTabHidden(tabId, hidden)"
		:on-quick-access-commands-change="(ids) => optionsStore.setQuickAccessCommands(ids)"
		:on-reset-options="(group) => optionsStore.reset(group)"
		:on-clear-cache="onClearCache"
		:addin-status="addinStatus"
		:theme-key="themeKey"
		:on-theme-select="onThemeSelect"
		:locale-code="localeCode"
		:on-locale-select="onLocaleSelect"
		:available-themes="availableThemes"
		:available-locales="availableLocales"
		:ai-enabled="aiEnabled"
		:custom-font-families="customFontFamilies"
		@close="onCloseSettings"
		@custom-font-registered="(family: string) => emit('customFontRegistered', family)"
	/>

	<!-- Header & footer -->
	<ModalDialog
		:open="headerFooterDialog.showHeaderFooter.value"
		title="Header & footer"
		@close="headerFooterDialog.showHeaderFooter.value = false"
	>
		<HeaderFooterPanel
			:header-footer="headerFooter"
			@update="headerFooterDialog.onHeaderFooterUpdate"
			@close="headerFooterDialog.showHeaderFooter.value = false"
		/>
	</ModalDialog>
</template>
