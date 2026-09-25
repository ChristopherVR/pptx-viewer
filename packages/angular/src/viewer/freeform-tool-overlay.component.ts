/**
 * freeform-tool-overlay.component.ts: the capture layer of the click-to-place
 * Freeform: Shape and Curve tools.
 *
 * Selector: `pptx-freeform-tool-overlay`
 *
 * The gesture itself (corners, freehand runs, smooth spans, closing on the
 * start point, double-click / Enter / Escape) is the shared
 * `FreeformToolSession`; this only paints its preview in the stage's
 * slide-pixel space and forwards events.
 *
 * Reference binding: packages/react/src/viewer/components/canvas/FreeformToolOverlay.tsx
 *
 * @module viewer/freeform-tool-overlay
 */
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	effect,
	ElementRef,
	inject,
	input,
	output,
	signal,
	untracked,
	viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ShapePptxElement } from 'pptx-viewer-core';

import type { CanvasSize, FreeformToolKind, FreeformToolView } from '../internal/shared';
import { attachOverlayKeyboard, clientToSlidePoint, FreeformToolSession } from '../internal/shared';

const PREVIEW_COLOR = '#2f528f';

@Component({
	selector: 'pptx-freeform-tool-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<svg
			#overlay
			class="pptx-ng-freeform-tool-overlay"
			role="application"
			[attr.data-pptx-freeform-tool-overlay]="tool()"
			[attr.aria-label]="'pptx.freeformTool.overlay' | translate"
			[attr.width]="canvasSize().width"
			[attr.height]="canvasSize().height"
			(pointerdown)="onPointerDown($event)"
			(pointermove)="onPointerMove($event)"
			(pointerup)="onPointerUp($event)"
			(dblclick)="onDoubleClick($event)"
			(contextmenu)="$event.preventDefault(); $event.stopPropagation()"
			(mousedown)="$event.stopPropagation()"
			(click)="$event.stopPropagation()"
		>
			<rect
				[attr.width]="canvasSize().width"
				[attr.height]="canvasSize().height"
				fill="transparent"
			/>
			@if (view().previewD) {
				<path
					[attr.d]="view().previewD"
					fill="none"
					[attr.stroke]="color"
					[attr.stroke-width]="view().strokeWidth"
					pointer-events="none"
				/>
			}
			@if (view().start; as start) {
				<circle
					[attr.cx]="start.x"
					[attr.cy]="start.y"
					[attr.r]="start.size / 2"
					[attr.fill]="start.armed ? color : '#ffffff'"
					[attr.stroke]="color"
					[attr.stroke-width]="view().strokeWidth"
					pointer-events="none"
					[attr.data-pptx-freeform-start]="start.armed ? 'armed' : 'idle'"
				/>
			}
		</svg>
	`,
	styles: `
		:host {
			position: absolute;
			inset: 0;
			z-index: 60;
		}
		.pptx-ng-freeform-tool-overlay {
			position: absolute;
			top: 0;
			left: 0;
			cursor: crosshair;
			touch-action: none;
		}
	`,
})
export class FreeformToolOverlayComponent {
	/** The armed tool. */
	readonly tool = input.required<FreeformToolKind>();
	readonly canvasSize = input.required<CanvasSize>();
	/** On-screen scale of the stage (keeps the close target screen-sized). */
	readonly scale = input<number>(1);

	/** A finished shape to insert (the tool then disarms). */
	readonly commit = output<ShapePptxElement>();
	/** The gesture ended without a shape; disarm. */
	readonly cancelled = output<void>();

	protected readonly color = PREVIEW_COLOR;
	private readonly overlayRef = viewChild<ElementRef<SVGSVGElement>>('overlay');
	private readonly host = inject(ElementRef) as ElementRef<HTMLElement>;
	private readonly version = signal(0);
	private readonly session = signal<FreeformToolSession | null>(null);
	private detachKeyboard: (() => void) | null = null;

	protected readonly view = computed<FreeformToolView>(() => {
		this.version();
		const session = this.session();
		if (!session) {
			return { previewD: '', strokeWidth: 1, start: null };
		}
		session.setScale(this.scale());
		return session.view();
	});

	constructor() {
		effect(() => {
			const tool = this.tool();
			untracked(() => this.start(tool));
		});
		inject(DestroyRef).onDestroy(() => this.detachKeyboard?.());
	}

	private start(tool: FreeformToolKind): void {
		if (this.session()?.tool === tool && !this.session()?.isEnded) {
			return;
		}
		this.detachKeyboard?.();
		const session = new FreeformToolSession({
			tool,
			onCommit: (element) => this.commit.emit(element),
			onCancel: () => this.cancelled.emit(),
			onChange: () => this.version.update((n) => n + 1),
		});
		this.session.set(session);
		this.detachKeyboard = attachOverlayKeyboard(session);
	}

	private point(event: MouseEvent): { x: number; y: number } {
		const size = this.canvasSize();
		const target = this.overlayRef()?.nativeElement ?? this.host.nativeElement;
		return clientToSlidePoint(target, event.clientX, event.clientY, size.width, size.height);
	}

	protected onPointerDown(event: PointerEvent): void {
		event.stopPropagation();
		event.preventDefault();
		(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
		const session = this.session();
		session?.setScale(this.scale());
		session?.pointerDown({ ...this.point(event), button: event.button });
	}

	protected onPointerMove(event: PointerEvent): void {
		this.session()?.pointerMove(this.point(event));
	}

	protected onPointerUp(event: PointerEvent): void {
		(event.currentTarget as Element | null)?.releasePointerCapture?.(event.pointerId);
		this.session()?.pointerUp();
	}

	protected onDoubleClick(event: MouseEvent): void {
		event.stopPropagation();
		this.session()?.doubleClick();
	}
}
