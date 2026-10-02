<script lang="ts">
	/**
	 * Desktop status bar, docked beneath the slide/notes area. A thin adapter around
	 * the shared `pptx-ui-status-bar`: it maps viewer state onto the element and routes
	 * typed intents to the callbacks. Kept independent from the top toolbar so
	 * read-only viewers retain PowerPoint's navigation and zoom chrome.
	 */
	import { resolveStatusBarSave } from 'pptx-viewer-shared';
	import type { StatusBarRequestEvent, StatusBarViewState } from 'pptx-viewer-shared';
	import type { Snippet } from 'svelte';
	import { useTranslator } from '../../i18n/context';
	import type { AutosaveStatus } from '../state/autosave.svelte';

	const {
		current,
		total,
		zoomPercent,
		isDirty,
		autosaveStatus,
		showNotes = false,
		notesExpanded = false,
		isFullscreen = false,
		slideSorterActive = false,
		onzoomin,
		onzoomout,
		onzoomfit,
		onfullscreen,
		onnotestoggle,
		onnormal,
		onslidesorter,
		collaborationSlot,
		hideZoom = false,
		hideFullscreen = false,
	}: {
		current: number;
		total: number;
		zoomPercent: number;
		isDirty: boolean;
		autosaveStatus?: AutosaveStatus;
		showNotes?: boolean;
		notesExpanded?: boolean;
		isFullscreen?: boolean;
		slideSorterActive?: boolean;
		onzoomin: () => void;
		onzoomout: () => void;
		onzoomfit: () => void;
		onfullscreen: () => void;
		onnotestoggle?: () => void;
		onnormal?: () => void;
		onslidesorter?: () => void;
		collaborationSlot?: Snippet;
		/** Hide the zoom cluster (`hiddenActions: ['zoom']`). */
		hideZoom?: boolean;
		/** Hide the Slide Show toggle (`hiddenActions: ['fullscreen']`). */
		hideFullscreen?: boolean;
	} = $props();

	const t = useTranslator();
	const save = $derived(
		resolveStatusBarSave(t, autosaveStatus ? { state: autosaveStatus } : undefined, isDirty),
	);
	// "Normal" is active whenever neither the slide sorter nor the slideshow is up.
	const state = $derived<StatusBarViewState>({
		slideCount: total,
		activeSlideIndex: current,
		saveText: save.text,
		saveKind: save.kind,
		zoomPercent: hideZoom ? undefined : zoomPercent,
		showNotes,
		notesExpanded,
		showSorter: Boolean(onslidesorter),
		showSlideShow: !hideFullscreen,
		viewMode: isFullscreen ? 'slideShow' : slideSorterActive ? 'sorter' : 'normal',
		translate: t,
	});
	function request(event: StatusBarRequestEvent): void {
		const handlers = {
			notes: onnotestoggle,
			normal: onnormal,
			sorter: onslidesorter,
			slideShow: onfullscreen,
			zoomOut: onzoomout,
			zoomFit: onzoomfit,
			zoomIn: onzoomin,
		};
		handlers[event.detail.id]?.();
	}
</script>

<!--
	No landmark role here, matching the other four bindings: the row is a mixed
	region of live readouts and controls, not a toolbar. The class lets the viewer
	hide the bar on phones, where the mobile bottom bar replaces it.
-->
<pptx-ui-status-bar class="pptx-svelte-statusbar" {state} onstatus-request={request}>
	{#if collaborationSlot}
		<div slot="collaboration" style="display:contents">{@render collaborationSlot()}</div>
	{/if}
</pptx-ui-status-bar>
