<script lang="ts">
	/**
	 * EditPointsMenu: the Edit Points right-click menu (a vertex or a segment).
	 * Entries, order, greying and checks come from the shared session; this is
	 * the Svelte paint, styled like `ElementContextMenu`.
	 *
	 * Rendered inside the scaled overlay at the click's slide position and
	 * scaled back by `inverseScale`, so it stays screen-sized at every zoom
	 * (a `position: fixed` child of the transformed layer would be placed
	 * relative to that layer, not the viewport).
	 */
	import type { EditPointsCommandId, EditPointsMenuView } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';

	const { menu, onrun }: { menu: EditPointsMenuView; onrun: (id: EditPointsCommandId) => void } =
		$props();
	const t = useTranslator();

	function stop(event: Event): void {
		event.stopPropagation();
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
	class="pptx-svelte-edit-points-menu"
	role="menu"
	aria-label={t('pptx.editPoints.menu')}
	data-pptx-edit-points-menu="true"
	style={`left: ${menu.x}px; top: ${menu.y}px; transform: scale(${menu.inverseScale}); transform-origin: 0 0`}
	onpointerdown={stop}
	onmousedown={stop}
	onclick={stop}
	oncontextmenu={(event) => {
		event.preventDefault();
		event.stopPropagation();
	}}
>
	{#each menu.entries as entry (entry.id)}
		{#if entry.separatorBefore}<div class="pptx-svelte-edit-points-separator" role="separator"></div>{/if}
		<div role="none" data-pptx-edit-points-command={entry.id}>
			<button
				type="button"
				role={entry.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
				aria-checked={entry.checked === undefined ? undefined : entry.checked}
				disabled={entry.disabled}
				onclick={() => onrun(entry.id)}
			>
				{#if entry.checked !== undefined}<span class="pptx-svelte-edit-points-check" aria-hidden="true">{entry.checked ? '✓' : ''}</span>{/if}
				{t(entry.labelKey)}
			</button>
		</div>
	{/each}
</div>

<style>
	.pptx-svelte-edit-points-menu { position: absolute; z-index: 61; pointer-events: auto; display: flex; min-width: 180px; flex-direction: column; padding: 6px 0; border: 1px solid var(--pptx-border, #33334d); border-radius: var(--pptx-radius, 6px); background: var(--pptx-card, #1e1e2e); box-shadow: 0 18px 40px rgb(0 0 0 / 35%); color: var(--pptx-card-foreground, #e2e8f0); font-family: system-ui, sans-serif; font-size: 12px; }
	.pptx-svelte-edit-points-menu button { width: 100%; padding: 6px 12px; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
	.pptx-svelte-edit-points-menu button:hover, .pptx-svelte-edit-points-menu button:focus-visible { background: var(--pptx-accent, #33334d); outline: none; }
	.pptx-svelte-edit-points-menu button:disabled { opacity: 0.45; cursor: default; }
	.pptx-svelte-edit-points-menu button:disabled:hover { background: transparent; }
	.pptx-svelte-edit-points-separator { height: 1px; margin: 5px 0; background: var(--pptx-border, #33334d); }
	.pptx-svelte-edit-points-check { display: inline-block; width: 12px; margin-right: 6px; }
</style>
