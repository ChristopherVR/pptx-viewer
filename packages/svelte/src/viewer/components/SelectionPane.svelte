<script lang="ts">
	import BringToFront from '@lucide/svelte/icons/bring-to-front';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import SendToBack from '@lucide/svelte/icons/send-to-back';
	import X from '@lucide/svelte/icons/x';
	import type { PptxElement } from 'pptx-viewer-core';
	import { isElementHidden } from 'pptx-viewer-shared';
	import type { EditorState } from '../editor/editor-state.svelte'; import { useTranslator } from '../../i18n/context';

	const { editor, onclose }: { editor: EditorState; onclose: () => void } = $props(); const t = useTranslator();
	const elements = $derived(editor.activeElements);

	/**
	 * Flip an element's Selection Pane visibility. Svelte was the only binding
	 * whose pane listed objects without the eye toggle the other four ship, so
	 * hiding a shape was simply unreachable here.
	 */
	function toggleHidden(id: string, hidden: boolean): void {
		editor.applyElementPatch(id, { hidden: !hidden });
	}

	// ── Inline rename (double-click a row's name label, as in React) ────────
	let renamingId = $state<string | null>(null);
	let renameValue = $state('');

	function beginRename(element: PptxElement): void {
		renamingId = element.id;
		renameValue = element.name ?? '';
	}
	/** Commit the trimmed name through the history-integrated patch channel. */
	function commitRename(): void {
		if (renamingId === null) { return; }
		const name = renameValue.trim();
		editor.applyElementPatch(renamingId, { name: name.length > 0 ? name : undefined });
		renamingId = null;
	}
	function renameKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') { event.preventDefault(); commitRename(); }
		else if (event.key === 'Escape') { event.stopPropagation(); renamingId = null; }
	}
	/** Svelte action: focus + select the rename input the moment it mounts. */
	function autofocus(node: HTMLInputElement): void {
		node.focus();
		node.select();
	}
</script>
<aside class="pane" data-pptx-selection-pane aria-label={t('pptx.ribbon.selectionPane')}><header><h2>{t('pptx.ribbon.selectionPane')}</h2><button aria-label={t('pptx.common.close')} onclick={onclose}><X size={16} aria-hidden="true" /></button></header><div>{#each [...elements].reverse() as element, index}<div class="row" class:selected={editor.selection.ids.includes(element.id)}>{#if renamingId === element.id}<input class="rename" type="text" bind:value={renameValue} aria-label={t('pptx.selectionPane.renameElement')} use:autofocus onkeydown={renameKeydown} onblur={commitRename} />{:else}<button class="name" onclick={() => editor.select(element.id)} ondblclick={() => beginRename(element)}><span data-pptx-selection-name>{element.name || `${element.type} ${elements.length - index}`}</span><i>{element.type}</i></button>{/if}<button class="eye" title={isElementHidden(element) ? t('pptx.selectionPane.showElement') : t('pptx.selectionPane.hideElement')} aria-label={isElementHidden(element) ? t('pptx.selectionPane.showElement') : t('pptx.selectionPane.hideElement')} aria-pressed={isElementHidden(element)} onclick={() => toggleHidden(element.id, isElementHidden(element))}>{#if isElementHidden(element)}<EyeOff size={14} aria-hidden="true" />{:else}<Eye size={14} aria-hidden="true" />{/if}</button></div>{:else}<p>{t('pptx.statusBar.noSlides')}</p>{/each}</div><footer><button title={t('pptx.arrange.bringToFront')} aria-label={t('pptx.arrange.bringToFront')} disabled={!editor.selectedElementId} onclick={() => editor.reorderSelected('front')}><BringToFront size={14} aria-hidden="true" /></button><button title={t('pptx.arrange.sendToBack')} aria-label={t('pptx.arrange.sendToBack')} disabled={!editor.selectedElementId} onclick={() => editor.reorderSelected('back')}><SendToBack size={14} aria-hidden="true" /></button></footer></aside>
<style>.pane{position:absolute;z-index:45;top:0;right:0;bottom:0;width:260px;border-left:1px solid var(--pptx-border,#3f3f52);background:var(--pptx-card,#1e1e2e);box-shadow:-12px 0 35px #0006}header,footer{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--pptx-border,#3f3f52)}h2{margin:0;font-size:12px}header button{display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;color:inherit}.pane>div{display:grid;gap:4px;overflow:auto;padding:8px}.row{display:flex;align-items:stretch;gap:4px;border:1px solid transparent;border-radius:5px;background:var(--pptx-muted,#2a2a3d)}.row.selected{border-color:var(--pptx-primary,#c43b32)}.row button{border:0;background:transparent;color:inherit;font-size:11px}.row .name{display:flex;flex:1;justify-content:space-between;gap:8px;min-width:0;padding:8px;text-align:left}.row .name span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.row .rename{flex:1;min-width:0;margin:4px;padding:3px 5px;border:1px solid var(--pptx-primary,#c43b32);border-radius:4px;background:var(--pptx-background,#11111b);color:inherit;font:inherit;font-size:11px}.row .eye{display:inline-flex;flex-shrink:0;align-items:center;justify-content:center;padding:0 8px}.row .eye[aria-pressed='false']{opacity:.5}i{color:var(--pptx-muted-foreground,#94a3b8);font-style:normal}footer{justify-content:flex-end;gap:5px;border-top:1px solid var(--pptx-border,#3f3f52);border-bottom:0}footer button{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--pptx-border,#3f3f52);border-radius:5px;background:var(--pptx-muted,#2a2a3d);color:inherit}footer button:disabled{opacity:.4}</style>
