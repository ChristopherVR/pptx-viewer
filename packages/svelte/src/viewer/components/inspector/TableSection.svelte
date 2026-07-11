<script lang="ts">
	/**
	 * TableSection: table-level header-row / banded-rows toggles and a uniform
	 * default cell padding, for `type === 'table'` elements. Built on the shared
	 * `table-inspector.ts` reader/patch-builder pair. This binding has no
	 * per-cell selection model (see `TableView.svelte`), so per-cell formatting
	 * is out of scope here, matching the vanilla binding's table-level-only
	 * inspector scope.
	 */
	import type { PptxElement } from 'pptx-viewer-core';
	import { applyUniformCellPaddingPatch, tableInspectorPatch, tableInspectorStateOf } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const { editor, el }: { editor: EditorState; el: PptxElement } = $props();
	const t = useTranslator();

	const state = $derived(tableInspectorStateOf(el));

	function setHeaderRow(checked: boolean): void {
		editor.patchSelected(tableInspectorPatch(el, { firstRowHeader: checked }));
	}
	function setBandedRows(checked: boolean): void {
		editor.patchSelected(tableInspectorPatch(el, { bandedRows: checked }));
	}
	function setCellPadding(value: string): void {
		const padding = Number(value);
		if (Number.isFinite(padding)) {
			editor.patchSelected(applyUniformCellPaddingPatch(el, padding));
		}
	}
</script>

<label class="pptx-svelte-field-checkbox">
	<input
		type="checkbox"
		checked={state.firstRowHeader}
		onchange={(e) => setHeaderRow(e.currentTarget.checked)}
	/>
	<span>{t('pptx.table.headerRow')}</span>
</label>
<label class="pptx-svelte-field-checkbox">
	<input
		type="checkbox"
		checked={state.bandedRows}
		onchange={(e) => setBandedRows(e.currentTarget.checked)}
	/>
	<span>{t('pptx.table.bandedRows')}</span>
</label>

<label class="pptx-svelte-field">
	<span class="pptx-svelte-field-label">{t('pptx.table.cellPadding')}</span>
	<input
		type="number"
		min="0"
		value={Math.round(state.cellPadding)}
		onchange={(e) => setCellPadding(e.currentTarget.value)}
	/>
</label>

<style>
	.pptx-svelte-field-checkbox {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 8px;
		cursor: pointer;
	}

	.pptx-svelte-field-checkbox:first-child {
		margin-top: 0;
	}

	.pptx-svelte-field {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin-top: 10px;
	}

	.pptx-svelte-field-label {
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-field input {
		height: 26px;
		box-sizing: border-box;
		padding: 0 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
	}
</style>
