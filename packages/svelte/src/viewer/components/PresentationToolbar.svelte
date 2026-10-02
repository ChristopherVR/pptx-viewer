<script lang="ts">
	/**
	 * The slide-show toolbar: the floating, auto-hiding bar at the bottom centre
	 * of a running show.
	 *
	 * A thin adapter around the shared `pptx-ui-present-toolbar`. The inventory,
	 * order, measurements, colour palettes and elapsed readout come from
	 * `pptx-viewer-shared` (the element renders the shared `present-chrome`
	 * inventory), which React, Vue, Angular and Vanilla now share too. This keeps
	 * the positioned, auto-hiding wrapper (`PresentToolbarChrome`) and routes the
	 * element's typed intents to the annotation model.
	 *
	 * The wrapper metrics arrive as CSS custom properties on an inline `style`
	 * attribute because a Svelte scoped style block is compiled ahead of time and
	 * cannot read a TypeScript value. (Do not write the literal style tag in this
	 * comment: svelte2tsx, which `svelte-check` runs on, scans for it textually
	 * and would decide the script block ends here.)
	 */
	import { presentToolbarStyleAttr, toggleBlackboard } from 'pptx-viewer-shared';
	import type {
		PresentationBlackout,
		PresentToolbarRequestEvent,
		PresentToolbarViewState,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import type { PresentationAnnotations } from '../presentation/presentation-annotations.svelte';
	import { PresentToolbarChrome } from './presentation-toolbar.svelte';

	const {
		annotations,
		chrome = new PresentToolbarChrome(),
		current,
		total,
		presenterMode,
		blackout = 'none',
		onblackoutchange,
		onmove,
		onpresenterview,
		onexit,
		popupToolbarEnabled = true,
	}: {
		annotations: PresentationAnnotations;
		/**
		 * Fade / auto-hide state. Injected by the viewer so PowerPoint's Ctrl+H can
		 * reach the SAME flag from the show's key handler; the default keeps this
		 * component usable on its own (and in its own tests).
		 */
		chrome?: PresentToolbarChrome;
		/** Zero-based index of the slide on screen. */
		current: number;
		total: number;
		presenterMode: boolean;
		/** The show's blackout state, mirrored from the presenter snapshot. */
		blackout?: PresentationBlackout;
		/** Route a blackout change back to the presenter session's snapshot. */
		onblackoutchange?: (value: PresentationBlackout) => void;
		/** Step the show forward (1) or back (-1). */
		onmove: (direction: 1 | -1) => void;
		onpresenterview: () => void;
		onexit: () => void;
		/** File > Options > Advanced > "Show popup toolbar" (default true). */
		popupToolbarEnabled?: boolean;
	} = $props();

	const t = useTranslator();
	const metricVars = presentToolbarStyleAttr();

	// bind:this writes this (invisible to the linter's prefer-const analysis).
	// eslint-disable-next-line prefer-const
	let wrapperEl = $state<HTMLDivElement | undefined>(undefined);

	$effect(() =>
		chrome.attach({
			// `offsetParent` IS the positioned show surface the bar is absolutely
			// placed against, so the trigger zone needs no prop drilling.
			getContainer: () => (wrapperEl?.offsetParent as HTMLElement | null) ?? null,
			popupToolbarEnabled: () => popupToolbarEnabled,
		}),
	);

	const view = $derived<PresentToolbarViewState>({
		current,
		total,
		tool: annotations.tool,
		penColor: annotations.penColor,
		highlighterColor: annotations.highlighterColor,
		hasAnnotations: annotations.count > 0,
		blackout,
		presenterViewVisible: true,
		presenterViewActive: presenterMode,
		startTime: chrome.startedAt,
		translate: t,
	});

	function request(event: PresentToolbarRequestEvent): void {
		const intent = event.detail;
		switch (intent.id) {
			case 'move':
				onmove(intent.direction);
				break;
			case 'tool':
				// Choose a tool, or disarm it when it is already active (PowerPoint's toggle).
				annotations.tool = annotations.tool === intent.tool ? 'none' : intent.tool;
				break;
			case 'color':
				// Picking a colour also arms its tool, matching React.
				if (intent.tool === 'pen') {
					annotations.penColor = intent.color;
				} else {
					annotations.highlighterColor = intent.color;
				}
				annotations.tool = intent.tool;
				break;
			case 'blackboard': {
				// One click arms the black screen + pen together, or disarms both.
				const next = toggleBlackboard(blackout, annotations.tool);
				annotations.tool = next.tool;
				onblackoutchange?.(next.blackout);
				break;
			}
			case 'clear':
				annotations.clear();
				break;
			case 'presenterView':
				onpresenterview();
				break;
			case 'end':
				onexit();
		}
	}

	/**
	 * Contain pointer traffic: without this a control press would ALSO reach the
	 * stage's click-to-advance handler and skip a slide. It has to be a template
	 * handler, not an action calling `addEventListener`: Svelte 5 delegates
	 * `click`/`pointerdown` from the app root, so a real listener on this
	 * container would stop propagation before the delegated walk ever reached
	 * the button that was actually pressed.
	 */
	function stop(event: Event): void {
		event.stopPropagation();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div
	class="pptx-svelte-present-wrapper"
	class:hidden={!chrome.visible}
	style={metricVars}
	bind:this={wrapperEl}
	onmouseenter={() => chrome.enter()}
	onmouseleave={() => chrome.leave()}
	onclick={stop}
	onpointerdown={stop}
>
	<pptx-ui-present-toolbar state={view} onpresent-toolbar-request={request}
	></pptx-ui-present-toolbar>
</div>

<style>
	.pptx-svelte-present-wrapper { position: absolute; bottom: var(--pptx-pt-bottom); left: 50%; z-index: var(--pptx-pt-z); transform: translateX(-50%); transition: opacity var(--pptx-pt-fade) ease; }
	.pptx-svelte-present-wrapper.hidden { opacity: 0; pointer-events: none; }
</style>
