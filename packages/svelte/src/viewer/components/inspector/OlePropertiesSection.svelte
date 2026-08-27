<script lang="ts">
	/**
	 * OlePropertiesSection: OLE object summary (type / file name / link status)
	 * plus the Object Name editor, at parity with React's `ElementMiscPanels.tsx`
	 * OlePropertiesPanel.
	 *
	 * A browser cannot run the native application that owns an embedded OLE
	 * object, so the object itself stays read-only. Its Object Name IS editable:
	 * `p:oleObj/@name` (ECMA-376 SS13.3.4) already parses, saves, and syncs via
	 * collaboration, and shared's `getOleDisplayName` / `getOleAriaLabel` already
	 * read it, so this field was the only piece missing to make it a real,
	 * round-tripping edit.
	 */
	import type { OlePptxElement, PptxElement } from 'pptx-viewer-core';
	import { getOleObjectTypeLabel } from 'pptx-viewer-core';
	import { buildOleObjectNamePatch } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const { editor, el }: { editor: EditorState; el: PptxElement } = $props();
	const t = useTranslator();
	const canEdit = $derived(editor.editable);

	const ole = $derived(el as OlePptxElement);
</script>

<div class="pptx-svelte-ole-info">
	<label class="pptx-svelte-ole-name">
		<span>{t('pptx.ole.objectName')}</span>
		<input
			type="text"
			disabled={!canEdit}
			placeholder={t('pptx.ole.objectNamePlaceholder')}
			value={ole.oleName ?? ''}
			oninput={(event) =>
				editor.applyElementPatch(
					el.id,
					buildOleObjectNamePatch(event.currentTarget.value) as Partial<PptxElement>,
				)}
		/>
	</label>
	<div class="pptx-svelte-ole-row">
		<span>{t('pptx.ole.type')}</span>
		<span class="pptx-svelte-ole-value">{getOleObjectTypeLabel(ole.oleObjectType)}</span>
	</div>
	{#if ole.fileName}
		<div class="pptx-svelte-ole-row">
			<span>{t('pptx.ole.fileName')}</span>
			<span class="pptx-svelte-ole-value" title={ole.fileName}>{ole.fileName}</span>
		</div>
	{/if}
	<div class="pptx-svelte-ole-row">
		<span>{t('pptx.ole.linkStatus')}</span>
		<span class="pptx-svelte-ole-badge" class:is-linked={ole.isLinked}>
			{ole.isLinked ? t('pptx.ole.linked') : t('pptx.ole.embedded')}
		</span>
	</div>
</div>

<style>
	.pptx-svelte-ole-info {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 11px;
	}
	.pptx-svelte-ole-name {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.pptx-svelte-ole-name span {
		color: var(--pptx-muted-foreground, #94a3b8);
	}
	.pptx-svelte-ole-name input {
		width: 100%;
		box-sizing: border-box;
		padding: 4px 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
	}
	.pptx-svelte-ole-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.pptx-svelte-ole-row > span:first-child {
		color: var(--pptx-muted-foreground, #94a3b8);
	}
	.pptx-svelte-ole-value {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pptx-svelte-ole-badge {
		display: inline-flex;
		align-items: center;
		border-radius: 999px;
		padding: 1px 8px;
		font-size: 10px;
		font-weight: 500;
		background: rgba(34, 197, 94, 0.2);
		color: #4ade80;
	}
	.pptx-svelte-ole-badge.is-linked {
		background: rgba(59, 130, 246, 0.2);
		color: #60a5fa;
	}
</style>
