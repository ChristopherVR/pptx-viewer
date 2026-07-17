<script lang="ts">
	/**
	 * NotesHandoutSection: read-only NOTES & HANDOUT card (Notes Size / Notes
	 * Master / Handout Master rows), the Svelte port of Vue's
	 * `NotesHandoutCard` (React `inspector/DocumentPropertiesCards.tsx`).
	 */
	import type { PptxHandoutMaster, PptxNotesMaster } from 'pptx-viewer-core';
	import type { CanvasSize } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';

	const {
		notesCanvasSize,
		notesMaster,
		handoutMaster,
	}: {
		notesCanvasSize?: CanvasSize;
		notesMaster?: PptxNotesMaster;
		handoutMaster?: PptxHandoutMaster;
	} = $props();
	const t = useTranslator();

	const rows = $derived<Array<{ label: string; value: string }>>([
		{
			label: t('pptx.documentProperties.notesSize'),
			value: notesCanvasSize
				? `${notesCanvasSize.width} × ${notesCanvasSize.height}px`
				: t('pptx.digitalSignatures.notAvailable'),
		},
		{
			label: t('pptx.master.notesMasterTitle'),
			value: notesMaster
				? `${notesMaster.placeholders?.length ?? 0} placeholders`
				: t('pptx.digitalSignatures.notAvailable'),
		},
		{
			label: t('pptx.master.handoutMasterTitle'),
			value: handoutMaster
				? `${handoutMaster.placeholders?.length ?? 0} placeholders`
				: t('pptx.digitalSignatures.notAvailable'),
		},
	]);
</script>

<div class="pptx-svelte-notes-handout">
	{#each rows as row (row.label)}
		<div class="row">
			<span>{row.label}</span>
			<span>{row.value}</span>
		</div>
	{/each}
</div>

<style>
	.pptx-svelte-notes-handout {
		display: grid;
		gap: 4px;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 11px;
	}
</style>
