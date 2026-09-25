<script lang="ts">
	/**
	 * ViewerStatusBar: the bottom status bar plus the collaboration connection
	 * indicator it slots in. Split out of `PowerPointViewer.svelte` to keep that
	 * file under the repo's file-size budget; state stays owned by the viewer's
	 * composition bag.
	 */
	import { isActionHidden } from 'pptx-viewer-shared';
	import type { CollaborationConfig, ToolbarActionId } from 'pptx-viewer-shared';

	import CollaborationStatusIndicator from '../collab/components/CollaborationStatusIndicator.svelte';
	import type { ViewerStateBag } from '../state/create-viewer-state-types';
	import { useViewerCustomization } from '../state/viewer-customization.svelte';
	import StatusBar from './StatusBar.svelte';

	interface ViewerStatusBarProps {
		vm: ViewerStateBag;
		/** Host `showNotes` prop; the notes toggle also needs a loaded deck. */
		showNotes: boolean;
		/** Host collaboration config, replayed by the indicator's retry button. */
		collaboration?: CollaborationConfig;
		/** The viewer's effective hidden actions (`zoom`, `notes`, `fullscreen`). */
		hiddenActions?: readonly ToolbarActionId[];
	}

	const { vm, showNotes, collaboration, hiddenActions }: ViewerStatusBarProps = $props();
	const customization = useViewerCustomization();

	// Stable controller references (the bag is built once and never reassigned).
	// svelte-ignore state_referenced_locally
	const { loader, viewer, editor, parityUi, collab, dialogs, autosaveCtl } = vm;
</script>

{#snippet collabStatus()}
	<CollaborationStatusIndicator
		status={collab.status}
		connectedCount={dialogs.connectedCount}
		onretry={() => dialogs.retry(collaboration)}
	/>
{/snippet}
<StatusBar
	current={viewer.current}
	total={viewer.slideCount}
	zoomPercent={vm.effectivePercent}
	isDirty={editor.dirty}
	autosaveStatus={vm.autosaveActive ? autosaveCtl.status : undefined}
	showNotes={showNotes && loader.slides.length > 0 && !isActionHidden('notes', hiddenActions)}
	hideZoom={isActionHidden('zoom', hiddenActions)}
	hideFullscreen={isActionHidden('fullscreen', hiddenActions)}
	notesExpanded={vm.notesExpanded}
	isFullscreen={viewer.isFullscreen}
	slideSorterActive={parityUi.slideSorterOpen}
	onzoomin={() => viewer.zoomIn(vm.effectivePercent)}
	onzoomout={() => viewer.zoomOut(vm.effectivePercent)}
	onzoomfit={() => viewer.zoomToFit()}
	onfullscreen={vm.onFullscreenToggle}
	onnotestoggle={vm.onNotesToggle}
	onnormal={() => {
		if (viewer.isFullscreen) {
			vm.onFullscreenToggle();
		}
		parityUi.slideSorterOpen = false;
		parityUi.readingViewOpen = false;
		parityUi.outlineViewOpen = false;
	}}
	onslidesorter={() => (parityUi.slideSorterOpen = true)}
	collaborationSlot={collab.active && customization.isDialogAvailable('share') ? collabStatus : undefined}
/>
