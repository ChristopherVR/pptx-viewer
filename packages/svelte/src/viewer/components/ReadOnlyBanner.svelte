<script lang="ts">
	/**
	 * ReadOnlyBanner: shown above the canvas (under the ribbon/toolbar) when the
	 * loaded deck recommends opening read-only (`p:modifyVerifier` or "Mark as
	 * Final"). A thin adapter around the shared `pptx-ui-read-only-banner`: the
	 * element owns the markup, the inline password form and its focus; this maps
	 * props onto its state and routes its typed intents to the callbacks. The
	 * recommendation itself is a pure shared decision (`readOnlyRecommendation`,
	 * `pptx-viewer-shared`) computed by `ReadOnlyRecommendationState`.
	 *
	 * When `passwordpromptopen` is set (a `modifyVerifier` with a hash this
	 * viewer can check), the two buttons are replaced by an inline password
	 * form: PowerPoint's own "read-only recommended" prompt keeps the deck
	 * locked until the correct password is entered, and a wrong one leaves it
	 * locked.
	 */
	import type {
		ReadOnlyBannerRequestEvent,
		ReadOnlyBannerViewState,
		ReadOnlyRecommendationKind,
	} from 'pptx-viewer-shared';

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
	const view = $derived<ReadOnlyBannerViewState>({
		kind,
		messageKey,
		passwordPromptOpen: passwordpromptopen,
		passwordError: passworderror,
		checkingPassword: checkingpassword,
		translate: t,
	});

	function request(event: ReadOnlyBannerRequestEvent): void {
		const intent = event.detail;
		switch (intent.id) {
			case 'editAnyway':
				oneditanyway();
				break;
			case 'dismiss':
				ondismiss();
				break;
			case 'cancelPassword':
				oncancelpassword?.();
				break;
			case 'submitPassword':
				onsubmitpassword?.(intent.password);
		}
	}
</script>

{#if kind}
	<pptx-ui-read-only-banner state={view} onread-only-request={request}></pptx-ui-read-only-banner>
{/if}
