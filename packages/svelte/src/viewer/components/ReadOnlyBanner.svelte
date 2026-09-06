<script lang="ts">
	/**
	 * ReadOnlyBanner: shown above the canvas (under the ribbon/toolbar) when the
	 * loaded deck recommends opening read-only (`p:modifyVerifier` or "Mark as
	 * Final"). Mirrors this binding's Protected View banner's look
	 * (`ProtectedViewBanner.svelte`); the recommendation itself is a pure shared
	 * decision (`readOnlyRecommendation`, `pptx-viewer-shared`) computed by
	 * `ReadOnlyRecommendationState`, this component only renders it.
	 *
	 * When `passwordpromptopen` is set (a `modifyVerifier` with a hash this
	 * viewer can check), the two buttons are replaced by an inline password
	 * form: PowerPoint's own "read-only recommended" prompt keeps the deck
	 * locked until the correct password is entered, and a wrong one leaves it
	 * locked.
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
		passwordpromptopen = false,
		passworderror = null,
		checkingpassword = false,
		onsubmitpassword,
		oncancelpassword,
	}: {
		kind: ReadOnlyRecommendationKind;
		messageKey: string;
		oneditanyway: () => void;
		ondismiss: () => void;
		passwordpromptopen?: boolean;
		passworderror?: 'wrong-password' | 'unsupported-algorithm' | null;
		checkingpassword?: boolean;
		onsubmitpassword?: (password: string) => void;
		oncancelpassword?: () => void;
	} = $props();

	const t = useTranslator();
	let password = $state('');

	function handleSubmit(event: SubmitEvent): void {
		event.preventDefault();
		onsubmitpassword?.(password);
	}
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
		{#if passwordpromptopen}
			<form
				data-testid="pptx-readonly-password-form"
				class="pptx-svelte-readonly-banner-password-form"
				onsubmit={handleSubmit}
			>
				<label for="pptx-svelte-readonly-password-input" class="pptx-svelte-sr-only">
					{t('pptx.readOnly.passwordLabel')}
				</label>
				<input
					id="pptx-svelte-readonly-password-input"
					data-testid="pptx-readonly-password-input"
					type="password"
					disabled={checkingpassword}
					bind:value={password}
					placeholder={t('pptx.readOnly.passwordPlaceholder')}
					aria-invalid={passworderror !== null}
					aria-describedby={passworderror !== null
						? 'pptx-svelte-readonly-password-error'
						: undefined}
					class="pptx-svelte-readonly-banner-password-input"
				/>
				<button
					type="submit"
					data-testid="pptx-readonly-unlock"
					disabled={checkingpassword}
					class="pptx-svelte-readonly-banner-edit"
				>
					{t('pptx.readOnly.unlock')}
				</button>
				<button
					type="button"
					data-testid="pptx-readonly-password-cancel"
					class="pptx-svelte-readonly-banner-dismiss"
					onclick={oncancelpassword}
				>
					{t('pptx.common.cancel')}
				</button>
				{#if passworderror !== null}
					<span
						id="pptx-svelte-readonly-password-error"
						role="alert"
						data-testid="pptx-readonly-password-error"
						class="pptx-svelte-readonly-banner-password-error"
					>
						{t(
							passworderror === 'wrong-password'
								? 'pptx.readOnly.wrongPassword'
								: 'pptx.readOnly.unsupportedAlgorithm',
						)}
					</span>
				{/if}
			</form>
		{:else}
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
		{/if}
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
	.pptx-svelte-readonly-banner-password-form {
		display: flex;
		flex: none;
		align-items: center;
		gap: 8px;
	}
	.pptx-svelte-readonly-banner-password-input {
		border: 1px solid rgba(217, 119, 6, 0.4);
		border-radius: 4px;
		padding: 4px 8px;
		background: rgba(0, 0, 0, 0.2);
		color: #fef3c7;
		font-size: 12px;
	}
	.pptx-svelte-readonly-banner-password-error {
		flex: none;
		color: #fca5a5;
		font-size: 12px;
	}
	.pptx-svelte-sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
