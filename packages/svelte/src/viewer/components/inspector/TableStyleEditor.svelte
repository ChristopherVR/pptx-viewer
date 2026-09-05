<script lang="ts">
	/**
	 * "Edit style..." panel for a table style's own DEFINITION
	 * (`a:tblStyleLst` section fill/text/borders/cell3D), distinct from
	 * `TableSection.svelte`'s "which style does this table use" picker.
	 * Svelte port of React's `TableStyleEditor.tsx` / Vue's
	 * `TableStyleEditor.vue`.
	 */
	import type { ParsedTableStyleMap } from 'pptx-viewer-core';
	import {
		addTableStyleToMap,
		createTableStyleEntry,
		deleteTableStyleFromMap,
		normalizeTableStyleGuid,
	} from 'pptx-viewer-core';
	import type { TableStyleEditorFieldEdit, TableStyleEditorPartId } from 'pptx-viewer-shared';
	import { applyTableStyleFieldEdit, describeTableStyleEditor, TABLE_STYLE_EDITOR_PARTS } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import TableStyleEditorFields from './TableStyleEditorFields.svelte';

	const {
		styleMap,
		styleId,
		themeColorMap,
		canEdit = true,
		onStyleMapChange,
		onDeleteStyle,
		onAssignStyle,
		onClose,
	}: {
		styleMap: ParsedTableStyleMap | undefined;
		/** The style currently assigned to the table being edited. */
		styleId: string | undefined;
		themeColorMap: Record<string, string> | undefined;
		canEdit?: boolean;
		/** Commit a full replacement style map (section edit, create, or delete already applied). */
		onStyleMapChange: (nextMap: ParsedTableStyleMap) => void;
		/** Record a styleId for save-time removal from `ppt/tableStyles.xml`. */
		onDeleteStyle: (styleId: string) => void;
		/** Optional: assign a newly-created style to the table being edited. */
		onAssignStyle?: (styleId: string) => void;
		onClose: () => void;
	} = $props();

	const t = useTranslator();
	// eslint-disable-next-line prefer-const
	let activeStyleId = $state(styleId ? normalizeTableStyleGuid(styleId) : '');
	// eslint-disable-next-line prefer-const
	let selectedPart = $state<TableStyleEditorPartId>('wholeTbl');

	const entry = $derived(activeStyleId ? styleMap?.[activeStyleId] : undefined);
	const descriptor = $derived(describeTableStyleEditor(entry, selectedPart, themeColorMap));

	function onFieldEdit(fieldEdit: TableStyleEditorFieldEdit): void {
		if (!entry || !styleMap) {
			return;
		}
		const { entry: nextEntry } = applyTableStyleFieldEdit(entry, selectedPart, fieldEdit);
		onStyleMapChange({ ...styleMap, [nextEntry.styleId]: nextEntry });
	}

	function createFromCurrent(): void {
		const name = window.prompt(
			t('pptx.tableStyleEditor.newStyleNamePrompt'),
			entry ? `${entry.styleName ?? ''} Copy`.trim() : '',
		);
		if (!name) {
			return;
		}
		const nextMap: ParsedTableStyleMap = { ...(styleMap ?? {}) };
		const created = createTableStyleEntry(nextMap, { styleName: name, basedOn: entry });
		addTableStyleToMap(nextMap, created);
		onStyleMapChange(nextMap);
		activeStyleId = created.styleId;
		onAssignStyle?.(created.styleId);
	}

	function handleDelete(): void {
		if (!entry || !styleMap || !window.confirm(t('pptx.tableStyleEditor.deleteConfirm'))) {
			return;
		}
		const nextMap: ParsedTableStyleMap = { ...styleMap };
		deleteTableStyleFromMap(nextMap, entry.styleId);
		onStyleMapChange(nextMap);
		onDeleteStyle(entry.styleId);
		onClose();
	}
</script>

<div class="editor" data-testid="table-style-editor">
	<div class="hdr">
		<span class="hdg">{t('pptx.tableStyleEditor.title')}</span>
		<button type="button" onclick={onClose}>{t('pptx.tableStyleEditor.close')}</button>
	</div>

	{#if !entry}
		<div class="empty">{t('pptx.tableStyleEditor.noStyleSelected')}</div>
	{/if}

	{#if entry}
		<div class="parts">
			{#each TABLE_STYLE_EDITOR_PARTS as part (part.id)}
				<button type="button" class:active={selectedPart === part.id} disabled={!canEdit} onclick={() => (selectedPart = part.id)}>{t(part.labelKey)}</button>
			{/each}
		</div>
	{/if}

	{#if descriptor}
		<TableStyleEditorFields {descriptor} {themeColorMap} {canEdit} onedit={onFieldEdit} />
	{/if}

	<div class="actions">
		<button type="button" disabled={!canEdit} onclick={createFromCurrent}>{entry ? t('pptx.tableStyleEditor.newFromCurrent') : t('pptx.tableStyleEditor.newStyle')}</button>
		{#if entry}
			<button type="button" disabled={!canEdit} onclick={handleDelete}>{t('pptx.tableStyleEditor.deleteStyle')}</button>
		{/if}
	</div>
</div>

<style>
	.editor { display: flex; flex-direction: column; gap: 8px; border: 1px solid var(--pptx-border); border-radius: 5px; padding: 8px; }
	.hdr { display: flex; align-items: center; justify-content: space-between; }
	.hdg { font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--pptx-muted-foreground); }
	.empty { font-size: 11px; color: var(--pptx-muted-foreground); }
	.parts { display: flex; flex-wrap: wrap; gap: 4px; }
	.actions { display: flex; gap: 6px; padding-top: 4px; border-top: 1px solid var(--pptx-border); }
	button { font-size: 11px; border: 1px solid var(--pptx-border); border-radius: 4px; padding: 3px 6px; background: var(--pptx-muted); color: inherit; cursor: pointer; }
	button.active { background: var(--pptx-primary, #c43b32); color: #fff; }
	button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
