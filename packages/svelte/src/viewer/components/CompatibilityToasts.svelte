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
	 *
	 * Positioning: the stack's container style comes from shared's
	 * `compatToastStackStyleAttr()` (`COMPAT_TOAST_METRICS`), not a Tailwind
	 * `fixed bottom-* right-*` class, which this package's Tailwind never sees
	 * (see the repo's CLAUDE.md). It is positioned relative to the VIEWER ROOT
	 * (`PowerPointViewer.svelte`'s `.pptx-svelte-viewer`, which already
	 * establishes the containing block the dialogs use), anchored above the
	 * status bar rather than the page corner, so a toast can never cover the
	 * status bar's "Slide show" button.
	 */
	import type { CompatibilityWarningToast } from 'pptx-viewer-shared';
	import { compatToastStackStyleAttr } from 'pptx-viewer-shared';

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
	const stackStyle = compatToastStackStyleAttr();
</script>

{#if toasts.length > 0}
	<div class="pptx-svelte-compat-toasts" style={stackStyle} data-testid="pptx-compat-toasts">
		<div class="pptx-svelte-compat-toasts-header">
			<span class="pptx-svelte-compat-toasts-title">{t('pptx.compatibility.toastTitle')}</span>
			<button
				type="button"
				data-testid="pptx-compat-toasts-dismiss-all"
				class="pptx-svelte-compat-toasts-dismiss-all"
				onclick={ondismissall}
			>
				{t('pptx.compatibility.dismissAll')}
			</button>
		</div>

		{#each toasts as toast (toast.id)}
			<div
				class="pptx-svelte-compat-toast"
				data-testid="pptx-compat-toast"
				data-code={toast.code}
				data-severity={toast.severity}
			>
				<span class="pptx-svelte-compat-toast-icon" aria-hidden="true"
					>{toast.severity === 'warning' ? '⚠️' : 'ℹ️'}</span
				>
				<p class="pptx-svelte-compat-toast-message">{t(toast.messageKey, toast.params)}</p>
				<button
					type="button"
					data-testid="pptx-compat-toast-dismiss"
					aria-label={t('pptx.compatibility.dismiss')}
					class="pptx-svelte-compat-toast-dismiss"
					onclick={() => ondismiss(toast.id)}
				>
					&#10005;
				</button>
			</div>
		{/each}

		{#if overflowCount > 0}
			<p class="pptx-svelte-compat-toasts-overflow">+{overflowCount}</p>
		{/if}
	</div>
{/if}

<style>
	/* The container's position/size/z-index come from the inline `style`
	   attribute (shared's COMPAT_TOAST_METRICS); this block only styles what a
	   scoped stylesheet can express (colors, borders, per-toast layout). */
	.pptx-svelte-compat-toasts-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		pointer-events: auto;
	}
	.pptx-svelte-compat-toasts-title {
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 11px;
		font-weight: 600;
	}
	.pptx-svelte-compat-toasts-dismiss-all {
		border: 0;
		background: transparent;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
		pointer-events: auto;
	}
	.pptx-svelte-compat-toasts-dismiss-all:hover {
		text-decoration: underline;
	}
	.pptx-svelte-compat-toast {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 6px;
		padding: 10px;
		background: var(--pptx-popover, #1e1e2e);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
		font-size: 12px;
		pointer-events: auto;
	}
	.pptx-svelte-compat-toast-icon {
		flex: none;
		margin-top: 2px;
	}
	.pptx-svelte-compat-toast-message {
		flex: 1 1 auto;
		margin: 0;
		color: var(--pptx-foreground, #e2e8f0);
	}
	.pptx-svelte-compat-toast-dismiss {
		flex: none;
		border: 0;
		border-radius: 4px;
		padding: 2px;
		background: transparent;
		color: var(--pptx-muted-foreground, #94a3b8);
		cursor: pointer;
	}
	.pptx-svelte-compat-toast-dismiss:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-foreground, #e2e8f0);
	}
	.pptx-svelte-compat-toasts-overflow {
		margin: 0;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 11px;
		text-align: center;
		pointer-events: none;
	}
</style>
