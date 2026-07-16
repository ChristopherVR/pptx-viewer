<script lang="ts">
	/** Slide Show ribbon pane, limited to actions the Svelte viewer implements. */
	import { useTranslator } from '../../../../i18n/context';

	const {
		onfrombeginning,
		onfromcurrent,
		onbroadcast,
		onpresenter,
		onsetup,
		onrehearse,
		onsubtitles,
		oncustomshows,
	}: {
		onfrombeginning: () => void;
		onfromcurrent: () => void;
		onbroadcast?: () => void;
		onpresenter: () => void;
		onsetup: () => void;
		onrehearse: () => void;
		onsubtitles: () => void;
		oncustomshows: () => void;
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
	<button type="button" onclick={onpresenter} title={t('pptx.slideShow.presenterViewTooltip')}>
		<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="3" width="16" height="11" rx="1" /><path d="M7 18h6M10 14v4" /></svg>
		<span>{t('pptx.slideShow.presenterView')}</span>
	</button>
	<button type="button" onclick={onsetup} title={t('pptx.slideShow.setUpTooltip')}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M6 10h8M8 15h4M6 3v4M12 8v4M10 13v4" /></svg><span>{t('pptx.slideShow.setUp')}</span></button>
	<button type="button" onclick={onrehearse} title={t('pptx.slideShow.rehearseTimingsTooltip')}><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" /></svg><span>{t('pptx.slideShow.rehearseTimings')}</span></button>
	<button type="button" onclick={onsubtitles} title={t('pptx.slideShow.subtitlesTooltip')}><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="4" width="16" height="12" rx="2" /><path d="M5 9h4M11 9h4M5 12h3M10 12h5" /></svg><span>{t('pptx.slideShow.subtitles')}</span></button>
	<button type="button" onclick={oncustomshows} title={t('pptx.customShows.customShowTooltip')}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4h12v12H4zM7 8h6M7 11h6" /></svg><span>{t('pptx.ribbon.customShowsButton')}</span></button>
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
