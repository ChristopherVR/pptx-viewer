<script lang="ts">
	/**
	 * RecordTab: the ribbon's Record tab, at React's `RecordSection` control
	 * set (Camera / Record / Manage / Help).
	 *
	 * Only the two "start recording" commands do anything. Cameo, Clear, Reset
	 * to Cameo and Learn More are camera-feed features no binding implements,
	 * and React ships them as permanently disabled placeholders. They are
	 * reproduced here in the same disabled state rather than omitted: a tab
	 * that silently drops half its buttons is the drift
	 * `e2e/ribbon-control-inventory.spec.ts` exists to catch, and a greyed-out
	 * button tells a user "not built yet" where a missing one tells them "you
	 * are on the wrong binding".
	 *
	 * The placeholder labels go through `t()` with keys that have no dictionary
	 * entry yet, so the shared `keyToLabel` fallback renders them; React's
	 * i18next instance is configured with that same fallback
	 * (`parseMissingKeyHandler`), which is what keeps the two accessible names
	 * identical without inventing translations for a control that does nothing.
	 */
	import { useTranslator } from '../../../../i18n/context';

	const { onfrombeginning, onfromcurrent }: { onfrombeginning: () => void; onfromcurrent: () => void } = $props();
	const t = useTranslator();
</script>

<div class="record" role="group" aria-label={t('pptx.ribbon.tab.record')}>
	<button type="button" class="record-flat" disabled title={t('pptx.record.cameo')}>
		<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="5" width="11" height="10" rx="2" /><path d="m13 10 5-3v6z" /></svg>
		<span>{t('pptx.record.cameo')}</span>
	</button>
	<span class="record-sep" aria-hidden="true"></span>
	<button type="button" onclick={onfrombeginning} title={t('pptx.slideShow.fromBeginningTooltip')}>
		<span class="record-dot" aria-hidden="true"></span>{t('pptx.slideShow.fromBeginning')}
	</button>
	<button type="button" onclick={onfromcurrent} title={t('pptx.slideShow.fromCurrentTooltip')}>
		<span class="record-dot" aria-hidden="true"></span>{t('pptx.slideShow.fromCurrent')}
	</button>
	<span class="record-sep" aria-hidden="true"></span>
	<button type="button" class="record-flat" disabled title={t('pptx.record.clear')}>
		<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 13 6-6 4 4-6 6H6zM3 17h14" /></svg>
		<span>{t('pptx.record.clear')}</span>
	</button>
	<button type="button" class="record-flat" disabled title={t('pptx.record.resetToCameo')}>
		<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10a6 6 0 1 1 1.8 4.2M4 6v4h4" /></svg>
		<span>{t('pptx.record.resetToCameo')}</span>
	</button>
	<span class="record-sep" aria-hidden="true"></span>
	<button type="button" class="record-flat" disabled title={t('pptx.record.learnMore')}>
		<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="M8.3 8a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1M10 13.6v.01" /></svg>
		<span>{t('pptx.record.learnMore')}</span>
	</button>
</div>

<style>
	.record { display: flex; align-items: center; gap: 6px; padding: 5px 8px; font-size: 12px; }
	.record button { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border: 0; border-radius: 4px; background: transparent; color: inherit; cursor: pointer; font: inherit; }
	.record button:hover:not(:disabled) { background: var(--pptx-accent, #33334d); }
	.record button:disabled { opacity: 0.35; cursor: default; }
	.record-dot { width: 12px; height: 12px; border: 2px solid #ef4444; border-radius: 50%; background: #ef4444; box-shadow: inset 0 0 0 2px var(--pptx-card, #1e1e2e); }
	.record svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
	.record-sep { width: 1px; height: 20px; background: var(--pptx-border, #33334d); }
</style>
