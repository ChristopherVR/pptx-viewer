<script lang="ts">
	/**
	 * RunProgramNotices: the notice stack shown during a running show when an
	 * on-slide `ppaction://program` ("Run program") action is clicked. A
	 * browser cannot launch the author's command, so each click raises a
	 * dismissible, non-blocking notice naming the exact resolved command
	 * (`pptx-viewer-shared`'s `buildRunProgramNotice`) instead of silently doing
	 * nothing or blocking the show with a native `alert`/`confirm`.
	 *
	 * Deliberately a sibling of `CompatibilityToasts.svelte` rather than an
	 * extension of it: the two notice kinds carry unrelated data (a load
	 * diagnostic vs. a resolved shell command) and unrelated actions (dismiss
	 * vs. dismiss + copy). They do share the same visual primitive though, the
	 * `pptx-viewer-shared` toast-stack positioning (`compatToastStackStyleAttr`),
	 * reused here for a consistent look; the two stacks never actually overlap
	 * on screen since compat toasts hide in fullscreen and this one only
	 * renders in fullscreen (see `PresentationOverlays.svelte`).
	 */
	import type { RunProgramNotice } from 'pptx-viewer-shared';
	import { canUseClipboard, compatToastStackStyleAttr } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';

	const {
		notices,
		ondismiss,
	}: {
		notices: readonly RunProgramNotice[];
		ondismiss: (id: string) => void;
	} = $props();

	const t = useTranslator();
	const stackStyle = compatToastStackStyleAttr();
	const clipboardAvailable = canUseClipboard(
		typeof navigator === 'undefined' ? undefined : navigator,
	);

	function copy(target: string): void {
		if (!clipboardAvailable) {
			return;
		}
		void navigator.clipboard.writeText(target);
	}
</script>

{#if notices.length > 0}
	<div class="pptx-svelte-run-program-notices" style={stackStyle}>
		{#each notices as notice (notice.id)}
			<div
				class="pptx-svelte-run-program-notice"
				data-testid="pptx-run-program-notice"
				data-target={notice.target}
			>
				<span class="pptx-svelte-run-program-notice-icon" aria-hidden="true">&#9888;&#65039;</span>
				<p class="pptx-svelte-run-program-notice-message">
					{t(notice.messageKey, { target: notice.target })}
				</p>
				<div class="pptx-svelte-run-program-notice-actions">
					{#if clipboardAvailable}
						<button
							type="button"
							data-testid="pptx-run-program-notice-copy"
							class="pptx-svelte-run-program-notice-copy"
							onclick={() => copy(notice.target)}
						>
							{t(notice.copyLabelKey)}
						</button>
					{/if}
					<button
						type="button"
						aria-label={t('pptx.compatibility.dismiss')}
						class="pptx-svelte-run-program-notice-dismiss"
						onclick={() => ondismiss(notice.id)}
					>
						&#10005;
					</button>
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	/* The container's position/size/z-index come from the inline `style`
	   attribute (shared's COMPAT_TOAST_METRICS); this block only styles what a
	   scoped stylesheet can express (colors, borders, per-notice layout). */
	.pptx-svelte-run-program-notice {
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
	.pptx-svelte-run-program-notice-icon {
		flex: none;
		margin-top: 2px;
	}
	.pptx-svelte-run-program-notice-message {
		flex: 1 1 auto;
		margin: 0;
		color: var(--pptx-foreground, #e2e8f0);
		word-break: break-word;
	}
	.pptx-svelte-run-program-notice-actions {
		display: flex;
		flex: none;
		flex-direction: column;
		align-items: stretch;
		gap: 4px;
	}
	.pptx-svelte-run-program-notice-copy {
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 4px;
		padding: 2px 8px;
		background: transparent;
		color: var(--pptx-foreground, #e2e8f0);
		font-size: 11px;
		cursor: pointer;
	}
	.pptx-svelte-run-program-notice-copy:hover {
		background: var(--pptx-accent, #33334d);
	}
	.pptx-svelte-run-program-notice-dismiss {
		border: 0;
		border-radius: 4px;
		padding: 2px;
		background: transparent;
		color: var(--pptx-muted-foreground, #94a3b8);
		cursor: pointer;
	}
	.pptx-svelte-run-program-notice-dismiss:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-foreground, #e2e8f0);
	}
</style>
