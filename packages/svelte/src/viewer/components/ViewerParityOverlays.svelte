<script lang="ts">
	import type { PptxSlide } from 'pptx-viewer-core';
	import type { CanvasSize, ThemeCatalogEntry } from 'pptx-viewer-shared';
	import type { LocaleCatalogEntry } from 'pptx-viewer-shared/i18n';

	import type { EditorState } from '../editor/editor-state.svelte';
	import type { ExportUiState } from '../export/export-ui.svelte';
	import type { ViewerOptionsState } from '../state/viewer-options.svelte';
	import type { ViewerParityUiState } from '../state/viewer-parity-ui.svelte';
	import ComparePanel from './ComparePanel.svelte';
	import CustomShowsDialog from './CustomShowsDialog.svelte';
	import HeaderFooterPanel from './HeaderFooterPanel.svelte';
	import KeepAnnotationsDialog from './KeepAnnotationsDialog.svelte';
	import OutlineViewOverlay from './OutlineViewOverlay.svelte';
	import PresentationSubtitleBar from './PresentationSubtitleBar.svelte';
	import PrintDialog from './PrintDialog.svelte';
	import ReadingViewOverlay from './ReadingViewOverlay.svelte';
	import RehearseTimings from './RehearseTimings.svelte';
	import SelectionPane from './SelectionPane.svelte';
	import SetUpSlideShowDialog from './SetUpSlideShowDialog.svelte';
	import SettingsDialog from './SettingsDialog.svelte';
	import ShortcutPanel from './ShortcutPanel.svelte';
	import SlideSorterOverlay from './SlideSorterOverlay.svelte';

	const {
		ui,
		editor,
		exportUi,
		slides,
		canvasSize,
		mediaDataUrls,
		current,
		fullscreen,
		locale,
		themeKey,
		themeCatalog,
		onsetthemekey,
		availableLocales,
		onsetlocale,
		onselectslide,
		onmoveslide,
		optionsState,
		aiEnabled = false,
	}: {
		ui: ViewerParityUiState;
		editor: EditorState;
		optionsState: ViewerOptionsState;
		exportUi: ExportUiState;
		slides: PptxSlide[];
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
		current: number;
		fullscreen: boolean;
		/** Effective locale (host `locale` prop, or the user's Options > Language choice). */
		locale: string;
		/** Effective File > Options > Appearance selection, threaded to `SettingsDialog`. */
		themeKey: string;
		themeCatalog: readonly ThemeCatalogEntry[];
		onsetthemekey: (key: string) => void;
		availableLocales?: readonly LocaleCatalogEntry[];
		onsetlocale: (code: string) => void;
		onselectslide: (index: number) => void;
		onmoveslide: (from: number, to: number) => void;
		/** When true, the Options dialog shows an AI section (chat-log export). */
		aiEnabled?: boolean;
	} = $props();
</script>

{#if ui.setupSlideShowOpen}<SetUpSlideShowDialog properties={editor.presentationProperties} customShows={editor.customShows} slideCount={slides.length} onclose={() => (ui.setupSlideShowOpen = false)} onsave={(next) => editor.presentationMetadata.updatePresentationProperties(next)} />{/if}
{#if ui.headerFooterOpen}<HeaderFooterPanel value={editor.headerFooter} onclose={() => (ui.headerFooterOpen = false)} onapply={(next) => editor.presentationMetadata.updateHeaderFooter(next)} />{/if}
{#if ui.settingsOpen}<SettingsDialog {optionsState} onclose={() => (ui.settingsOpen = false)} {themeKey} {themeCatalog} {onsetthemekey} {locale} {availableLocales} {onsetlocale} {aiEnabled} />{/if}
{#if ui.shortcutsOpen}<ShortcutPanel onclose={() => (ui.shortcutsOpen = false)} />{/if}
{#if ui.compare.open}<ComparePanel compare={ui.compare} onclose={() => (ui.compare.open = false)} />{/if}
{#if ui.printSettingsOpen}<PrintDialog slideCount={slides.length} {current} onclose={() => (ui.printSettingsOpen = false)} onprint={(options) => exportUi.runPrint(options)} />{/if}
<RehearseTimings rehearse={ui.rehearse} onsave={() => ui.rehearse.save(editor)} ondiscard={() => ui.rehearse.discard()} />
{#if ui.customShowsOpen}<CustomShowsDialog shows={editor.customShows} slides={editor.slides} onclose={() => (ui.customShowsOpen = false)} onsave={(shows) => editor.presentationMetadata.updateCustomShows(shows)} />{/if}
{#if ui.selectionPaneOpen}<SelectionPane {editor} onclose={() => (ui.selectionPaneOpen = false)} />{/if}
{#if ui.slideSorterOpen}<SlideSorterOverlay {slides} {canvasSize} {mediaDataUrls} {current} onselect={onselectslide} onmove={onmoveslide} onclose={() => (ui.slideSorterOpen = false)} />{/if}
{#if ui.outlineViewOpen}<OutlineViewOverlay slides={editor.slides} {canvasSize} canEdit={editor.editable} oncommit={(next) => editor.commitSlides(next)} onactiveslide={onselectslide} onclose={() => (ui.outlineViewOpen = false)} />{/if}
{#if ui.readingViewOpen}<ReadingViewOverlay {slides} {canvasSize} {mediaDataUrls} activeSlideIndex={current} onexit={(index) => { ui.readingViewOpen = false; onselectslide(index); }} />{/if}
{#if ui.keepAnnotationsOpen}<KeepAnnotationsDialog annotationCount={ui.annotations.count} slideCount={ui.annotations.slideCount} onkeep={() => { ui.annotations.keep(editor); ui.keepAnnotationsOpen = false; }} ondiscard={() => { ui.annotations.clear(); ui.keepAnnotationsOpen = false; }} />{/if}
<PresentationSubtitleBar enabled={fullscreen && (ui.subtitlesEnabled || editor.presentationProperties.showSubtitles === true)} {locale} />
