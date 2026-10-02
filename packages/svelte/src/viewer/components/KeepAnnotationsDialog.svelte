<script lang="ts">
	import PenTool from '@lucide/svelte/icons/pen-tool';
	import { useTranslator } from '../../i18n/context';
	import DialogFooter from './DialogFooter.svelte';

	const { annotationCount, slideCount, onkeep, ondiscard }: { annotationCount: number; slideCount: number; onkeep: () => void; ondiscard: () => void } = $props();
	const t = useTranslator();
</script>
<div class="backdrop"><!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role --><section role="alertdialog" tabindex="-1" aria-modal="true" aria-labelledby="keep-title"><header><b><PenTool size={20} aria-hidden="true" /></b><div><h2 id="keep-title">{t('pptx.presentation.keepAnnotationsTitle')}</h2><p>{t('pptx.presentation.keepAnnotationsDescription', { count: annotationCount, slides: slideCount })}</p></div></header><footer><DialogFooter actions={[{ id: 'discard', label: t('pptx.presentation.discardAnnotations'), icon: 'trash' }, { id: 'keep', label: t('pptx.presentation.keepAnnotations'), variant: 'primary', icon: 'pen' }]} onaction={(id) => (id === 'keep' ? onkeep() : ondiscard())} /></footer></section></div>
<style>
	.backdrop{position:fixed;inset:0;z-index:1250;display:grid;place-items:center;background:#0009}section{width:min(420px,calc(100vw - 32px));padding:22px;border:1px solid var(--pptx-border,#3f3f52);border-radius:12px;background:var(--pptx-card,#1e1e2e);box-shadow:0 24px 80px #0009}header{display:flex;gap:12px}header>b{display:grid;width:40px;height:40px;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--pptx-primary,#c43b32) 18%,transparent);color:var(--pptx-primary,#c43b32)}h2,p{margin:0}h2{font-size:16px}p{margin-top:4px;color:var(--pptx-muted-foreground,#94a3b8);font-size:13px}footer{margin-top:24px}
</style>
