<script lang="ts">
	import { VIEWER_SHORTCUT_REFERENCE } from 'pptx-viewer-shared';
	import { useTranslator } from '../../i18n/context';

	const { onclose }: { onclose: () => void } = $props();
	const t = useTranslator();
</script>
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<aside class="panel" role="dialog" tabindex="-1" aria-labelledby="shortcuts-title">
	<header><h2 id="shortcuts-title">{t('pptx.shortcuts.title')}</h2><button type="button" onclick={onclose}>{t('pptx.shortcuts.close')}</button></header>
	<div>{#each VIEWER_SHORTCUT_REFERENCE as shortcut, index}<p class:stripe={index % 2 === 0}><span>{t(shortcut.actionKey)}</span><kbd>{shortcut.shortcut}</kbd></p>{/each}</div>
</aside>
<style>
	.panel{position:absolute;z-index:80;top:56px;right:12px;width:min(384px,calc(100% - 24px));overflow:hidden;border:1px solid var(--pptx-border,#3f3f52);border-radius:8px;background:var(--pptx-card,#1e1e2e);box-shadow:0 18px 50px #0008}header{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border-bottom:1px solid var(--pptx-border,#3f3f52)}h2{margin:0;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}button{border:0;border-radius:5px;padding:5px 8px;background:transparent;color:inherit;font-size:11px}button:hover{background:var(--pptx-muted,#2a2a3d)}div{max-height:280px;overflow:auto;padding:8px}p{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:0;padding:7px 9px;border-radius:5px;font-size:12px}.stripe{background:var(--pptx-muted,#2a2a3d)}kbd{color:var(--pptx-muted-foreground,#94a3b8);font:11px ui-monospace,monospace;white-space:nowrap}
</style>
