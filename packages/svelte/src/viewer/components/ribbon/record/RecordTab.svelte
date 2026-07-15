<script lang="ts">
	import { useTranslator } from '../../../../i18n/context';
	const t = useTranslator();
</script>

<div class="record" role="group" aria-label={t('pptx.ribbon.tab.record')}>
	<span aria-hidden="true"></span>{t('pptx.titleBar.record')}
</div>

<style>
	.record { display: flex; align-items: center; gap: 8px; padding: 5px 8px; font-size: 12px; }
	.record span { width: 12px; height: 12px; border-radius: 50%; background: #ef4444; }
</style>
