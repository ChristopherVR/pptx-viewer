<script lang="ts">
	import RibbonIcon from '../RibbonIcon.svelte';
	import { hasTextProperties } from 'pptx-viewer-core';
	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { adjustFontSizePatch, toggleStrikethroughPatch, toggleTextFlagPatch } from '../../../editor';
	import FontExtrasGroup from './FontExtrasGroup.svelte';
	import TextShadowToggle from './TextShadowToggle.svelte';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();
	const element = $derived(editor.selectedElement);
	const active = $derived(editor.editable && element !== undefined && hasTextProperties(element));
	const decorations = [
		{ flag: 'bold' }, { flag: 'italic' },
		{ flag: 'underline' }, { flag: 'strikethrough' },
	] as const;
</script>

<div data-pptx-chrome="font-controls">
	<div data-pptx-chrome="control-cluster">
		{#each decorations as item}
			<button type="button" disabled={!active}
				data-ribbon-control={`home.font.${item.flag}`} title={t(`pptx.textPanel.${item.flag}`)}
				aria-label={t(`pptx.textPanel.${item.flag}`)}
				aria-pressed={element && hasTextProperties(element) ? !!element.textStyle?.[item.flag] : false}
				onclick={() => editor.patchSelected((current) => item.flag === 'strikethrough' ? toggleStrikethroughPatch(current) : toggleTextFlagPatch(current, item.flag))}>
				<RibbonIcon name={`home.font.${item.flag}`} />
			</button>
		{/each}
	</div>
	<TextShadowToggle {editor} />
	<div data-pptx-chrome="control-cluster">
		{#each [{ delta: 2, id: 'increaseFontSize' }, { delta: -2, id: 'decreaseFontSize' }] as item}
			<button type="button" disabled={!active} data-ribbon-control={`home.font.${item.id}`}
				title={t(`pptx.text.${item.id}`)} aria-label={t(`pptx.text.${item.id}`)}
				onclick={() => editor.patchSelected((current) => adjustFontSizePatch(current, item.delta))}>
				<RibbonIcon name={`home.font.${item.id}`} />
			</button>
		{/each}
		<FontExtrasGroup {editor} section="clear" showFamily={false} />
	</div>
	<FontExtrasGroup {editor} section="menus" showFamily={false} />
</div>
