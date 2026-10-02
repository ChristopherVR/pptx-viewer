<script lang="ts">
	/**
	 * Phone toolbar matching React's compact top-row action placement. A thin
	 * adapter around the shared `pptx-ui-mobile-toolbar`, which owns the markup,
	 * order and gating of the row.
	 */
	import { isActionHidden } from 'pptx-viewer-shared';
	import type {
		MobileToolbarId,
		MobileToolbarRequestEvent,
		MobileToolbarViewState,
		ToolbarActionId,
	} from 'pptx-viewer-shared';
	import { useTranslator } from '../../i18n/context';

	const {
		editable,
		canUndo,
		canRedo,
		onmenu,
		onundo,
		onredo,
		onsave,
		onpresent,
		onshare,
		onai,
		aiActive = false,
		hiddenActions,
	}: {
		editable: boolean;
		canUndo: boolean;
		canRedo: boolean;
		onmenu: () => void;
		onundo: () => void;
		onredo: () => void;
		onsave: () => void;
		onpresent: () => void;
		onshare: () => void;
		/** AI assistant toggle. Undefined when the host has not opted into `ai`. */
		onai?: () => void;
		aiActive?: boolean;
		hiddenActions?: ToolbarActionId[];
	} = $props();

	const t = useTranslator();
	const view = $derived.by<MobileToolbarViewState>(() => {
		const hidden: MobileToolbarId[] = [];
		for (const [id, action] of [
			['undo', 'undo'],
			['redo', 'redo'],
			['present', 'fullscreen'],
			['share', 'share'],
		] as const) {
			if (isActionHidden(action, hiddenActions)) {
				hidden.push(id);
			}
		}
		return { editable, canUndo, canRedo, aiVisible: Boolean(onai), aiActive, hidden, translate: t };
	});
	function request(event: MobileToolbarRequestEvent): void {
		const handlers = {
			menu: onmenu,
			undo: onundo,
			redo: onredo,
			ai: onai,
			save: onsave,
			present: onpresent,
			share: onshare,
		};
		handlers[event.detail.id]?.();
	}
</script>

<pptx-ui-mobile-toolbar
	class="pptx-svelte-mobile-toolbar"
	state={view}
	onmobile-toolbar-request={request}
></pptx-ui-mobile-toolbar>

<style>
	.pptx-svelte-mobile-toolbar { display: none; }
	@media (max-width: 767px), (max-width: 1023px) and (max-height: 520px) {
		.pptx-svelte-mobile-toolbar { display: block; }
	}
</style>
