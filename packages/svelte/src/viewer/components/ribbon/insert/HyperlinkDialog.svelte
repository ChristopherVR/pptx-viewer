<script lang="ts">
	import type { PptxElement } from 'pptx-viewer-core';
	import { untrack } from 'svelte';
	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';

	const { editor, onclose }: { editor: EditorState; onclose: () => void } = $props();
	const t = useTranslator();
	const initialElement = untrack(() => editor.selectedElement);
	const element = $derived(editor.selectedElement);
	let url = $state(initialElement?.actionClick?.url ?? '');
	let tooltip = $state(initialElement?.actionClick?.tooltip ?? '');

	function save(): void {
		if (element) {
			editor.applyElementPatch(element.id, {
				actionClick: { ...element.actionClick, url, tooltip },
			} as Partial<PptxElement>);
		}
		onclose();
	}
</script>

<div class="backdrop">
	<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
	<section role="dialog" tabindex="-1" aria-modal="true" aria-label={t('pptx.hyperlink.title')}>
		<h2>{t('pptx.hyperlink.title')}</h2>
		<label>{t('pptx.hyperlink.address')}<input type="url" bind:value={url} /></label>
		<label>{t('pptx.hyperlink.screenTip')}<input bind:value={tooltip} /></label>
		<footer><button onclick={onclose}>{t('common.cancel')}</button><button class="primary" onclick={save}>{t('common.ok')}</button></footer>
	</section>
</div>

<style>.backdrop{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;background:#0009}section{display:grid;width:min(430px,calc(100vw - 32px));gap:13px;padding:20px;border:1px solid var(--pptx-border,#3f3f52);border-radius:11px;background:var(--pptx-card,#1e1e2e)}h2{margin:0;font-size:15px}label{display:grid;gap:5px;color:var(--pptx-muted-foreground,#94a3b8);font-size:11px}input{border:1px solid var(--pptx-border,#3f3f52);border-radius:6px;padding:8px;background:var(--pptx-muted,#2a2a3d);color:inherit}footer{display:flex;justify-content:flex-end;gap:7px}button{border:1px solid var(--pptx-border,#3f3f52);border-radius:6px;padding:7px 10px;background:var(--pptx-muted,#2a2a3d);color:inherit}.primary{background:var(--pptx-primary,#c43b32);color:#fff}</style>
