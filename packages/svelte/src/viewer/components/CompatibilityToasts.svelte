<script lang="ts">
	/**
	 * CompatibilityToasts: the bottom-right load-diagnostic stack for
	 * `PptxCompatibilityWarning`s (unmodelled markup, an external image
	 * reference, a chart workbook writeback that failed, and so on). Every
	 * warning already flows through the shared `compatibilityWarningToasts`
	 * decision function (`CompatToastsState`); this component only renders the
	 * list it returns. Svelte port of Vue's `CompatibilityToasts.vue`.
	 *
	 * Unlike a transient toast, these do not auto-hide: they are diagnostics
	 * about the LOADED document, so they persist until the user dismisses them
	 * (or the next load resets the stack).
	 */
	import type { CompatibilityWarningToast } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';

	const {
		toasts,
		overflowCount,
		ondismiss,
		ondismissall,
	}: {
		toasts: readonly CompatibilityWarningToast[];
		overflowCount: number;
		ondismiss: (id: string) => void;
		ondismissall: () => void;
	} = $props();

	const t = useTranslator();
</script>

{#if toasts.length > 0}
	<div
		class="pptx-svelte-compat-toasts pointer-events-none fixed bottom-4 right-4 z-[900] flex w-80 max-w-[90vw] flex-col gap-2"
		data-testid="pptx-compat-toasts"
	>
		<div class="pointer-events-auto flex items-center justify-between">
			<span class="text-[11px] font-semibold text-muted-foreground">{t('pptx.compatibility.toastTitle')}</span>
			<button
				type="button"
				data-testid="pptx-compat-toasts-dismiss-all"
				class="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:underline"
				onclick={ondismissall}
			>
				{t('pptx.compatibility.dismissAll')}
			</button>
		</div>

		{#each toasts as toast (toast.id)}
			<div
				class="pptx-svelte-compat-toast pointer-events-auto flex items-start gap-2 rounded-md border border-border bg-popover p-2.5 text-xs shadow-lg"
				data-testid="pptx-compat-toast"
				data-code={toast.code}
				data-severity={toast.severity}
			>
				<span class="mt-0.5 shrink-0" aria-hidden="true">{toast.severity === 'warning' ? '⚠️' : 'ℹ️'}</span>
				<p class="flex-1 text-foreground">{t(toast.messageKey, toast.params)}</p>
				<button
					type="button"
					data-testid="pptx-compat-toast-dismiss"
					aria-label={t('pptx.compatibility.dismiss')}
					class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
					onclick={() => ondismiss(toast.id)}
				>
					&#10005;
				</button>
			</div>
		{/each}

		{#if overflowCount > 0}
			<p class="pointer-events-auto text-center text-[11px] text-muted-foreground">+{overflowCount}</p>
		{/if}
	</div>
{/if}
