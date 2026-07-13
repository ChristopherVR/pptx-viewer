<script lang="ts">
	/** Slide Show ribbon pane, limited to actions the Svelte viewer implements. */
	import { useTranslator } from '../../../../i18n/context';

	const {
		onfrombeginning,
		onfromcurrent,
		onbroadcast,
	}: {
		onfrombeginning: () => void;
		onfromcurrent: () => void;
		onbroadcast?: () => void;
	} = $props();
	const t = useTranslator();
</script>

<div class="pptx-svelte-slideshowtab" role="group" aria-label={t('pptx.ribbon.tab.slideShow')}>
	<button type="button" onclick={onfrombeginning} title={t('pptx.slideShow.fromBeginningTooltip')}>
		<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 3 11 7-11 7zM16.5 3v14" /></svg>
		<span>{t('pptx.slideShow.fromBeginning')}</span>
	</button>
	<button type="button" onclick={onfromcurrent} title={t('pptx.slideShow.fromCurrentTooltip')}>
		<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 3 11 7-11 7z" /></svg>
		<span>{t('pptx.slideShow.fromCurrent')}</span>
	</button>
	{#if onbroadcast}
		<button type="button" onclick={onbroadcast} title={t('pptx.slideShow.broadcastTooltip')}>
			<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="1.5" fill="currentColor" /><path d="M7 7a4.2 4.2 0 0 0 0 6M13 7a4.2 4.2 0 0 1 0 6M4.5 4.5a7.8 7.8 0 0 0 0 11M15.5 4.5a7.8 7.8 0 0 1 0 11" /></svg>
			<span>{t('pptx.slideShow.broadcast')}</span>
		</button>
	{/if}
</div>

<style>
	.pptx-svelte-slideshowtab { display:flex; align-items:stretch; gap:4px; }
	.pptx-svelte-slideshowtab button { display:flex; min-width:68px; flex-direction:column; align-items:center; gap:3px; border:0; border-radius:4px; padding:4px 8px; background:transparent; color:inherit; font:11px system-ui,sans-serif; cursor:pointer; }.pptx-svelte-slideshowtab button:hover { background:var(--pptx-accent,#33334d); }.pptx-svelte-slideshowtab svg { width:23px; height:23px; fill:none; stroke:currentColor; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; }
</style>
