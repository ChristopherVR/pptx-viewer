<script lang="ts">
	import type { PptxHandoutMaster } from 'pptx-viewer-core';
	import { useTranslator } from '../../i18n/context';

	const { handoutMaster, slidesPerPage, onchange, onbackgroundchange } = $props<{
		handoutMaster: PptxHandoutMaster | undefined;
		slidesPerPage: number;
		onchange: (count: number) => void;
		onbackgroundchange: (color: string) => void;
	}>();
	const t = useTranslator();
	const options = [1, 2, 3, 4, 6, 9];
</script>

{#if handoutMaster}
	<section class="panel" data-testid="handout-master-panel">
		<div class="label">{t('pptx.master.handoutSlidesPerPage')}</div>
		<div class="options">
			{#each options as count}
				<button type="button" class:active={slidesPerPage === count} aria-pressed={slidesPerPage === count} onclick={() => onchange(count)}>{count}</button>
			{/each}
		</div>
		<div class="label">{t('pptx.master.handoutBackground')}</div>
		<input type="color" class="swatch" aria-label="Master background color" value={handoutMaster.backgroundColor ?? '#ffffff'} oninput={(event) => onbackgroundchange(event.currentTarget.value)} />
	</section>
{:else}<p class="empty">{t('pptx.master.noHandoutMaster')}</p>{/if}

<style>
	.panel { display:flex; flex-direction:column; gap:7px; padding:6px; }
	.label { color:var(--pptx-muted-foreground,#a5a5b5); font-size:10px; }
	.options { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; }
	button { padding:5px; border:0; border-radius:4px; background:var(--pptx-accent,#33334d); color:inherit; cursor:pointer; }
	button.active { background:var(--pptx-primary,#6366f1); color:#fff; }
	button:focus-visible { outline:2px solid var(--pptx-ring,#6366f1); outline-offset:1px; }
	.swatch { height:32px; border:1px solid var(--pptx-border,#33334d); border-radius:5px; }
	.empty { padding:12px; color:var(--pptx-muted-foreground,#a5a5b5); font-size:12px; text-align:center; }
</style>
