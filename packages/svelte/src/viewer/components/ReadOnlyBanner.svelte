<script lang="ts">
	/**
	 * ReadOnlyBanner: shown above the canvas (under the ribbon/toolbar) when the
	 * loaded deck recommends opening read-only (`p:modifyVerifier` or "Mark as
	 * Final"). Mirrors this binding's Protected View banner's look
	 * (`ProtectedViewBanner.svelte`); the recommendation itself is a pure shared
	 * decision (`readOnlyRecommendation`, `pptx-viewer-shared`) computed by
	 * `ReadOnlyRecommendationState`, this component only renders it.
	 *
	 * Styled with a scoped stylesheet block below rather than Tailwind utility
	 * classes: this package's Tailwind is never scanned by the demo (see the
	 * repo's CLAUDE.md), so a Tailwind-only banner silently renders unstyled
	 * and its content wraps onto the canvas below.
	 */
	import type { ReadOnlyRecommendationKind } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';

	const {
		kind,
		messageKey,
		oneditanyway,
		ondismiss,
	}: {
		kind: ReadOnlyRecommendationKind;
		messageKey: string;
		oneditanyway: () => void;
		ondismiss: () => void;
	} = $props();

	const t = useTranslator();
</script>

{#if kind}
	<div
		class="pptx-svelte-readonly-banner"
		role="status"
		data-testid="pptx-readonly-banner"
		data-kind={kind}
	>
		<span class="pptx-svelte-readonly-banner-icon" aria-hidden="true">🔒</span>
		<p class="pptx-svelte-readonly-banner-text">
			<strong>{t('pptx.readOnly.bannerTitle')}</strong>: {t(messageKey)}
		</p>
		<button
			type="button"
			data-testid="pptx-readonly-edit-anyway"
			class="pptx-svelte-readonly-banner-edit"
			onclick={oneditanyway}
		>
			{t('pptx.readOnly.editAnyway')}
		</button>
		<button
			type="button"
			data-testid="pptx-readonly-dismiss"
			class="pptx-svelte-readonly-banner-dismiss"
			onclick={ondismiss}
		>
			{t('pptx.readOnly.dismiss')}
		</button>
	</div>
{/if}

<style>
	.pptx-svelte-readonly-banner {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 16px;
		border-bottom: 1px solid rgba(180, 83, 9, 0.3);
		background: rgba(120, 53, 15, 0.2);
		font-size: 12px;
	}
	.pptx-svelte-readonly-banner-icon {
		flex: none;
		width: 16px;
		height: 16px;
		color: #fbbf24;
	}
	.pptx-svelte-readonly-banner-text {
		flex: 1 1 auto;
		margin: 0;
		color: #fde68a;
		font-size: 12px;
	}
	.pptx-svelte-readonly-banner-edit {
		flex: none;
		border: 1px solid rgba(217, 119, 6, 0.5);
		border-radius: 4px;
		padding: 4px 12px;
		background: transparent;
		color: #fef3c7;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}
	.pptx-svelte-readonly-banner-edit:hover {
		background: rgba(180, 83, 9, 0.3);
	}
	.pptx-svelte-readonly-banner-dismiss {
		flex: none;
		border: 0;
		border-radius: 4px;
		padding: 4px 8px;
		background: transparent;
		color: rgba(253, 230, 138, 0.8);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}
	.pptx-svelte-readonly-banner-dismiss:hover {
		background: rgba(180, 83, 9, 0.2);
	}
</style>
