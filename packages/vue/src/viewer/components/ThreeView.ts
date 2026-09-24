/**
 * ThreeView: thin Vue wrapper around `<pptx-three-view>`, the shared custom
 * element that hosts every three.js scene (3D chart, 3D SmartArt) through one
 * WebGL context (see `packages/shared/src/three-view/`). This is the only
 * place in the Vue binding that touches the element directly: it registers
 * it, sets its object-valued properties imperatively, forwards its
 * `pptx-three-*` events as Vue emits, and slots the caller's 2D render as the
 * element's fallback child.
 *
 * Written as a render function rather than an SFC so the tag is always
 * created as a native element (an SFC template would try to resolve
 * `pptx-three-view` as a Vue component unless every consumer configured
 * `compilerOptions.isCustomElement`). Registration runs at module scope, so
 * the element is upgraded before the first mount sets its `spec`.
 *
 * @module ThreeView
 */
import type {
	ChartPartRef,
	PptxThreeViewElement,
	TextStyleAnimationDescriptor,
	ThreeViewDragDetail,
	ThreeViewSpec,
	ThreeViewState,
} from 'pptx-viewer-shared';
import { defineThreeViewElement, THREE_VIEW_EVENTS, THREE_VIEW_TAG } from 'pptx-viewer-shared';
import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { PropType } from 'vue';

defineThreeViewElement();

export default defineComponent({
	name: 'ThreeView',
	props: {
		/** The scene to mount, or `null` to show only the slotted 2D fallback. */
		spec: { type: Object as PropType<ThreeViewSpec | null>, default: null },
		/** Whether pointer interaction (orbit, select, drag) is enabled. */
		interactive: { type: Boolean, default: false },
		/** Mirrors an externally chosen chart part (e.g. picked in the inspector) onto the scene. */
		selectedPart: { type: Object as PropType<ChartPartRef | null>, default: null },
		/** Active font-style emphasis override (animation playback), applied to the scene's text. */
		textStyle: {
			type: Object as PropType<TextStyleAnimationDescriptor | undefined>,
			default: undefined,
		},
	},
	emits: {
		select: (_part: ChartPartRef | null) => true,
		drag: (_detail: ThreeViewDragDetail) => true,
		state: (_state: ThreeViewState) => true,
	},
	setup(props, { emit, slots }) {
		const host = ref<PptxThreeViewElement | null>(null);

		const onSelect = (event: Event): void =>
			emit('select', (event as CustomEvent<{ part: ChartPartRef | null }>).detail.part);
		const onDrag = (event: Event): void =>
			emit('drag', (event as CustomEvent<ThreeViewDragDetail>).detail);
		const onState = (event: Event): void =>
			emit('state', (event as CustomEvent<{ state: ThreeViewState }>).detail.state);

		function sync(): void {
			const el = host.value;
			if (!el) {
				return;
			}
			el.spec = props.spec;
			el.interactive = props.interactive;
			el.selectedPart = props.selectedPart;
			el.textStyle = props.textStyle;
		}

		onMounted(() => {
			const el = host.value;
			el?.addEventListener(THREE_VIEW_EVENTS.select, onSelect);
			el?.addEventListener(THREE_VIEW_EVENTS.drag, onDrag);
			el?.addEventListener(THREE_VIEW_EVENTS.state, onState);
			sync();
		});
		onBeforeUnmount(() => {
			const el = host.value;
			el?.removeEventListener(THREE_VIEW_EVENTS.select, onSelect);
			el?.removeEventListener(THREE_VIEW_EVENTS.drag, onDrag);
			el?.removeEventListener(THREE_VIEW_EVENTS.state, onState);
		});
		watch(() => [props.spec, props.interactive, props.selectedPart, props.textStyle], sync, {
			flush: 'post',
		});

		return () => h(THREE_VIEW_TAG, { ref: host }, slots.default?.());
	},
});
