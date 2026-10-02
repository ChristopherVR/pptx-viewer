<script lang="ts">
	/**
	 * CompatibilityToasts: the bottom-right load-diagnostic stack for
	 * `PptxCompatibilityWarning`s (unmodelled markup, external image
	 * references, a chart workbook writeback that failed, and so on). Every
	 * warning already flows through the shared `compatibilityWarningToasts`
	 * decision function (`CompatToastsState`); this component is a thin adapter
	 * around the shared `pptx-ui-compat-toasts`, which renders the list,
	 * positions itself from `compatToastStackStyle` and emits typed intents.
	 *
	 * Unlike a transient toast, these do not auto-hide: they are diagnostics
	 * about the LOADED document, so they persist until the user dismisses them
	 * (or the next load resets the stack).
	 *
	 * Positioning is relative to the VIEWER ROOT (`PowerPointViewer.svelte`'s
	 * `.pptx-svelte-viewer`, which already establishes the containing block the
	 * dialogs use), anchored above the status bar rather than the page corner, so
	 * a toast can never cover the status bar's "Slide show" button.
	 *
	 * `rightInset` (default 0) is the width of whatever right-docked panel
	 * (format/inspector or AI chat) is currently open: the viewer ROOT spans
	 * the FULL chrome width including that panel, so without it the stack's
	 * `right: 12px` lands under the panel's own content instead of clear of it.
	 */
	import type {
		CompatibilityWarningToast,
		CompatToastsRequestEvent,
		CompatToastsViewState,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';

	const {
		toasts,
		overflowCount,
		ondismiss,
		ondismissall,
		rightInset = 0,
		bottomInset = 0,
	}: {
		toasts: readonly CompatibilityWarningToast[];
		overflowCount: number;
		ondismiss: (id: string) => void;
		ondismissall: () => void;
		rightInset?: number;
		/** Height of the docked notes strip; see `compatToastStackStyle`'s `extraBottomInset`. */
		bottomInset?: number;
	} = $props();

	const t = useTranslator();
	const view = $derived<CompatToastsViewState>({
		toasts,
		overflowCount,
		rightInset,
		bottomInset,
		translate: t,
	});

	function request(event: CompatToastsRequestEvent): void {
		const intent = event.detail;
		if (intent.id === 'dismissAll') {
			ondismissall();
		} else {
			ondismiss(intent.toastId);
		}
	}
</script>

{#if toasts.length > 0}
	<pptx-ui-compat-toasts state={view} oncompat-toasts-request={request}></pptx-ui-compat-toasts>
{/if}
