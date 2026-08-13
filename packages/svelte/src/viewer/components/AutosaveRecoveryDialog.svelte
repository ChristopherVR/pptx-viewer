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
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import type { AutosaveRecoveryPrompt } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';

	const { prompt, onrestore, ondiscard }: { prompt: AutosaveRecoveryPrompt; onrestore: () => void; ondiscard: () => void } = $props();
	const t = useTranslator();
	const title = $derived(t(prompt.titleKey));
	const savedLabel = $derived(t('pptx.autosave.recovery.savedLabel', { when: t(prompt.ageKey, prompt.ageParams) }));
</script>
<div class="backdrop" data-pptx-autosave-recovery="true"><!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role --><section role="dialog" tabindex="-1" aria-modal="true" aria-label={title}><header><b><History size={20} aria-hidden="true" /></b><div><h2>{title}</h2><p>{t(prompt.messageKey, prompt.messageParams)}</p><small>{savedLabel}</small></div></header><footer><button type="button" onclick={ondiscard}><Trash2 size={16} aria-hidden="true" /> {t(prompt.discardKey)}</button><button class="primary" type="button" onclick={onrestore}><RotateCcw size={16} aria-hidden="true" /> {t(prompt.restoreKey)}</button></footer></section></div>
<style>
	.backdrop{position:fixed;inset:0;z-index:1250;display:grid;place-items:center;background:#0009}section{width:min(420px,calc(100vw - 32px));padding:22px;border:1px solid var(--pptx-border,#3f3f52);border-radius:12px;background:var(--pptx-card,#1e1e2e);box-shadow:0 24px 80px #0009}header{display:flex;gap:12px}header>b{display:grid;width:40px;height:40px;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--pptx-primary,#c43b32) 18%,transparent);color:var(--pptx-primary,#c43b32)}h2,p{margin:0}h2{font-size:16px}p{margin-top:4px;color:var(--pptx-muted-foreground,#94a3b8);font-size:13px}small{display:block;margin-top:6px;color:var(--pptx-muted-foreground,#94a3b8);font-size:12px}footer{display:flex;justify-content:flex-end;gap:8px;margin-top:24px}button{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--pptx-border,#3f3f52);border-radius:6px;padding:8px 12px;background:var(--pptx-muted,#2a2a3d);color:inherit}.primary{background:var(--pptx-primary,#c43b32);color:#fff}
</style>
