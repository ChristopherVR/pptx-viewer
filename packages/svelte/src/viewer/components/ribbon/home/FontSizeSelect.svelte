<script lang="ts">
	import { hasTextProperties } from 'pptx-viewer-core';
	import { COMMON_FONT_SIZES, fontSizeOf } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../../i18n/context';
	import { setFontSizePatch } from '../../../editor';
	import type { EditorState } from '../../../editor/editor-state.svelte';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();
	const element = $derived(editor.selectedElement);
	const active = $derived(element !== undefined && hasTextProperties(element));
	const size = $derived(element ? fontSizeOf(element) : 24);
	function setSize(value: string): void {
		const next = Number(value);
		if (active && Number.isFinite(next) && next > 0) {
			editor.patchSelected((current) => setFontSizePatch(current, next));
		}
	}
</script>

<pptx-ui-select variant="ribbon-font" data-font-picker="size"
	data-ribbon-control="home.font.fontSize" aria-label={t('pptx.ribbon.fontSize')}
	disabled={!editor.editable || !active} value={String(size)}
	onchange={(e) => setSize(e.currentTarget.value)}>
	<label slot="custom" class="pptx-svelte-custom-size">
		{t('pptx.ribbon.fontSize')}
		<input type="number" min="1" max="400" step="any" value={size}
			aria-label={t('pptx.ribbon.fontSize')} onchange={(e) => { e.stopPropagation(); setSize(e.currentTarget.value); }} />
	</label>
	{#if !COMMON_FONT_SIZES.includes(size)}<option value={size} hidden>{size}</option>{/if}
	{#each COMMON_FONT_SIZES as preset}<option value={preset}>{preset}</option>{/each}
</pptx-ui-select>

<style>
	.pptx-svelte-custom-size { display: flex; align-items: center; gap: 8px; padding: 6px 12px; font-size: 12px; }
	.pptx-svelte-custom-size input { width: 64px; border: 1px solid var(--pptx-border); border-radius: 3px; padding: 4px; background: var(--pptx-background); color: var(--pptx-foreground); }
</style>
