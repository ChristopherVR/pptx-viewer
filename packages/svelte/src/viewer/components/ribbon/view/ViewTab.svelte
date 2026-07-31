<script lang="ts">
	/**
	 * ViewTab: the ribbon's View tab, at React's `ViewSection` control set
	 * (Presentation Views / Master Views / Show / Zoom / Window).
	 *
	 * Zoom in, zoom out, "Slide Show" and the notes toggle used to live here as
	 * well; they are not gone, they moved back to where React keeps them, the
	 * bottom `StatusBar`, which already offers all four. Duplicating them on the
	 * tab made the View tab claim controls React's View tab does not have, which
	 * `e2e/ribbon-control-inventory.spec.ts` reads as drift in both directions.
	 *
	 * Handout Master, Notes Master, Zoom (the level dropdown) and Macros are
	 * disabled placeholders in React too. See `RecordTab.svelte` for why they are
	 * rendered rather than dropped. Reading View is NOT one of them any more: it
	 * shipped inert in all five bindings for a year and is now a real view, so
	 * leaving it disabled here would be the drift, not the parity.
	 */
	import type { ViewerPreferences } from 'pptx-viewer-shared';
	import { updateViewerPreference } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import RibbonCommand from '../RibbonCommand.svelte';
	import RibbonGroup from '../RibbonGroup.svelte';
	import ViewShowGroup from './ViewShowGroup.svelte';

	const {
		onzoomfit,
		editTemplateMode = false,
		onsettemplateediting,
		onentermasterview,
		onselectionpane,
		onslidesorter,
		onreadingview,
		onnormal,
		editor,
		preferences,
		onpreferenceschange,
		showGuides,
		onshowguideschange,
		snapToShape,
		onsnapToShapechange,
		onaddguide,
	}: {
		onzoomfit: () => void;
		editTemplateMode?: boolean;
		onsettemplateediting?: (enabled: boolean) => void;
		onentermasterview?: () => void;
		onselectionpane: () => void;
		onslidesorter: () => void;
		/** Opens Reading View: the deck at full window size, no Fullscreen API. */
		onreadingview?: () => void;
		/** Returns the viewer to the normal editing view (React's "Normal"). */
		onnormal?: () => void;
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

	function togglePreference(key: 'showGrid' | 'showRulers' | 'snapToGrid'): void {
		onpreferenceschange(updateViewerPreference(preferences, key, !preferences[key]));
	}

</script>

<div class="pptx-svelte-viewtab">
	<RibbonGroup label={t('pptx.view.presentationViews')}>
		<RibbonCommand label={t('pptx.view.normal')} title={t('pptx.statusBar.normalView')} onclick={onnormal}>
			{#snippet icon()}<svg viewBox="0 0 20 20"><rect x="2.5" y="4" width="15" height="11" rx="1" /><path d="M2.5 7.5h15" /></svg>{/snippet}
		</RibbonCommand>
		<RibbonCommand label={t('pptx.slideSorter.title')} title={t('pptx.statusBar.slideSorter')} onclick={onslidesorter}>
			{#snippet icon()}<svg viewBox="0 0 20 20"><rect x="2.5" y="3.5" width="6" height="5" /><rect x="11.5" y="3.5" width="6" height="5" /><rect x="2.5" y="11.5" width="6" height="5" /><rect x="11.5" y="11.5" width="6" height="5" /></svg>{/snippet}
		</RibbonCommand>
		<RibbonCommand label={t('pptx.view.readingView')} title={t('pptx.view.readingView')} onclick={onreadingview}>
			{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M2.5 4.5h6a2 2 0 0 1 1.5.7 2 2 0 0 1 1.5-.7h6v11h-6a2 2 0 0 0-1.5.7 2 2 0 0 0-1.5-.7h-6zM10 5.2v10" /></svg>{/snippet}
		</RibbonCommand>
	</RibbonGroup>

	<RibbonGroup label={t('pptx.view.masterViews')}>
		<RibbonCommand
			label={t('pptx.master.title')}
			title={t('pptx.view.slideMasterTooltip')}
			disabled={!editor.editable}
			onclick={() => onentermasterview?.()}
		>
			{#snippet icon()}<svg viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="11" rx="1" /><path d="M6 8h8M6 11h5M5 2v3M15 2v3" /></svg>{/snippet}
		</RibbonCommand>
		<RibbonCommand label={t('pptx.master.handoutMasterTitle')} disabled>
			{#snippet icon()}<svg viewBox="0 0 20 20"><rect x="3" y="3" width="6" height="6" /><rect x="11" y="3" width="6" height="6" /><rect x="3" y="11" width="6" height="6" /><rect x="11" y="11" width="6" height="6" /></svg>{/snippet}
		</RibbonCommand>
		<RibbonCommand label={t('pptx.master.notesMasterTitle')} disabled>
			{#snippet icon()}<svg viewBox="0 0 20 20"><rect x="4" y="2.5" width="12" height="15" rx="1" /><path d="M7 6h6M7 9h6M7 12h4" /></svg>{/snippet}
		</RibbonCommand>
	</RibbonGroup>

	<RibbonGroup label={t('pptx.view.show')}>
		<ViewShowGroup
			{editor}
			{preferences}
			ontogglepreference={togglePreference}
			{showGuides}
			{snapToShape}
			onguideschange={onshowguideschange}
			onsnaptoshapechange={onsnapToShapechange}
			{onaddguide}
			{onselectionpane}
		/>
	</RibbonGroup>

	<RibbonGroup label={t('pptx.slideSorter.zoom')}>
		<RibbonCommand label={t('pptx.slideSorter.zoom')} disabled>
			{#snippet icon()}<svg viewBox="0 0 20 20"><circle cx="9" cy="9" r="5.5" /><path d="m13 13 4 4M6.8 9h4.4M9 6.8v4.4" /></svg>{/snippet}
		</RibbonCommand>
		<RibbonCommand label={t('pptx.view.zoomToFit')} title={t('pptx.view.zoomToFitTooltip')} onclick={onzoomfit}>
			{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5" /></svg>{/snippet}
		</RibbonCommand>
	</RibbonGroup>

	<RibbonGroup label={t('pptx.view.window')}>
		<RibbonCommand
			label={t(editTemplateMode ? 'pptx.ribbon.templatesOn' : 'pptx.ribbon.templatesOff')}
			title={t('pptx.view.templateEditingTooltip')}
			testid="template-edit-toggle"
			active={editTemplateMode}
			disabled={!editor.editable}
			onclick={() => onsettemplateediting?.(!editTemplateMode)}
		>
			{#snippet icon()}<svg viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="12" rx="1" /><path d="M6 2v3M14 2v3M6 13h8" /></svg>{/snippet}
		</RibbonCommand>
		<RibbonCommand label={t('pptx.view.macros')} disabled>
			{#snippet icon()}<svg viewBox="0 0 20 20"><path d="m7 6-4 4 4 4M13 6l4 4-4 4" /></svg>{/snippet}
		</RibbonCommand>
	</RibbonGroup>
</div>

<style>
	.pptx-svelte-viewtab {
		display: flex;
		align-items: stretch;
		flex-wrap: nowrap;
	}
</style>
