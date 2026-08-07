<script lang="ts">
	import type { PptxCustomShow, PptxPresentationProperties } from 'pptx-viewer-core';
	import { untrack } from 'svelte';
	import { useTranslator } from '../../i18n/context';

	const { properties, customShows, slideCount, onclose, onsave }: {
		properties: PptxPresentationProperties; customShows: PptxCustomShow[]; slideCount: number;
		onclose: () => void; onsave: (next: PptxPresentationProperties) => void;
	} = $props();
	const t = useTranslator();
	let draft = $state<PptxPresentationProperties>(structuredClone(untrack(() => properties)));
	const option = (key: keyof PptxPresentationProperties, value: boolean) => {
		draft = { ...draft, [key]: value };
	};
	function save(): void { onsave(structuredClone(draft)); onclose(); }
</script>

<div class="backdrop" role="presentation">
	<button class="scrim" type="button" aria-label={t('pptx.common.close')} onclick={onclose}></button>
	<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
	<section role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="setup-title">
		<header><h2 id="setup-title">{t('pptx.slideShow.setUpTitle')}</h2><button type="button" aria-label={t('pptx.common.close')} onclick={onclose}>×</button></header>
		<div class="body">
			<fieldset><legend>{t('pptx.slideShow.showType')}</legend>
				{#each [['presented', 'pptx.slideShow.presentedBySpeaker'], ['browsed', 'pptx.slideShow.browsedByIndividual'], ['kiosk', 'pptx.slideShow.browsedAtKiosk']] as item}
					<label><input type="radio" name="show-type" value={item[0]} checked={(draft.showType ?? 'presented') === item[0]} onchange={() => { draft = { ...draft, showType: item[0] as 'presented' | 'browsed' | 'kiosk', ...(item[0] === 'kiosk' ? { loopContinuously: true } : {}) }; }} />{t(item[1])}</label>
				{/each}
			</fieldset>
			<fieldset><legend>{t('pptx.slideShow.showSlides')}</legend>
				<label><input type="radio" name="range" checked={(draft.showSlidesMode ?? 'all') === 'all'} onchange={() => (draft = { ...draft, showSlidesMode: 'all' })} />{t('pptx.slideShow.allSlides')}</label>
				<label><input type="radio" name="range" checked={draft.showSlidesMode === 'range'} onchange={() => (draft = { ...draft, showSlidesMode: 'range' })} />{t('pptx.slideShow.fromTo')}</label>
				<div class="range"><input aria-label={t('pptx.slideShow.from')} type="number" min="1" max={slideCount} value={draft.showSlidesFrom ?? 1} oninput={(event) => (draft = { ...draft, showSlidesFrom: Number(event.currentTarget.value) })} /><span>{t('pptx.slideShow.to')}</span><input aria-label={t('pptx.slideShow.to')} type="number" min="1" max={slideCount} value={draft.showSlidesTo ?? slideCount} oninput={(event) => (draft = { ...draft, showSlidesTo: Number(event.currentTarget.value) })} /></div>
				{#if customShows.length}<label><input type="radio" name="range" checked={draft.showSlidesMode === 'customShow'} onchange={() => (draft = { ...draft, showSlidesMode: 'customShow' })} />{t('pptx.slideShow.customShow')}<select aria-label={t('pptx.slideShow.customShow')} value={draft.showSlidesCustomShowId ?? customShows[0]?.id} onchange={(event) => (draft = { ...draft, showSlidesCustomShowId: event.currentTarget.value })}>{#each customShows as show}<option value={show.id}>{show.name}</option>{/each}</select></label>{/if}
			</fieldset>
			<fieldset><legend>{t('pptx.slideShow.advanceSlides')}</legend>
				<label><input type="radio" name="advance" checked={draft.advanceMode === 'manual'} onchange={() => (draft = { ...draft, advanceMode: 'manual' })} />{t('pptx.slideShow.manually')}</label>
				<label><input type="radio" name="advance" checked={(draft.advanceMode ?? 'useTimings') === 'useTimings'} onchange={() => (draft = { ...draft, advanceMode: 'useTimings' })} />{t('pptx.slideShow.useTimings')}</label>
			</fieldset>
			<fieldset><legend>{t('pptx.slideShow.showOptions')}</legend>
				<label><input type="checkbox" checked={draft.loopContinuously ?? false} onchange={(event) => option('loopContinuously', event.currentTarget.checked)} />{t('pptx.slideShow.loopContinuously')}</label>
				<label><input type="checkbox" checked={draft.showWithNarration === false} onchange={(event) => option('showWithNarration', !event.currentTarget.checked)} />{t('pptx.slideShow.showWithoutNarration')}</label>
				<label><input type="checkbox" checked={draft.showWithAnimation === false} onchange={(event) => option('showWithAnimation', !event.currentTarget.checked)} />{t('pptx.slideShow.showWithoutAnimation')}</label>
				<label><input type="checkbox" checked={draft.showSubtitles ?? false} onchange={(event) => option('showSubtitles', event.currentTarget.checked)} />{t('pptx.slideShow.showSubtitles')}</label>
			</fieldset>
		</div>
		<footer><button type="button" onclick={onclose}>{t('pptx.common.cancel')}</button><button class="primary" type="button" onclick={save}>{t('pptx.common.ok')}</button></footer>
	</section>
</div>

<style>
	.backdrop{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;background:#0009}.scrim{position:absolute;inset:0;border:0;background:transparent}section{position:relative;width:min(440px,calc(100vw - 32px));max-height:90vh;overflow:auto;border:1px solid var(--pptx-border,#3f3f52);border-radius:12px;background:var(--pptx-card,#1e1e2e);color:inherit;box-shadow:0 24px 80px #0009}header,footer{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid var(--pptx-border,#3f3f52)}h2{margin:0;font-size:14px}.body{display:grid;gap:16px;padding:18px}fieldset{display:grid;gap:7px;border:0;margin:0;padding:0}legend{margin-bottom:5px;color:var(--pptx-muted-foreground,#94a3b8);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}label{display:flex;align-items:center;gap:8px;font-size:12px}input,select{accent-color:var(--pptx-primary,#c43b32)}select,input[type=number]{border:1px solid var(--pptx-border,#3f3f52);border-radius:5px;padding:4px;background:var(--pptx-muted,#2a2a3d);color:inherit}.range{display:flex;align-items:center;gap:8px;padding-left:24px}.range input{width:62px}button{border:1px solid var(--pptx-border,#3f3f52);border-radius:6px;padding:6px 11px;background:var(--pptx-muted,#2a2a3d);color:inherit}header button{border:0;background:transparent;font-size:20px}footer{justify-content:flex-end;gap:8px;border-top:1px solid var(--pptx-border,#3f3f52);border-bottom:0}.primary{border-color:var(--pptx-primary,#c43b32);background:var(--pptx-primary,#c43b32);color:#fff}@media(max-width:600px){section{position:fixed;inset:auto 0 0;width:100%;max-height:88dvh;border-radius:16px 16px 0 0}}
</style>
