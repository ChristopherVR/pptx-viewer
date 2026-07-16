<script lang="ts">
	import { useTranslator } from '../../../../i18n/context';

	const { onfrombeginning, onfromcurrent }: { onfrombeginning: () => void; onfromcurrent: () => void } = $props();
	const t = useTranslator();
</script>

<div class="record" role="group" aria-label={t('pptx.ribbon.tab.record')}>
	<button type="button" onclick={onfrombeginning} title={t('pptx.slideShow.fromBeginningTooltip')}>
		<span aria-hidden="true"></span>{t('pptx.slideShow.fromBeginning')}
	</button>
	<button type="button" onclick={onfromcurrent} title={t('pptx.slideShow.fromCurrentTooltip')}>
		<span aria-hidden="true"></span>{t('pptx.slideShow.fromCurrent')}
	</button>
</div>

<style>
	.record { display: flex; align-items: center; gap: 8px; padding: 5px 8px; font-size: 12px; }
	.record button { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border: 0; border-radius: 4px; background: transparent; color: inherit; cursor: pointer; font: inherit; }
	.record button:hover { background: var(--pptx-accent, #33334d); }
	.record span { width: 12px; height: 12px; border: 2px solid #ef4444; border-radius: 50%; background: #ef4444; box-shadow: inset 0 0 0 2px var(--pptx-card, #1e1e2e); }
</style>
