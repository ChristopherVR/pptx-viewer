<script lang="ts">
	/**
	 * Thin adapter around the shared `pptx-ui-context-menu`: it hands the controlled
	 * state to the element and routes its typed events to the host's callbacks. The
	 * host keeps each menu's entries, gating and command handlers.
	 */
	import type { ContextMenuRequestEvent, ContextMenuViewItem, ContextMenuViewState } from 'pptx-viewer-shared';

	const {
		x,
		y,
		label,
		items,
		markers,
		zIndex,
		onrequest,
		onclose,
	}: {
		x: number;
		y: number;
		label: string;
		items: readonly ContextMenuViewItem[];
		markers?: readonly string[];
		zIndex?: number;
		/** A row was activated. The host runs the command and closes the menu. */
		onrequest: (id: string) => void;
		/** The user dismissed the menu (Escape, an outside press or Tab). */
		onclose: () => void;
	} = $props();

	const state = $derived<ContextMenuViewState>({ x, y, label, items, markers, zIndex });
</script>

<pptx-ui-context-menu
	{state}
	onmenu-request={(event: Event) => onrequest((event as ContextMenuRequestEvent).detail.id)}
	onmenu-close={() => onclose()}
></pptx-ui-context-menu>
