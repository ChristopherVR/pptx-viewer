<script lang="ts">
	/**
	 * Desktop PowerPoint chrome above the editing ribbon: a thin adapter around the
	 * shared `pptx-ui-title-bar`. It maps viewer state onto the element and routes
	 * typed events to the callbacks; command dispatch and document mutation stay in
	 * the viewer host.
	 */
	import type { TitleBarEventDetails, ToolbarActionId } from 'pptx-viewer-shared';
	import type { Snippet } from 'svelte';

	import { useTranslator } from '../../i18n/context';
	import type { AutosaveStatus } from '../state/autosave.svelte';
	import { useViewerCustomization } from '../state/viewer-customization.svelte';
	import { useViewerOptions } from '../state/viewer-options-context';
	import { routeCommandSearch, titleBarViewState } from './title-bar-adapter';

	const {
		fileName,
		editable,
		isDirty,
		autosaveEnabled,
		autosaveStatus,
		autosaveDisabledReason,
		undoLabel,
		redoLabel,
		canUndo,
		canRedo,
		onautosavetoggle,
		onsave,
		onundo,
		onredo,
		onfindreplace,
		oncommand,
		onquickcommand,
		hiddenActions,
		autosaveToggleAvailable = true,
		collaborationSlot,
		accountSlot,
	}: {
		fileName?: string;
		editable: boolean;
		isDirty: boolean;
		autosaveEnabled: boolean;
		autosaveStatus?: AutosaveStatus;
		canUndo: boolean;
		canRedo: boolean;
		/** Kept for API compatibility; the shared element does not need it. */
		findReplaceOpen?: boolean;
		onautosavetoggle: () => void;
		onsave: () => void;
		onundo: () => void;
		onredo: () => void;
		onfindreplace: () => void;
		oncommand?: (command: string) => void;
		/** Run a Quick Access command other than Save/Undo/Redo, by catalog id. */
		onquickcommand?: (id: string) => void;
		/** The viewer's effective hidden actions (`undo` / `redo` gate their buttons). */
		hiddenActions?: readonly ToolbarActionId[];
		/** False when the host policy forbids autosave (the switch renders inert). */
		autosaveToggleAvailable?: boolean;
		/** Why autosave is off while `autosaveStatus` is 'disabled'. */
		autosaveDisabledReason?: string;
		/** Pending-action descriptions for the Undo/Redo tooltips. */
		undoLabel?: string | null;
		redoLabel?: string | null;
		collaborationSlot?: Snippet;
		accountSlot?: Snippet;
	} = $props();

	const t = useTranslator();
	const customization = useViewerCustomization();
	const optionsState = useViewerOptions();
	const state = $derived({
		...titleBarViewState({
			editable,
			fileName,
			isDirty,
			autosaveEnabled,
			autosaveStatus,
			autosaveReason: autosaveDisabledReason,
			canUndo,
			canRedo,
			undoLabel,
			redoLabel,
			hiddenActions,
			quickAccess: optionsState.options.quickAccess,
			quickAccessAllowed: customization.isPanelVisible('quickAccessToolbar'),
			screenTip: (label) => optionsState.screenTip(label),
			translate: t,
		}),
	});
	const viewState = $derived({
		...state,
		autosave: { ...state.autosave, toggleAvailable: autosaveToggleAvailable },
	});
	const detail = <K extends keyof TitleBarEventDetails>(event: Event) =>
		(event as CustomEvent<TitleBarEventDetails[K]>).detail;
</script>

<pptx-ui-title-bar
	state={viewState}
	ontoggle-autosave={() => onautosavetoggle()}
	onsave={() => onsave()}
	onundo={() => onundo()}
	onredo={() => onredo()}
	onquick-command={(event: Event) => onquickcommand?.(detail<'quick-command'>(event).id)}
	oncommand-search={(event: Event) =>
		routeCommandSearch(detail<'command-search'>(event), oncommand, onfindreplace)}
>
	{#if collaborationSlot}
		<div slot="collaboration" style="display:contents">{@render collaborationSlot()}</div>
	{/if}
	{#if accountSlot}
		<div slot="account" style="display:contents">{@render accountSlot()}</div>
	{/if}
</pptx-ui-title-bar>
