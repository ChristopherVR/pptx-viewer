<script lang="ts">
	/**
	 * PresentationPropertiesPanel: the Properties tab's no-selection body,
	 * mirroring React's `inspector/PresentationPropertiesPanel.tsx` section
	 * order: PRESENTATION, THEME, THEME OVERRIDE, SLIDE SIZE, NOTES & HANDOUT,
	 * DOCUMENT. Also ports React's `useInspectorPaneState` selected-theme-path
	 * handling (falls back to the first master's theme path when the package
	 * lists no theme options).
	 *
	 * Deck-level reads/mutations come from the {@link InspectorDeckActions}
	 * context facade (`deck`); when no deck is provided (standalone mounts,
	 * hosts without the viewer root) the panel falls back to the legacy
	 * read-only slide-size summary + theme sections.
	 */
	import type { PptxHandler, PptxTheme, PptxThemeOption } from 'pptx-viewer-core';
	import type { CanvasSize } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';
	import type { InspectorDeckActions } from '../../state/inspector-deck';
	import DocumentPropertiesSection from './DocumentPropertiesSection.svelte';
	import NotesHandoutSection from './NotesHandoutSection.svelte';
	import PresentationSettingsSection from './PresentationSettingsSection.svelte';
	import SlideSizeSection from './SlideSizeSection.svelte';
	import SlideTransitionSection from './SlideTransitionSection.svelte';
	import TagsSection from './TagsSection.svelte';
	import TemplateBackgroundSection from './TemplateBackgroundSection.svelte';
	import ThemeSection from './ThemeSection.svelte';
	import ThemeSelectorSection from './ThemeSelectorSection.svelte';

	const {
		editor,
		deck,
		canvasSize,
		handler,
		presentationTheme,
		onthemechange,
	}: {
		editor: EditorState;
		deck?: InspectorDeckActions;
		canvasSize?: CanvasSize;
		handler?: PptxHandler | null;
		presentationTheme?: PptxTheme;
		onthemechange?: (theme: PptxTheme) => void;
	} = $props();
	const t = useTranslator();

	const canEdit = $derived(deck !== undefined && editor.editable);
	const effectiveCanvasSize = $derived(deck?.canvasSize ?? canvasSize);
	const activeSlide = $derived(editor.slides[editor.currentSlideIndex]);

	// ── Theme selection (React's useInspectorPaneState) ──────────────────
	const activeThemePath = $derived(editor.slideMasters[0]?.themePath);
	const effectiveThemeOptions = $derived.by<PptxThemeOption[]>(() => {
		const options = deck?.themeOptions ?? [];
		if (options.length > 0 || !activeThemePath) {
			return options;
		}
		return [{ path: activeThemePath, name: presentationTheme?.name }];
	});
	// The template's onselect callback writes this (invisible to the linter).
	// eslint-disable-next-line prefer-const
	let pickedThemePath = $state<string | undefined>(undefined);
	const selectedThemePath = $derived(
		pickedThemePath ?? activeThemePath ?? effectiveThemeOptions[0]?.path ?? '',
	);
</script>

