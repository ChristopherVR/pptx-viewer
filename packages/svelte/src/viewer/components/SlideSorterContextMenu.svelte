<script lang="ts">
	/**
	 * The slide sorter's tile right-click menu: Copy, Paste (while something is
	 * copied), Duplicate, Hide/Show, Delete. The command list, the Hide/Show
	 * toggle, the count suffix and the Delete gating come from
	 * `pptx-viewer-shared`'s `buildSlideSorterContextMenuEntries`; this component
	 * only renders it, like `ThumbnailContextMenu.svelte` does for the rail.
	 */
	import {
		buildSlideSorterContextMenuEntries,
		clampFlyoutPosition,
		slideSorterContextMenuLabel,
	} from 'pptx-viewer-shared';
	import type { SlideSorterContextMenuCommandId } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';

	const {
		x,
		y,
		hidden,
		hasClipboard,
		totalSlides,
		onrun,
		onclose,
	}: {
		x: number;
		y: number;
		/** The right-clicked slide is hidden. */
		hidden: boolean;
		hasClipboard: boolean;
		totalSlides: number;
		onrun: (id: SlideSorterContextMenuCommandId) => void;
		onclose: () => void;
	} = $props();
	const t = useTranslator();

	const entries = $derived(
		buildSlideSorterContextMenuEntries({
			selectedCount: 1,
			hasClipboard,
			hasHiddenInSelection: hidden,
			hasVisibleInSelection: !hidden,
			wouldDeleteAllSlides: totalSlides <= 1,
		}),
	);

	let menuWidth = $state(0);
	let menuHeight = $state(0);
	const menuStyle = $derived.by(() => {
		const { left, top } = clampFlyoutPosition({
			x,
			y,
			width: menuWidth,
			height: menuHeight,
			viewportWidth: typeof window === 'undefined' ? 0 : window.innerWidth,
			viewportHeight: typeof window === 'undefined' ? 0 : window.innerHeight,
		});
		return `left: ${left}px; top: ${top}px`;
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="pptx-svelte-context-backdrop"
	aria-hidden="true"
	onclick={onclose}
	oncontextmenu={(event) => {
		event.preventDefault();
		onclose();
	}}
></div>
<div
	class="pptx-svelte-context-menu"
	data-pptx-context-menu="true"
	data-pptx-sorter-context-menu="true"
	role="menu"
	aria-label={t('pptx.slideSorter.title')}
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
			onclick={() => onrun(entry.id)}
		>
			{slideSorterContextMenuLabel(t(entry.labelKey), entry, 1)}
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
