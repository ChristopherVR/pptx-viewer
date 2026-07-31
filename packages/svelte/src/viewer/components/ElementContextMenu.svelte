<script lang="ts">
	/**
	 * Editable-element context menu.
	 *
	 * The items are not decided here: `buildEditorContextMenuEntries` asks the
	 * shared `buildContextMenuEntries` (the one definition all five bindings
	 * render) what to offer, and this component positions it, renders it, and
	 * hands the chosen command id back to the dispatch. It used to hand-write
	 * its own list, which is how it shipped with no Group, Ungroup, Add Comment,
	 * Edit Hyperlink, and no table commands at all.
	 */
	import type { ContextMenuCommandId } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import {
		buildEditorContextMenuEntries,
		runContextMenuCommand,
	} from '../editor/context-menu-dispatch';
	import type { ElementContextMenuProps } from './props';

	const {
		x,
		y,
		editor,
		cell = null,
		onaskai,
		onfixai,
		oncomment,
		onhyperlink,
		onclose,
	}: ElementContextMenuProps = $props();
	const t = useTranslator();

	const menuStyle = $derived(`left: ${Math.max(x, 8)}px; top: ${Math.max(y, 8)}px`);
	const dispatch = $derived({
		editor,
		cell,
		onAskAi: onaskai,
		onFixAi: onfixai,
		onComment: oncomment,
		onHyperlink: onhyperlink,
	});
	const entries = $derived(buildEditorContextMenuEntries(dispatch));

	function run(id: ContextMenuCommandId): void {
		runContextMenuCommand(id, dispatch);
		onclose();
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') onclose();
	}}
/>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="pptx-svelte-context-backdrop" aria-hidden="true" onclick={onclose} oncontextmenu={(event) => { event.preventDefault(); onclose(); }}></div>
<!-- `data-pptx-context-menu` is the neutral cross-binding hook for "this is the
     canvas context menu"; the aria-label names it as one (it used to borrow the
     slide's label, so a screen reader announced the menu as "Slide"). -->
<div
	class="pptx-svelte-context-menu"
	data-pptx-context-menu="true"
	role="menu"
	aria-label={t('pptx.contextMenu.ariaLabel')}
	style={menuStyle}
>
	{#each entries as entry (entry.id)}
		{#if entry.separatorBefore}<div class="pptx-svelte-context-separator" role="separator"></div>{/if}
		<button type="button" role="menuitem" class:pptx-svelte-context-delete={entry.danger} disabled={entry.disabled} onclick={() => run(entry.id)}>{t(entry.labelKey)}</button>
	{/each}
</div>

<style>
	.pptx-svelte-context-backdrop { position: fixed; inset: 0; z-index: 119; }
	.pptx-svelte-context-menu { position: fixed; z-index: 120; display: flex; min-width: 180px; flex-direction: column; padding: 6px 0; border: 1px solid var(--pptx-border, #33334d); border-radius: var(--pptx-radius, 6px); background: var(--pptx-card, #1e1e2e); box-shadow: 0 18px 40px rgb(0 0 0 / 35%); color: var(--pptx-card-foreground, #e2e8f0); font-family: system-ui, sans-serif; font-size: 12px; }
	.pptx-svelte-context-menu button { padding: 6px 12px; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
	.pptx-svelte-context-menu button:hover, .pptx-svelte-context-menu button:focus-visible { background: var(--pptx-accent, #33334d); outline: none; }
	.pptx-svelte-context-menu button:disabled { opacity: 0.45; cursor: default; }
	.pptx-svelte-context-menu button:disabled:hover { background: transparent; }
	.pptx-svelte-context-separator { height: 1px; margin: 5px 0; background: var(--pptx-border, #33334d); }
	.pptx-svelte-context-menu .pptx-svelte-context-delete { color: #fca5a5; }
</style>
