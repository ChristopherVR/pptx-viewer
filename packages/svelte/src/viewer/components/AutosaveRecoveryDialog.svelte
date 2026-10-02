<script lang="ts">
	/**
	 * AutosaveRecoveryDialog: "Recover unsaved changes?" for a deck that has a
	 * crash-recovery snapshot in the shared IndexedDB store.
	 *
	 * Purely presentational, and deliberately dumb: every decision (whether a
	 * snapshot is worth offering, how old it is, which strings describe it) is
	 * already made by `pptx-viewer-shared`'s `autosaveRecoveryPrompt` and arrives
	 * here as the descriptor below, so all five bindings show the same dialog.
	 */
	import History from '@lucide/svelte/icons/history';
	import type { AutosaveRecoveryPrompt } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import DialogFooter from './DialogFooter.svelte';

	const { prompt, discarding = false, onrestore, ondiscard }: { prompt: AutosaveRecoveryPrompt; discarding?: boolean; onrestore: () => void; ondiscard: () => void } = $props();
	const t = useTranslator();
	const title = $derived(t(prompt.titleKey));
	const savedLabel = $derived(t('pptx.autosave.recovery.savedLabel', { when: t(prompt.ageKey, prompt.ageParams) }));
</script>
<div class="backdrop" data-pptx-autosave-recovery="true"><!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role --><section role="dialog" tabindex="-1" aria-modal="true" aria-label={title} aria-busy={discarding}><header><b><History size={20} aria-hidden="true" /></b><div><h2>{title}</h2><p>{t(prompt.messageKey, prompt.messageParams)}</p><small>{savedLabel}</small></div></header><footer><DialogFooter actions={[{ id: 'discard', label: t(prompt.discardKey), icon: 'trash', disabled: discarding }, { id: 'restore', label: t(prompt.restoreKey), variant: 'primary', icon: 'restore', disabled: discarding }]} onaction={(id) => (id === 'restore' ? onrestore() : ondiscard())} /></footer></section></div>
<style>
	.backdrop{position:fixed;inset:0;z-index:1250;display:grid;place-items:center;padding:16px;background:#0009}section{width:min(420px,100%);max-height:calc(100dvh - 32px);overflow-y:auto;padding:22px;border:1px solid var(--pptx-border,#3f3f52);border-radius:12px;background:var(--pptx-card,#1e1e2e);box-shadow:0 24px 80px #0009}header{display:flex;gap:12px}header>b{display:grid;width:40px;height:40px;flex:0 0 40px;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--pptx-primary,#c43b32) 18%,transparent);color:var(--pptx-primary,#c43b32)}header>div{min-width:0}h2,p{margin:0}h2{font-size:16px}p{margin-top:4px;overflow-wrap:anywhere;color:var(--pptx-muted-foreground,#94a3b8);font-size:13px}small{display:block;margin-top:6px;color:var(--pptx-muted-foreground,#94a3b8);font-size:12px}footer{margin-top:24px}
</style>
