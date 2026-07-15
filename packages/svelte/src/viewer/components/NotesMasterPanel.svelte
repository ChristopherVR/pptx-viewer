<script lang="ts">
	import type { PptxNotesMaster } from 'pptx-viewer-core';
	import { useTranslator } from '../../i18n/context';

	const { notesMaster, onchange } = $props<{
		notesMaster: PptxNotesMaster | undefined;
		onchange: (color: string) => void;
	}>();
	const t = useTranslator();
	const labels: Record<string, string> = {
		body: 'pptx.master.notesMasterBody', sldImg: 'pptx.master.notesMasterSlideImage',
		hdr: 'pptx.master.notesMasterHeader', ftr: 'pptx.master.notesMasterFooter',
		dt: 'pptx.master.notesMasterDate', sldNum: 'pptx.master.notesMasterPageNumber',
	};
</script>

{#if notesMaster}
	<section class="panel" data-testid="notes-master-panel">
		<div class="label">{t('pptx.master.notesMasterBackground')}</div>
		<input type="color" class="swatch" aria-label="Master background color" value={notesMaster.backgroundColor ?? '#ffffff'} oninput={(event) => onchange(event.currentTarget.value)} />
		<div class="label">{t('pptx.master.notesMasterPlaceholders')}</div>
		{#each notesMaster.placeholders ?? [] as placeholder (`${placeholder.type}-${placeholder.idx ?? 'default'}`)}
			<div class="placeholder"><i></i>{t(labels[placeholder.type] ?? placeholder.type)}</div>
		{:else}<small>{t('pptx.master.noPlaceholders')}</small>{/each}
	</section>
{:else}<p class="empty">{t('pptx.master.noNotesMaster')}</p>{/if}

<style>
	.panel { display:flex; flex-direction:column; gap:6px; padding:6px; }
	.label, small { color:var(--pptx-muted-foreground,#a5a5b5); font-size:10px; }
	.swatch { height:32px; border:1px solid var(--pptx-border,#33334d); border-radius:5px; }
	.placeholder { display:flex; align-items:center; gap:7px; padding:5px; border-radius:4px; background:var(--pptx-background,#11111b); font-size:10px; }
	i { width:8px; height:8px; border-radius:50%; background:#22c55e99; }
	.empty { padding:12px; color:var(--pptx-muted-foreground,#a5a5b5); font-size:12px; text-align:center; }
</style>
