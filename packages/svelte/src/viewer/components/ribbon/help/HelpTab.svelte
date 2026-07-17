<script lang="ts">
	import { useTranslator } from '../../../../i18n/context';

	const { onaccessibility, onshortcuts, onsettings }: { onaccessibility: () => void; onshortcuts: () => void; onsettings: () => void } = $props();
	const t = useTranslator();
</script>

<div class="help" role="group" aria-label={t('pptx.ribbon.tab.help')}>
	<button type="button" onclick={onshortcuts}>{t('pptx.settings.keyboardShortcuts')}</button>
	<button type="button" onclick={onsettings}>{t('pptx.settings.title')}</button>
	<button type="button" onclick={onaccessibility}>{t('pptx.ribbon.accessibilityCheck')}</button>
</div>

<style>
	.help { display: flex; align-items: center; gap: 6px; font-size: 11px; }
	.help button { height: 28px; border: 0; border-radius: var(--pptx-radius, 6px); padding: 0 8px; background: var(--pptx-muted); color: inherit; cursor: pointer; }
</style>
