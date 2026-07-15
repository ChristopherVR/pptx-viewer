<script lang="ts">
	import { useTranslator } from '../../../../i18n/context';
	const { onaccessibility }: { onaccessibility: () => void } = $props();
	const t = useTranslator();
	let shortcuts = $state(false);
</script>

<div class="help" role="group" aria-label={t('pptx.ribbon.tab.help')}>
	<button type="button" onclick={() => (shortcuts = !shortcuts)}>{t('pptx.settings.keyboardShortcuts')}</button>
	<button type="button" onclick={onaccessibility}>{t('pptx.ribbon.accessibilityCheck')}</button>
	{#if shortcuts}<span>Ctrl+Z Undo | Ctrl+Y Redo | Ctrl+C Copy | Ctrl+V Paste | Delete Remove</span>{/if}
</div>

<style>
	.help { display: flex; align-items: center; gap: 6px; font-size: 11px; }
	.help button { height: 28px; border: 0; border-radius: var(--pptx-radius, 6px); padding: 0 8px; background: var(--pptx-muted); color: inherit; cursor: pointer; }
	.help span { color: var(--pptx-muted-foreground); }
</style>
