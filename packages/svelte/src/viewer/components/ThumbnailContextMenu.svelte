<script lang="ts">
	/**
	 * The slides rail's thumbnail right-click menu: New Slide, Duplicate,
	 * Delete, Layout, Hide, Add Section. Sibling of `CanvasContextMenu.svelte`.
	 * The item list comes from `pptx-viewer-shared`'s `buildSlidePaneContextMenuEntries`
	 * (via `ThumbnailRailMenu#menuEntries`); the rows are drawn by the shared
	 * `pptx-ui-context-menu`.
	 */
	import { slidePaneViewItems } from 'pptx-viewer-shared';
	import type { SlidePaneContextMenuCommandId } from 'pptx-viewer-shared';
	import type { PptxSlide } from 'pptx-viewer-core';

	import { useTranslator } from '../../i18n/context';
	import ContextMenuSurface from './ContextMenuSurface.svelte';
	import type { ThumbnailRailMenu, ThumbnailRailMenuActions } from './thumbnail-rail-menu.svelte';

	const {
		menu,
		slides,
		actions,
	}: {
		menu: ThumbnailRailMenu;
		slides: readonly PptxSlide[];
		actions: ThumbnailRailMenuActions;
	} = $props();
	const t = useTranslator();

	const menuState = $derived(menu.contextMenu);
	const entries = $derived(menu.menuEntries(slides));
</script>

{#if menuState}
	<ContextMenuSurface
		x={menuState.x}
		y={menuState.y}
		label={t('pptx.slidesPane.contextMenu.newSlide')}
		markers={['data-pptx-context-menu', 'data-pptx-slide-pane-context-menu']}
		items={slidePaneViewItems(entries, t, menuState.selectedIndexes.length)}
		onrequest={(id) => menu.run(id as SlidePaneContextMenuCommandId, actions)}
		onclose={() => menu.closeContextMenu()}
	/>
{/if}
