<script lang="ts">
	import type { PptxHandoutMaster } from 'pptx-viewer-core';
	import { computeHandoutSlotLayout } from 'pptx-viewer-shared';
	import type { CanvasSize } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';

	const { handoutMaster, canvasSize, slidesPerPage, pageNumber } = $props<{
		handoutMaster: PptxHandoutMaster | undefined;
		canvasSize: CanvasSize;
		slidesPerPage: number;
		pageNumber?: number;
	}>();
	const t = useTranslator();
	const slots = $derived(computeHandoutSlotLayout(slidesPerPage));
	function slotStyle(slot: { x: number; y: number; w: number; h: number }): string {
		return `left:${slot.x * 100}%;top:${slot.y * 100}%;width:${slot.w * 100}%;height:${slot.h * 100}%`;
	}
</script>

{#if handoutMaster}
	<div
		class="pptx-svelte-handout-master-page"
		data-testid="handout-master-page"
		style={`width:${canvasSize.width}px;height:${canvasSize.height}px;background:${handoutMaster.backgroundColor ?? '#fff'}`}
	>
		{#each slots as slot, index (index)}
			<div class="slot" data-testid="handout-slot" style={slotStyle(slot)}>
				{t('pptx.master.handoutSlideSlot', { number: index + 1 })}
			</div>
		{/each}
		<span class="corner top-left">{t('pptx.master.notesMasterHeader')}</span>
		<span class="corner top-right">{t('pptx.master.notesMasterDate')}</span>
		<span class="corner bottom-left">{t('pptx.master.notesMasterFooter')}</span>
		<span class="corner bottom-right">{pageNumber ?? t('pptx.master.notesMasterPageNumber')}</span>
	</div>
{:else}
	<div class="empty" data-testid="handout-master-empty">{t('pptx.master.noHandoutMaster')}</div>
{/if}

<style>
	.pptx-svelte-handout-master-page { position:absolute; inset:0; overflow:hidden; color:#6b7280; }
	.slot { position:absolute; display:flex; align-items:center; justify-content:center; box-sizing:border-box; border:1px dashed #60a5fa80; background:#eff6ff4d; color:#3b82f699; font-size:11px; font-weight:500; }
	.corner { position:absolute; padding:2px 5px; border-color:#d1d5db66; border-style:dashed; color:#9ca3af99; font-size:9px; }
	.top-left { top:0; left:0; border-right-width:1px; border-bottom-width:1px; }
	.top-right { top:0; right:0; border-bottom-width:1px; border-left-width:1px; }
	.bottom-left { bottom:0; left:0; border-top-width:1px; border-right-width:1px; }
	.bottom-right { right:0; bottom:0; border-top-width:1px; border-left-width:1px; }
	.empty { margin:auto; color:var(--pptx-muted-foreground,#a5a5b5); font-size:14px; }
</style>
