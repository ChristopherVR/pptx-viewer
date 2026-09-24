import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	DestroyRef,
	effect,
	ElementRef,
	inject,
	input,
	output,
	viewChild,
} from '@angular/core';

import { defineThreeViewElement, THREE_VIEW_EVENTS } from '../internal/shared';
import type {
	ChartPartRef,
	PptxThreeViewElement,
	TextStyleAnimationDescriptor,
	ThreeViewDragDetail,
	ThreeViewSpec,
	ThreeViewState,
} from '../internal/shared';

defineThreeViewElement();

/**
 * ThreeViewComponent: thin Angular wrapper around `<pptx-three-view>`, the
 * shared custom element that hosts every three.js scene (3D chart, 3D
 * SmartArt) through one WebGL context (see `packages/shared/src/three-view/`).
 * The only place in the Angular binding that touches the element directly:
 * it registers it, sets its object-valued properties imperatively, re-emits
 * its `pptx-three-*` events as outputs, and projects its content as the
 * element's slotted 2D fallback. Mirrors React's `ThreeView.tsx`.
 */
@Component({
	selector: 'pptx-ng-three-view',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `<pptx-three-view #host><ng-content /></pptx-three-view>`,
	styles: `
		:host {
			display: block;
			position: relative;
			width: 100%;
			height: 100%;
		}
	`,
})
export class ThreeViewComponent {
	/** The scene to mount, or `null` to show only the projected 2D fallback. */
	readonly spec = input<ThreeViewSpec | null>(null);
	/** Whether pointer interaction (orbit, select, drag) is enabled. */
	readonly interactive = input<boolean>(false);
	/** Mirrors an externally chosen chart part onto the scene. */
	readonly selectedPart = input<ChartPartRef | null>(null);
	/** Active font-style emphasis override (animation playback). */
	readonly textStyle = input<TextStyleAnimationDescriptor | undefined>(undefined);

	readonly partSelect = output<ChartPartRef | null>();
	readonly valueDrag = output<ThreeViewDragDetail>();
	readonly stateChange = output<ThreeViewState>();

	private readonly host = viewChild.required<ElementRef<PptxThreeViewElement>>('host');

	constructor() {
		effect(() => {
			this.host().nativeElement.spec = this.spec();
		});
		effect(() => {
			this.host().nativeElement.interactive = this.interactive();
		});
		effect(() => {
			this.host().nativeElement.selectedPart = this.selectedPart();
		});
		effect(() => {
			this.host().nativeElement.textStyle = this.textStyle();
		});

		const onSelect = (event: Event): void =>
			this.partSelect.emit((event as CustomEvent<{ part: ChartPartRef | null }>).detail.part);
		const onDrag = (event: Event): void =>
			this.valueDrag.emit((event as CustomEvent<ThreeViewDragDetail>).detail);
		const onState = (event: Event): void =>
			this.stateChange.emit((event as CustomEvent<{ state: ThreeViewState }>).detail.state);
		let attached: PptxThreeViewElement | null = null;
		effect(() => {
			const el = this.host().nativeElement;
			if (attached === el) {
				return;
			}
			attached = el;
			el.addEventListener(THREE_VIEW_EVENTS.select, onSelect);
			el.addEventListener(THREE_VIEW_EVENTS.drag, onDrag);
			el.addEventListener(THREE_VIEW_EVENTS.state, onState);
		});
		inject(DestroyRef).onDestroy(() => {
			attached?.removeEventListener(THREE_VIEW_EVENTS.select, onSelect);
			attached?.removeEventListener(THREE_VIEW_EVENTS.drag, onDrag);
			attached?.removeEventListener(THREE_VIEW_EVENTS.state, onState);
		});
	}
}
