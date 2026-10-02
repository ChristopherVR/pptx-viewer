<script lang="ts">
	/**
	 * The presenter console's control strip.
	 *
	 * A thin adapter around the shared `pptx-ui-presenter-console`, which renders
	 * the shared `PRESENTER_CONSOLE_CONTROLS` inventory (every slot, its order, its
	 * accessible-name key, its icon and its pressed state) so this binding cannot
	 * drift from the other four. The on and disabled rule is the shared
	 * `presenterConsoleViewState`; `onselect` receives the shared control id and the
	 * console owns what each one does.
	 */
	import { presenterConsoleViewState } from 'pptx-viewer-shared';
	import type {
		PresentationSnapshot,
		PresenterConsoleRequestEvent,
		PresenterConsoleViewState,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';

	const {
		snapshot,
		audienceOpen,
		onselect,
	}: {
		snapshot: PresentationSnapshot;
		audienceOpen: boolean;
		/** Fired with the shared control id; the console owns what each one does. */
		onselect: (controlId: string) => void;
	} = $props();

	const t = useTranslator();
	const view = $derived<PresenterConsoleViewState>({
		...presenterConsoleViewState(snapshot, audienceOpen),
		translate: t,
	});
</script>

<!--
	The host carries `data-pptx-presenter-strip`, the scoping hook: the rail's
	controls carry the same `data-pptx-presenter-control` attribute (all five
	bindings share one attribute so a framework-neutral spec can query one
	selector), so anything asserting the STRIP's inventory or its order must scope
	to this root rather than sweeping the document.
-->
<pptx-ui-presenter-console
	state={view}
	onpresenter-console-request={(event: PresenterConsoleRequestEvent) => onselect(event.detail.id)}
></pptx-ui-presenter-console>
