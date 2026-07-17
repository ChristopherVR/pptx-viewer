<script lang="ts">
	import { useTranslator } from '../../i18n/context';

	const { signatureCount, onclose }: { signatureCount: number; onclose: () => void } = $props();
	const t = useTranslator();
</script>

<div class="backdrop">
	<button class="scrim" type="button" aria-label={t('pptx.common.close')} onclick={onclose}></button>
	<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="pptx-svelte-signature-warning-title">
		<header><span>!</span><h2 id="pptx-svelte-signature-warning-title">{t('pptx.digitalSignatures.strippedTitle')}</h2><button type="button" aria-label={t('pptx.common.close')} onclick={onclose}>×</button></header>
		<div class="body"><div class="warning"><b>!</b><div><p>{t('pptx.digitalSignatures.strippedMessage', { count: signatureCount })}</p><small>{t('pptx.digitalSignatures.editWarning')}</small></div></div></div>
		<footer><button type="button" onclick={onclose}>{t('pptx.common.cancel')}</button><button class="primary" type="button" onclick={onclose}>{t('pptx.digitalSignatures.strippedConfirm')}</button></footer>
	</div>
</div>

<style>
	.backdrop{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;background:#0009;font-family:Aptos,"Segoe UI",sans-serif}.scrim{position:absolute;inset:0;border:0;background:transparent}.dialog{position:relative;width:min(440px,calc(100vw - 32px));border:1px solid var(--pptx-border,#3f3f52);border-radius:12px;background:var(--pptx-card,#1e1e2e);color:var(--pptx-card-foreground,#e2e8f0);box-shadow:0 24px 80px #0009}header,footer{display:flex;align-items:center;padding:14px 18px;border-bottom:1px solid var(--pptx-border,#3f3f52)}header{gap:9px}header>span,.warning>b{display:grid;width:24px;height:24px;flex:none;place-items:center;border-radius:50%;background:#92400e55;color:#fbbf24;font-weight:700}h2{flex:1;margin:0;font-size:14px}button{border:1px solid var(--pptx-border,#3f3f52);border-radius:6px;padding:7px 11px;background:var(--pptx-muted,#2a2a3d);color:inherit}.body{padding:22px}.warning{display:flex;align-items:flex-start;gap:12px;padding:14px;border:1px solid #b4530966;border-radius:9px;background:#78350f33;color:#fde68a}.warning p{margin:0;font-size:12px;line-height:1.5}.warning small{display:block;margin-top:8px;opacity:.72;line-height:1.45}footer{justify-content:flex-end;gap:8px;border-top:1px solid var(--pptx-border,#3f3f52);border-bottom:0}.primary{border-color:#d97706;background:#d97706;color:#fff}@media(max-width:600px){.backdrop{place-items:end center}.dialog{width:100%;border-radius:16px 16px 0 0}}
</style>
