<script lang="ts">
	/**
	 * Editable-element context menu. This is intentionally limited to actions
	 * already implemented by the Svelte editor, rather than presenting React's
	 * unfinished table/comment commands as inert controls.
	 */
	import { useTranslator } from '../../i18n/context';
	import type { ElementContextMenuProps } from './props';

	const { x, y, editor, onclose }: ElementContextMenuProps = $props();
	const t = useTranslator();

	const menuStyle = $derived(`left: ${Math.max(x, 8)}px; top: ${Math.max(y, 8)}px`);

	function act(action: () => void): void {
		action();
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
<div class="pptx-svelte-context-menu" role="menu" aria-label={t('pptx.canvas.slide')} style={menuStyle}>
	<button type="button" role="menuitem" onclick={() => act(() => editor.clipboardOps.copySelected())}>{t('pptx.contextMenu.copy')}</button>
	<button type="button" role="menuitem" onclick={() => act(() => editor.clipboardOps.cutSelected())}>{t('pptx.contextMenu.cut')}</button>
	<button type="button" role="menuitem" onclick={() => act(() => void editor.clipboardOps.pasteClipboard())}>{t('pptx.contextMenu.paste')}</button>
	<button type="button" role="menuitem" onclick={() => act(() => editor.duplicateSelected())}>{t('pptx.contextMenu.duplicate')}</button>
	<div class="pptx-svelte-context-separator" role="separator"></div>
	<button type="button" role="menuitem" onclick={() => act(() => editor.reorderSelected('forward'))}>{t('pptx.contextMenu.bringForward')}</button>
	<button type="button" role="menuitem" onclick={() => act(() => editor.reorderSelected('backward'))}>{t('pptx.contextMenu.sendBackward')}</button>
	<button type="button" role="menuitem" onclick={() => act(() => editor.reorderSelected('front'))}>{t('pptx.contextMenu.bringToFront')}</button>
	<button type="button" role="menuitem" onclick={() => act(() => editor.reorderSelected('back'))}>{t('pptx.contextMenu.sendToBack')}</button>
	<div class="pptx-svelte-context-separator" role="separator"></div>
	<button type="button" role="menuitem" class="pptx-svelte-context-delete" onclick={() => act(() => editor.deleteSelected())}>{t('pptx.contextMenu.delete')}</button>
</div>

<style>
	.pptx-svelte-context-backdrop { position: fixed; inset: 0; z-index: 119; }
	.pptx-svelte-context-menu { position: fixed; z-index: 120; display: flex; min-width: 180px; flex-direction: column; padding: 6px 0; border: 1px solid var(--pptx-border, #33334d); border-radius: var(--pptx-radius, 6px); background: var(--pptx-card, #1e1e2e); box-shadow: 0 18px 40px rgb(0 0 0 / 35%); color: var(--pptx-card-foreground, #e2e8f0); font-family: system-ui, sans-serif; font-size: 12px; }
	.pptx-svelte-context-menu button { padding: 6px 12px; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
	.pptx-svelte-context-menu button:hover, .pptx-svelte-context-menu button:focus-visible { background: var(--pptx-accent, #33334d); outline: none; }
	.pptx-svelte-context-separator { height: 1px; margin: 5px 0; background: var(--pptx-border, #33334d); }
	.pptx-svelte-context-menu .pptx-svelte-context-delete { color: #fca5a5; }
</style>
