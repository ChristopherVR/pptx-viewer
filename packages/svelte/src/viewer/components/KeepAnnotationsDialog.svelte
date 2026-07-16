<script lang="ts">
	import { useTranslator } from '../../i18n/context';
	const { annotationCount, slideCount, onkeep, ondiscard }: { annotationCount: number; slideCount: number; onkeep: () => void; ondiscard: () => void } = $props();
	const t = useTranslator();
</script>
<div class="backdrop"><!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role --><section role="alertdialog" tabindex="-1" aria-modal="true" aria-labelledby="keep-title"><header><b>✎</b><div><h2 id="keep-title">{t('pptx.presentation.keepAnnotationsTitle')}</h2><p>{t('pptx.presentation.keepAnnotationsDescription', { count: annotationCount, slides: slideCount })}</p></div></header><footer><button type="button" onclick={ondiscard}>⌫ {t('pptx.presentation.discardAnnotations')}</button><button class="primary" type="button" onclick={onkeep}>✎ {t('pptx.presentation.keepAnnotations')}</button></footer></section></div>
<style>
	.backdrop{position:fixed;inset:0;z-index:1250;display:grid;place-items:center;background:#0009}section{width:min(420px,calc(100vw - 32px));padding:22px;border:1px solid var(--pptx-border,#3f3f52);border-radius:12px;background:var(--pptx-card,#1e1e2e);box-shadow:0 24px 80px #0009}header{display:flex;gap:12px}header>b{display:grid;width:40px;height:40px;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--pptx-primary,#c43b32) 18%,transparent);color:var(--pptx-primary,#c43b32)}h2,p{margin:0}h2{font-size:16px}p{margin-top:4px;color:var(--pptx-muted-foreground,#94a3b8);font-size:13px}footer{display:flex;justify-content:flex-end;gap:8px;margin-top:24px}button{border:1px solid var(--pptx-border,#3f3f52);border-radius:6px;padding:8px 12px;background:var(--pptx-muted,#2a2a3d);color:inherit}.primary{background:var(--pptx-primary,#c43b32);color:#fff}
</style>
