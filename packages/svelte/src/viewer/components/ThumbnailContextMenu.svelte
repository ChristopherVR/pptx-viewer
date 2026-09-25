<script lang="ts">
	/**
	 * The slides rail's thumbnail right-click menu: New Slide, Duplicate,
	 * Delete, Layout, Hide, Add Section. Sibling of `CanvasContextMenu.svelte`.
	 * The item list comes from `pptx-viewer-shared`'s `buildSlidePaneContextMenuEntries`
	 * (via `ThumbnailRailMenu#menuEntries`), this component only renders it.
	 */
	import { clampFlyoutPosition } from 'pptx-viewer-shared';
	import type { SlidePaneContextMenuCommandId } from 'pptx-viewer-shared';
	import type { PptxSlide } from 'pptx-viewer-core';

	import { useTranslator } from '../../i18n/context';
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

	const menuState = $derived(menu.contextMenu!);
	const entries = $derived(menu.menuEntries(slides));
	const selectedCount = $derived(menuState.selectedIndexes.length);

	let menuWidth = $state(0);
	let menuHeight = $state(0);
	const menuStyle = $derived.by(() => {
		const { left, top } = clampFlyoutPosition({
			x: menuState.x,
			y: menuState.y,
			width: menuWidth,
			height: menuHeight,
			viewportWidth: typeof window === 'undefined' ? 0 : window.innerWidth,
			viewportHeight: typeof window === 'undefined' ? 0 : window.innerHeight,
		});
		return `left: ${left}px; top: ${top}px`;
	});

	function run(id: SlidePaneContextMenuCommandId): void {
		menu.run(id, actions);
	}

	function close(): void {
		menu.closeContextMenu();
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') close();
	}}
/>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="pptx-svelte-context-backdrop" aria-hidden="true" onclick={close} oncontextmenu={(event) => { event.preventDefault(); close(); }}></div>
<div
	class="pptx-svelte-context-menu"
	data-pptx-context-menu="true"
	data-pptx-slide-pane-context-menu="true"
	role="menu"
	aria-label={t('pptx.slidesPane.contextMenu.newSlide')}
	style={menuStyle}
	bind:clientWidth={menuWidth}
	bind:clientHeight={menuHeight}
>
	{#each entries as entry (entry.id)}
		{#if entry.separatorBefore}<div class="pptx-svelte-context-separator" role="separator"></div>{/if}
		<button
			type="button"
			role="menuitem"
			class:pptx-svelte-context-delete={entry.id === 'delete'}
			disabled={entry.disabled}
			onclick={() => run(entry.id)}
		>
			{entry.countLabelKey ? t(entry.labelKey, { count: selectedCount }) : t(entry.labelKey)}
		</button>
	{/each}
</div>

<style>
	.pptx-svelte-context-backdrop { position: fixed; inset: 0; z-index: 119; }
	.pptx-svelte-context-menu { position: fixed; z-index: 120; display: flex; min-width: 190px; flex-direction: column; padding: 6px 0; border: 1px solid var(--pptx-border, #33334d); border-radius: var(--pptx-radius, 6px); background: var(--pptx-card, #1e1e2e); box-shadow: 0 18px 40px rgb(0 0 0 / 35%); color: var(--pptx-card-foreground, #e2e8f0); font-family: system-ui, sans-serif; font-size: 12px; }
	.pptx-svelte-context-menu button { padding: 6px 12px; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
	.pptx-svelte-context-menu button:hover, .pptx-svelte-context-menu button:focus-visible { background: var(--pptx-accent, #33334d); outline: none; }
	.pptx-svelte-context-menu button:disabled { opacity: 0.45; cursor: default; }
	.pptx-svelte-context-menu button:disabled:hover { background: transparent; }
	.pptx-svelte-context-separator { height: 1px; margin: 5px 0; background: var(--pptx-border, #33334d); }
	.pptx-svelte-context-menu .pptx-svelte-context-delete { color: #fca5a5; }
</style>
