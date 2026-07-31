<script lang="ts">
	import Printer from '@lucide/svelte/icons/printer';
	import X from '@lucide/svelte/icons/x';
	import { useTranslator } from '../../i18n/context';
	import type { PrintOptions } from '../export/export-print';

	const {
		slideCount,
		current,
		onclose,
		onprint,
	}: {
		slideCount: number;
		current: number;
		onclose: () => void;
		onprint: (options: PrintOptions) => void;
	} = $props();
	const t = useTranslator();
	// eslint-disable-next-line prefer-const
	let printWhat = $state<'slides' | 'handouts' | 'notes' | 'outline'>('slides');
	// eslint-disable-next-line prefer-const
	let slideRange = $state<'all' | 'current' | 'custom'>('all');
	// eslint-disable-next-line prefer-const
	let slidesPerPage = $state<1 | 2 | 3 | 4 | 6 | 9>(6);
	// eslint-disable-next-line prefer-const
	let orientation = $state<'portrait' | 'landscape'>('landscape');
	// eslint-disable-next-line prefer-const
	let colorMode = $state<'color' | 'grayscale' | 'blackAndWhite'>('color');
	// eslint-disable-next-line prefer-const
	let frameSlides = $state(false);
	// eslint-disable-next-line prefer-const
	let customRangeFrom = $state(1);
	let customRangeTo = $state(1);

	$effect(() => {
		if (customRangeTo === 1 && slideCount > 1) {customRangeTo = slideCount;}
	});

	function print(): void {
		onprint({
			printWhat,
			slideRange,
			slidesPerPage,
			orientation,
			colorMode,
			frameSlides,
			customRangeFrom: slideRange === 'current' ? current + 1 : customRangeFrom,
			customRangeTo: slideRange === 'current' ? current + 1 : customRangeTo,
		});
		onclose();
	}
</script>

<div class="backdrop">
	<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
	<section role="dialog" tabindex="-1" aria-modal="true" aria-label={t('pptx.print.title')}>
		<header><h2><Printer size={16} aria-hidden="true" /> {t('pptx.print.title')}</h2><button aria-label={t('pptx.common.close')} onclick={onclose}><X size={16} aria-hidden="true" /></button></header>
		<div class="body">
			<label>{t('pptx.print.printWhat')}<select bind:value={printWhat}><option value="slides">{t('pptx.print.fullPageSlides')}</option><option value="handouts">{t('pptx.print.handouts')}</option><option value="notes">{t('pptx.print.notesPages')}</option><option value="outline">{t('pptx.print.outline')}</option></select></label>
			{#if printWhat === 'handouts'}<label>{t('pptx.print.slidesPerPage')}<select bind:value={slidesPerPage}>{#each [1, 2, 3, 4, 6, 9] as value}<option value={value}>{value}</option>{/each}</select></label>{/if}
			<label>{t('pptx.print.range')}<select bind:value={slideRange}><option value="all">{t('pptx.print.allSlides')}</option><option value="current">{t('pptx.print.currentSlide')}</option><option value="custom">{t('pptx.print.customRange')}</option></select></label>
			{#if slideRange === 'custom'}<div class="range"><input type="number" min="1" max={slideCount} bind:value={customRangeFrom} /><span>{t('pptx.slideShow.to')}</span><input type="number" min="1" max={slideCount} bind:value={customRangeTo} /></div>{/if}
			<label>{t('pptx.print.orientation')}<select bind:value={orientation}><option value="landscape">{t('pptx.print.landscape')}</option><option value="portrait">{t('pptx.print.portrait')}</option></select></label>
			<label>{t('pptx.print.colorMode')}<select bind:value={colorMode}><option value="color">{t('pptx.print.color')}</option><option value="grayscale">{t('pptx.print.grayscale')}</option><option value="blackAndWhite">{t('pptx.print.pureBlackWhite')}</option></select></label>
			<label class="check"><input type="checkbox" bind:checked={frameSlides} />{t('pptx.print.frameSlides')}</label>
		</div>
		<footer><button onclick={onclose}>{t('pptx.common.cancel')}</button><button class="primary" onclick={print}><Printer size={14} aria-hidden="true" /> {t('pptx.print.printButton')}</button></footer>
	</section>
</div>

<style>
	.backdrop{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;background:#0009}section{width:min(620px,calc(100vw - 32px));max-height:90vh;overflow:auto;border:1px solid var(--pptx-border,#3f3f52);border-radius:12px;background:var(--pptx-card,#1e1e2e);box-shadow:0 24px 80px #0009}header,footer{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--pptx-border,#3f3f52)}h2{display:flex;align-items:center;gap:7px;margin:0;font-size:14px}.body{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:20px}.body label{display:grid;gap:6px;color:var(--pptx-muted-foreground,#94a3b8);font-size:11px}.body select,.body input{border:1px solid var(--pptx-border,#3f3f52);border-radius:6px;padding:8px;background:var(--pptx-muted,#2a2a3d);color:inherit}.body .check{display:flex;align-items:center;gap:8px}.range{display:flex;align-items:end;gap:8px}.range input{width:70px}button{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--pptx-border,#3f3f52);border-radius:6px;padding:7px 11px;background:var(--pptx-muted,#2a2a3d);color:inherit}header button{border:0;background:transparent}footer{justify-content:flex-end;gap:8px;border-top:1px solid var(--pptx-border,#3f3f52);border-bottom:0}.primary{background:var(--pptx-primary,#c43b32);color:#fff}@media(max-width:600px){section{position:fixed;inset:auto 0 0;width:100%;max-height:88dvh;border-radius:16px 16px 0 0}.body{grid-template-columns:1fr}}
</style>
