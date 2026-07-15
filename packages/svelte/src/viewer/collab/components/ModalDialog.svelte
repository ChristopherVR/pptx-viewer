<script lang="ts">
	/**
	 * ModalDialog: a reusable, dismissable modal shell for the Svelte viewer's
	 * collaboration dialogs. Svelte port of the Vue `ModalDialog.vue` shell
	 * (minus the Teleport-to-body and swipe-to-dismiss touch gesture, which Vue
	 * needs because it mounts deep inside a large ribbon tree; this package's
	 * dialogs mount directly at the viewer root, alongside `ExportProgressModal`,
	 * so a plain fixed-position overlay is sufficient).
	 *
	 * Unlike `ExportProgressModal` (which is intentionally non-dismissable while
	 * an export is in flight), this shell closes on backdrop click, the close
	 * button, or Escape, since none of its callers block a critical operation.
	 */
	import { activateModalFocus } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { ModalDialogProps } from './props';

	const { open, title, onclose, children, footer }: ModalDialogProps = $props();

	const t = useTranslator();

	function onBackdropClick(): void {
		onclose();
	}

	function modalFocus(node: HTMLElement): { destroy(): void } {
		const release = activateModalFocus(node, { onEscape: onclose });
		return { destroy: release };
	}
</script>

{#if open}
	<div
		class="pptx-svelte-modal-backdrop"
		role="presentation"
		onclick={onBackdropClick}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
		<div
			use:modalFocus
			class="pptx-svelte-modal-panel"
			role="dialog"
			aria-modal="true"
			aria-label={title}
			tabindex="-1"
			onclick={(event) => event.stopPropagation()}
		>
			<header class="pptx-svelte-modal-header">
				{#if title}
					<h2 class="pptx-svelte-modal-title">{title}</h2>
				{:else}
					<span></span>
				{/if}
				<button
					type="button"
					class="pptx-svelte-modal-close"
					aria-label={t('pptx.settings.close')}
					onclick={onclose}
				>
					&times;
				</button>
			</header>
			<div class="pptx-svelte-modal-body">
				{@render children?.()}
			</div>
			{#if footer}
				<footer class="pptx-svelte-modal-footer">
					{@render footer()}
				</footer>
			{/if}
		</div>
	</div>
{/if}

<style>
	.pptx-svelte-modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1100;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.5);
	}

	.pptx-svelte-modal-panel {
		display: flex;
		flex-direction: column;
		width: min(92vw, 420px);
		max-height: 88vh;
		overflow: hidden;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 6px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
		overscroll-behavior: contain;
		font-family: system-ui, sans-serif;
	}

	.pptx-svelte-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--pptx-border, #33334d);
	}

	.pptx-svelte-modal-title {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		line-height: 1.3;
	}

	.pptx-svelte-modal-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 18px;
		line-height: 1;
		cursor: pointer;
	}

	.pptx-svelte-modal-close:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-modal-body {
		overflow-y: auto;
		padding: 16px;
	}

	.pptx-svelte-modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 12px 16px;
		border-top: 1px solid var(--pptx-border, #33334d);
	}
</style>
