<script lang="ts">
	/**
	 * ViewTab: the ribbon's View tab. Zoom in/out/fit, fullscreen (Slide
	 * Show), and the Notes toggle, relocated from the pre-ribbon toolbar's
	 * always-visible zoom group.
	 */
	import { useTranslator } from '../../../../i18n/context';
	import type { ViewerPreferences } from 'pptx-viewer-shared';
	import { updateViewerPreference } from 'pptx-viewer-shared';
	import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
	import type { EditorState } from '../../../editor/editor-state.svelte';

	const {
		zoomPercent,
		onzoomin,
		onzoomout,
		onzoomfit,
		isFullscreen,
		onfullscreen,
		editTemplateMode = false,
		onsettemplateediting,
		onentermasterview,
		showNotes = false,
		notesExpanded = false,
		onnotestoggle,
		onselectionpane,
		onslidesorter,
		editor,
		preferences,
		onpreferenceschange,
		showGuides,
		onshowguideschange,
		snapToShape,
		onsnapToShapechange,
		onaddguide,
	}: {
		zoomPercent: number;
		onzoomin: () => void;
		onzoomout: () => void;
		onzoomfit: () => void;
		isFullscreen: boolean;
		onfullscreen: () => void;
		editTemplateMode?: boolean;
		onsettemplateediting?: (enabled: boolean) => void;
		onentermasterview?: () => void;
		showNotes?: boolean;
		notesExpanded?: boolean;
		onnotestoggle?: () => void;
		onselectionpane: () => void;
		onslidesorter: () => void;
		editor: EditorState;
		preferences: ViewerPreferences;
		onpreferenceschange: (preferences: ViewerPreferences) => void;
		showGuides: boolean;
		onshowguideschange: (show: boolean) => void;
		snapToShape: boolean;
		onsnapToShapechange: (enabled: boolean) => void;
		onaddguide: (axis: 'h' | 'v') => void;
	} = $props();

	const t = useTranslator();
	function toggle(key: 'showGrid' | 'showRulers' | 'snapToGrid'): void {
		onpreferenceschange(updateViewerPreference(preferences, key, !preferences[key]));
	}
	async function eyedropper(): Promise<void> {
		const Picker = (window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper;
		const el = editor.selectedElement;
		if (!Picker || !el || !('shapeStyle' in el)) {
			return;
		}
		const { sRGBHex } = await new Picker().open();
		editor.patchSelected({ shapeStyle: { ...el.shapeStyle, fillMode: 'solid', fillColor: sRGBHex } as ShapeStyle } as Partial<PptxElement>);
	}
</script>

<div class="pptx-svelte-viewtab" role="group" aria-label={t('pptx.ribbon.tab.view')}>
	<button type="button" aria-label={t('pptx.statusBar.zoomOut')} title={t('pptx.statusBar.zoomOut')} onclick={onzoomout}>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>
	</button>
	<button
		type="button"
		class="pptx-svelte-viewtab-zoom"
		aria-label={t('pptx.view.zoomToFit')}
		title={t('pptx.view.zoomToFitTooltip')}
		onclick={onzoomfit}
	>
		{zoomPercent}%
	</button>
	<button type="button" aria-label={t('pptx.statusBar.zoomIn')} title={t('pptx.statusBar.zoomIn')} onclick={onzoomin}>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>
	</button>

	<span class="pptx-svelte-viewtab-sep" aria-hidden="true"></span>
	<button type="button" class:pptx-svelte-viewtab-active={preferences.showRulers} aria-pressed={preferences.showRulers} onclick={() => toggle('showRulers')}>Rulers</button>
	<button type="button" class:pptx-svelte-viewtab-active={preferences.showGrid} aria-pressed={preferences.showGrid} onclick={() => toggle('showGrid')}>Grid</button>
	<button type="button" class:pptx-svelte-viewtab-active={showGuides} aria-pressed={showGuides} onclick={() => onshowguideschange(!showGuides)}>Guides</button>
	<button type="button" class:pptx-svelte-viewtab-active={preferences.snapToGrid} aria-pressed={preferences.snapToGrid} onclick={() => toggle('snapToGrid')}>Snap to grid</button>
	<button type="button" class:pptx-svelte-viewtab-active={snapToShape} aria-pressed={snapToShape} onclick={() => onsnapToShapechange(!snapToShape)}>Snap to shape</button>
	<button type="button" onclick={() => onaddguide('h')}>Add H guide</button><button type="button" onclick={() => onaddguide('v')}>Add V guide</button>
	<button type="button" disabled={!editor.editable || typeof window === 'undefined' || !('EyeDropper' in window) || !editor.selectedElement} onclick={() => void eyedropper()}>Eyedropper</button>
	<!-- No aria-label here: it would override the visible "Slide Master" text as
	     the accessible name (the cross-binding e2e contract); the tooltip stays
	     on title only. -->
	<button type="button" disabled={!editor.editable} title={t('pptx.view.slideMasterTooltip')} onclick={() => onentermasterview?.()}>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3h11v9h-11zM5 6h6M5 8.5h4M4 1.5v3M12 1.5v3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
		<span>{t('pptx.master.title')}</span>
	</button>

	<button type="button" title={t('pptx.ribbon.toggleSelectionPane')} onclick={onselectionpane}>☷ <span>{t('pptx.ribbon.selectionPane')}</span></button>
	<button type="button" onclick={onslidesorter}>▦ <span>{t('pptx.view.slideSorter')}</span></button>

	<button
		type="button"
		data-testid="template-edit-toggle"
		class:pptx-svelte-viewtab-active={editTemplateMode}
		aria-label={t(editTemplateMode ? 'pptx.ribbon.templatesOn' : 'pptx.ribbon.templatesOff')}
		title={t('pptx.view.templateEditingTooltip')}
		aria-pressed={editTemplateMode}
		disabled={!editor.editable}
		onclick={() => onsettemplateediting?.(!editTemplateMode)}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h11v9h-11zM5 1.8v3.4M11 1.8v3.4M5 10.2h6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /></svg>
		<span>{editTemplateMode ? t('pptx.ribbon.templatesOn') : t('pptx.ribbon.templatesOff')}</span>
	</button>

	<button
		type="button"
		aria-label={t('pptx.statusBar.slideShow')}
		title={t('pptx.statusBar.slideShow')}
		aria-pressed={isFullscreen}
		onclick={onfullscreen}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6v-3.5h3.5M13.5 6v-3.5h-3.5M2.5 10v3.5h3.5M13.5 10v3.5h-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
		<span>{t('pptx.view.presentationViews')}</span>
	</button>
	{#if showNotes}
		<button
			type="button"
			class:pptx-svelte-viewtab-active={notesExpanded}
			aria-label={t('pptx.statusBar.toggleNotes')}
			title={t('pptx.statusBar.toggleNotes')}
			aria-pressed={notesExpanded}
			onclick={() => onnotestoggle?.()}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h9v11h-9zM5 5.5h6M5 8h6M5 10.5h4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
			<span>{t('pptx.notes.title')}</span>
		</button>
	{/if}
</div>

<style>
	.pptx-svelte-viewtab {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.pptx-svelte-viewtab button {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 28px;
		padding: 0 8px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
	}

	.pptx-svelte-viewtab button:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-viewtab svg {
		width: 15px;
		height: 15px;
	}

	.pptx-svelte-viewtab-zoom {
		min-width: 52px;
		justify-content: center;
	}

	.pptx-svelte-viewtab-active {
		color: var(--pptx-primary, #6366f1);
	}

	.pptx-svelte-viewtab-sep {
		width: 1px;
		height: 22px;
		background: var(--pptx-border, #33334d);
	}
</style>
