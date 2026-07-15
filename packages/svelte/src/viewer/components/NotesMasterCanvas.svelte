<script lang="ts">
	import type { PptxNotesMaster } from 'pptx-viewer-core';
	import { NOTES_MASTER_PLACEHOLDER_RECTS } from 'pptx-viewer-shared';
	import type { CanvasSize } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';

	const { notesMaster, canvasSize } = $props<{
		notesMaster: PptxNotesMaster | undefined;
		canvasSize: CanvasSize;
	}>();
	const t = useTranslator();
	const defaultPlaceholders = Object.keys(NOTES_MASTER_PLACEHOLDER_RECTS).map((type) => ({ type }));
	const placeholders = $derived(notesMaster?.placeholders ?? defaultPlaceholders);
	const labels: Record<string, string> = {
		sldImg: 'pptx.master.notesMasterSlideImage',
		body: 'pptx.master.notesMasterBody',
		hdr: 'pptx.master.notesMasterHeader',
		ftr: 'pptx.master.notesMasterFooter',
		dt: 'pptx.master.notesMasterDate',
		sldNum: 'pptx.master.notesMasterPageNumber',
	};

	function regionStyle(type: string): string {
		const rect = NOTES_MASTER_PLACEHOLDER_RECTS[type];
		return rect
			? `left:${rect.x * 100}%;top:${rect.y * 100}%;width:${rect.w * 100}%;height:${rect.h * 100}%`
			: '';
	}
</script>

{#if notesMaster}
	<div
		class="pptx-svelte-notes-master-page"
		data-testid="notes-master-page"
		style={`width:${canvasSize.width}px;height:${canvasSize.height}px;background:${notesMaster.backgroundColor ?? '#fff'}`}
	>
		{#each placeholders as placeholder (`${placeholder.type}-${placeholder.idx ?? 'default'}`)}
			{#if NOTES_MASTER_PLACEHOLDER_RECTS[placeholder.type]}
				<div
					class="region"
					class:slide={placeholder.type === 'sldImg'}
					class:body={placeholder.type === 'body'}
					data-region={placeholder.type}
					style={regionStyle(placeholder.type)}
				>
					{t(labels[placeholder.type] ?? placeholder.type)}
				</div>
			{/if}
		{/each}
	</div>
{:else}
	<div class="empty" data-testid="notes-master-empty">{t('pptx.master.noNotesMaster')}</div>
{/if}

<style>
	.pptx-svelte-notes-master-page { position:absolute; inset:0; overflow:hidden; color:#6b7280; }
	.region { position:absolute; display:flex; align-items:center; justify-content:center; box-sizing:border-box; border:1px dashed #9ca3af66; font-size:12px; text-align:center; }
	.region.slide { border-color:#3b82f680; background:#3b82f60d; color:#2563ebaa; }
	.region.body { align-items:flex-start; justify-content:flex-start; padding:8px; border-color:#22c55e80; background:#22c55e0d; color:#16a34aaa; }
	.empty { margin:auto; color:var(--pptx-muted-foreground,#a5a5b5); font-size:14px; }
</style>
