<script lang="ts">
	/**
	 * ThreeView: thin Svelte wrapper around `<pptx-three-view>`, the shared
	 * custom element that hosts every three.js scene (3D chart, 3D SmartArt)
	 * through one WebGL context (see `packages/shared/src/three-view/`). The
	 * only place in the Svelte binding that touches the element directly: it
	 * registers it, sets its object-valued properties imperatively, forwards
	 * its `pptx-three-*` events as callback props, and renders `children` as
	 * the element's slotted 2D fallback. Mirrors React's `ThreeView.tsx`.
	 */
	import type {
		ChartPartRef,
		PptxThreeViewElement,
		TextStyleAnimationDescriptor,
		ThreeViewDragDetail,
		ThreeViewSpec,
		ThreeViewState,
	} from 'pptx-viewer-shared';
	import { defineThreeViewElement, THREE_VIEW_EVENTS } from 'pptx-viewer-shared';
	import type { Snippet } from 'svelte';

	defineThreeViewElement();

	interface Props {
		/** The scene to mount, or `null` to show only the slotted 2D fallback. */
		spec: ThreeViewSpec | null;
		/** Whether pointer interaction (orbit, select, drag) is enabled. */
		interactive?: boolean;
		/** Mirrors an externally chosen chart part onto the scene. */
		selectedPart?: ChartPartRef | null;
		/** Active font-style emphasis override (animation playback). */
		textStyle?: TextStyleAnimationDescriptor;
		onselect?: (part: ChartPartRef | null) => void;
		ondrag?: (detail: ThreeViewDragDetail) => void;
		onstate?: (state: ThreeViewState) => void;
		children?: Snippet;
	}

	const {
		spec,
		interactive = false,
		selectedPart = null,
		textStyle,
		onselect,
		ondrag,
		onstate,
		children,
	}: Props = $props();

	let host: PptxThreeViewElement | undefined = $state();

	$effect(() => {
		if (host) {
			host.spec = spec;
		}
	});
	$effect(() => {
		if (host) {
			host.interactive = interactive;
		}
	});
	$effect(() => {
		if (host) {
			host.selectedPart = selectedPart;
		}
	});
	$effect(() => {
		if (host) {
			host.textStyle = textStyle;
		}
	});

	$effect(() => {
		const el = host;
		if (!el) {
			return undefined;
		}
		const handleSelect = (event: Event): void =>
			onselect?.((event as CustomEvent<{ part: ChartPartRef | null }>).detail.part);
		const handleDrag = (event: Event): void =>
			ondrag?.((event as CustomEvent<ThreeViewDragDetail>).detail);
		const handleState = (event: Event): void =>
			onstate?.((event as CustomEvent<{ state: ThreeViewState }>).detail.state);
		el.addEventListener(THREE_VIEW_EVENTS.select, handleSelect);
		el.addEventListener(THREE_VIEW_EVENTS.drag, handleDrag);
		el.addEventListener(THREE_VIEW_EVENTS.state, handleState);
		return () => {
			el.removeEventListener(THREE_VIEW_EVENTS.select, handleSelect);
			el.removeEventListener(THREE_VIEW_EVENTS.drag, handleDrag);
			el.removeEventListener(THREE_VIEW_EVENTS.state, handleState);
		};
	});
</script>

<pptx-three-view bind:this={host}>
	{@render children?.()}
</pptx-three-view>
