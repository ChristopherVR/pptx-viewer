<script lang="ts">
	/**
	 * The slides rail's section-header right-click menu: Rename, Delete, Move
	 * Up, Move Down, Add Section After. The command list, separators and
	 * end-of-list gating come from `pptx-viewer-shared`'s
	 * `buildSectionContextMenuEntries`; this component only renders it, the
	 * sibling of `ThumbnailContextMenu.svelte`.
	 */
	import { buildSectionContextMenuEntries, clampFlyoutPosition } from 'pptx-viewer-shared';
	import type { SectionContextMenuCommandId } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';

	const {
		x,
		y,
		sectionIndex,
		totalSections,
		onrun,
		onclose,
	}: {
		x: number;
		y: number;
		sectionIndex: number;
		totalSections: number;
		onrun: (id: SectionContextMenuCommandId) => void;
		onclose: () => void;
	} = $props();
	const t = useTranslator();

	const entries = $derived(buildSectionContextMenuEntries({ sectionIndex, totalSections }));

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

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') onclose();
	}}
/>

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
	data-pptx-section-context-menu="true"
	role="menu"
	aria-label={t('pptx.sections.sectionButtonLabel')}
	style={menuStyle}
	bind:clientWidth={menuWidth}
	bind:clientHeight={menuHeight}
>
	{#each entries as entry (entry.id)}
		{#if entry.separatorBefore}<div class="pptx-svelte-context-separator" role="separator"></div>{/if}
		<button type="button" role="menuitem" disabled={entry.disabled} onclick={() => onrun(entry.id)}>
			{t(entry.labelKey)}
		</button>
	{/each}
</div>

<style>
	.pptx-svelte-context-backdrop { position: fixed; inset: 0; z-index: 119; }
	.pptx-svelte-context-menu { position: fixed; z-index: 120; display: flex; min-width: 160px; flex-direction: column; padding: 6px 0; border: 1px solid var(--pptx-border, #33334d); border-radius: var(--pptx-radius, 6px); background: var(--pptx-card, #1e1e2e); box-shadow: 0 18px 40px rgb(0 0 0 / 35%); color: var(--pptx-card-foreground, #e2e8f0); font-family: system-ui, sans-serif; font-size: 12px; }
	.pptx-svelte-context-menu button { padding: 6px 12px; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
	.pptx-svelte-context-menu button:hover, .pptx-svelte-context-menu button:focus-visible { background: var(--pptx-accent, #33334d); outline: none; }
	.pptx-svelte-context-menu button:disabled { opacity: 0.45; cursor: default; }
	.pptx-svelte-context-menu button:disabled:hover { background: transparent; }
	.pptx-svelte-context-separator { height: 1px; margin: 5px 0; background: var(--pptx-border, #33334d); }
</style>