{#if deck}
	<div class="pptx-svelte-inspector-section">
		<h4>{t('pptx.slideInspector.presentation')}</h4>
		<PresentationSettingsSection
			properties={editor.presentationProperties}
			{canEdit}
			onupdate={(patch) => deck.updatePresentationProperties(patch)}
		/>
	</div>
	<div class="pptx-svelte-inspector-section">
		<h4>{t('pptx.documentProperties.themeHeading')}</h4>
		<ThemeSelectorSection
			options={effectiveThemeOptions}
			selectedPath={selectedThemePath}
			{canEdit}
			onselect={(path) => (pickedThemePath = path)}
			onapply={(path, applyToAllMasters) => deck.applyThemeByPath(path, applyToAllMasters)}
		/>
	</div>
	{#if handler && onthemechange}
		<div class="pptx-svelte-inspector-section">
			<h4>{t('pptx.themeOverride.heading')}</h4>
			<ThemeSection {editor} {handler} theme={presentationTheme} {onthemechange} />
		</div>
	{/if}
	{#if effectiveCanvasSize}
		<div class="pptx-svelte-inspector-section">
			<h4>{t('pptx.slideSize.title')}</h4>
			<SlideSizeSection
				canvasSize={effectiveCanvasSize}
				slideSize={deck.slideSize}
				{canEdit}
				hasContent={deck.hasContent}
				onupdate={(size) => deck.updateCanvasSize(size)}
				onupdateslidesize={(size, rescaleMode) => deck.updateSlideSize(size, rescaleMode)}
			/>
		</div>
	{/if}
	<!-- React pairs slide size + transition in `SlideProperties`; same order. -->
	{#if activeSlide}
		<div class="pptx-svelte-inspector-section">
			<h4>{t('pptx.slideInspector.slideTransition')}</h4>
			<SlideTransitionSection {editor} />
		</div>
	{/if}
	{#if editor.editTemplateMode && activeSlide}
		<div class="pptx-svelte-inspector-section">
			<h4>{t('pptx.slideBackground.templateBackgroundsHeading')}</h4>
			<TemplateBackgroundSection
				{activeSlide}
				slideMasters={editor.slideMasters}
				{deck}
				{canEdit}
			/>
		</div>
	{/if}
	<div class="pptx-svelte-inspector-section">
		<h4>{t('pptx.documentProperties.notesHandoutHeading')}</h4>
		<NotesHandoutSection
			notesCanvasSize={deck.notesCanvasSize}
			notesMaster={editor.notesMaster}
			handoutMaster={editor.handoutMaster}
		/>
	</div>
	<div class="pptx-svelte-inspector-section">
		<h4>{t('pptx.documentProperties.documentHeading')}</h4>
		<DocumentPropertiesSection
			coreProperties={editor.coreProperties}
			appProperties={editor.appProperties}
			customProperties={editor.customProperties}
			{canEdit}
			onupdatecore={(patch) => deck.updateCoreProperties(patch)}
			onupdateapp={(patch) => deck.updateAppProperties(patch)}
			onupdatecustom={(next) => deck.updateCustomProperties(next)}
		/>
	</div>
	<!-- React renders TAGS from the same PresentationPropertiesPanel. -->
	<div class="pptx-svelte-inspector-section">
		<TagsSection
			tagCollections={editor.tagCollections}
			{canEdit}
			onupdate={(next) => editor.updateTagCollections(next)}
		/>
	</div>
	{#if activeSlide}
		<!-- React's SLIDE card: the active slide's element count (literal
		     "Slide" / "elements" copy, matching React which has no key here). -->
		<div class="pptx-svelte-inspector-section">
			<h4>Slide</h4>
			<p class="pptx-svelte-inspector-meta">{activeSlide.elements?.length ?? 0} elements</p>
		</div>
	{/if}
{:else}
	{#if canvasSize}
		<div class="pptx-svelte-inspector-section">
			<h4>{t('pptx.slideSize.title')}</h4>
			<p class="pptx-svelte-inspector-meta">
				{canvasSize.width} &times; {canvasSize.height} px &middot; {t(
					'pptx.customShows.slideCount',
					{ count: editor.slides.length },
				)}
			</p>
		</div>
	{/if}
	{#if handler && onthemechange}
		<div class="pptx-svelte-inspector-section">
			<ThemeSection {editor} {handler} theme={presentationTheme} {onthemechange} />
		</div>
	{/if}
{/if}

<style>
	.pptx-svelte-inspector-section {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--pptx-border, #33334d);
	}

	.pptx-svelte-inspector-section:first-child {
		margin-top: 0;
		padding-top: 0;
		border-top: none;
	}

	.pptx-svelte-inspector-section h4 {
		margin: 0 0 8px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-inspector-meta {
		margin: 0;
		color: var(--pptx-muted-foreground, #94a3b8);
	}
</style>
