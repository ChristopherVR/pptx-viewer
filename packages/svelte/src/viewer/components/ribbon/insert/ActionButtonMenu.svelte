<script lang="ts">
	/**
	 * ActionButtonMenu: Insert > Action Button, a native `<select>` listing the
	 * 12 OOXML built-in action-button presets from the shared `action-buttons.ts`
	 * catalogue. Preset labels have no dictionary entries of their own (React's
	 * own Insert section renders them untranslated too), so the catalogue's
	 * English `label` is used as-is.
	 */
	import type { CanvasSize } from 'pptx-viewer-shared';
	import { ACTION_BUTTON_PRESETS } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { buildActionButtonInsertElement } from '../../../editor';

	const { editor, canvasSize }: { editor: EditorState; canvasSize: CanvasSize } = $props();
	const t = useTranslator();

	function onChange(event: Event): void {
		const select = event.currentTarget as HTMLSelectElement;
		const value = select.value;
		select.value = '';
		if (!value) {
			return;
		}
		const el = buildActionButtonInsertElement(value, canvasSize);
		if (el) {
			editor.insertElement(el);
		}
	}
</script>

<select
	class="pptx-svelte-insert-select"
	disabled={!editor.editable}
	aria-label={t('pptx.ribbon.insertActionButton')}
	title={t('pptx.ribbon.insertActionButton')}
	value=""
	onchange={onChange}
>
	<option value="">{t('pptx.ribbon.action')}</option>
	{#each ACTION_BUTTON_PRESETS as preset (preset.shapeType)}
		<option value={preset.shapeType}>{preset.label}</option>
	{/each}
</select>

<style>
	.pptx-svelte-insert-select {
		height: 28px;
		max-width: 96px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
		padding: 0 6px;
	}

	.pptx-svelte-insert-select:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-insert-select:disabled {
		opacity: 0.35;
		cursor: default;
	}
</style>
