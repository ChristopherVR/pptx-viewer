/**
 * edit-points-overlay.component.ts: PowerPoint's Edit Points mode for one
 * shape.
 *
 * Selector: `pptx-edit-points-overlay`
 *
 * Everything that decides behaviour lives in the shared `EditPointsSession`
 * (hit targets, drags, the vertex / segment menu, keyboard, the element
 * patch): this component only draws its view descriptor as SVG in the stage's
 * unscaled slide-pixel space (it is projected into the scaled stage, like the
 * motion-path overlay) and forwards pointer events to it. The DOM contract
 * (`data-pptx-edit-points-*`) is identical in every binding for `e2e/`.
 *
 * Reference binding: packages/react/src/viewer/components/canvas/EditPointsOverlay.tsx
 *
 * @module viewer/edit-points-overlay
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
import type { PptxElement } from 'pptx-viewer-core';

import type {
	CanvasSize,
	EditPointsCommandId,
	EditPointsElementPatch,
	EditPointsView,
} from '../internal/shared';
import {
	attachOverlayKeyboard,
	EDIT_POINTS_STYLE,
	EditPointsSession,
	overlayPointerInput,
} from '../internal/shared';
import { EditPointsMenuComponent } from './edit-points-menu.component';

/** One Edit Points commit, addressed to its shape. */
export interface EditPointsCommit {
	id: string;
	patch: EditPointsElementPatch;
}

@Component({
	selector: 'pptx-edit-points-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, EditPointsMenuComponent],
	template: `
		<svg
			#overlay
			class="pptx-ng-edit-points-overlay"
			role="application"
			data-pptx-edit-points-overlay="true"
			[attr.data-pptx-edit-points-element]="element().id"
			[attr.aria-label]="'pptx.editPoints.overlay' | translate"
			[attr.width]="canvasSize().width"
			[attr.height]="canvasSize().height"
			(pointerdown)="onPointerDown($event)"
			(pointermove)="onPointerMove($event)"
			(pointerup)="onPointerUp($event)"
			(pointercancel)="onPointerUp($event)"
			(contextmenu)="onContextMenu($event)"
			(mousedown)="$event.stopPropagation()"
			(click)="$event.stopPropagation()"
			(dblclick)="$event.stopPropagation()"
		>
			<rect
				[attr.width]="canvasSize().width"
				[attr.height]="canvasSize().height"
				fill="transparent"
			/>
			@for (seg of view().segments; track seg.target) {
				<path
					class="pptx-ng-ep-segment"
					[attr.d]="seg.d"
					fill="none"
					stroke="transparent"
					[attr.stroke-width]="view().hitStrokeWidth"
					pointer-events="stroke"
					[attr.data-pptx-edit-points-target]="seg.target"
				/>
			}
			<path
				[attr.d]="view().outlineD"
				fill="none"
				[attr.stroke]="style.outlineColor"
				[attr.stroke-width]="view().outlineWidth"
				pointer-events="none"
			/>
			@for (h of view().handles; track h.target) {
				<line
					[attr.x1]="h.anchorX"
					[attr.y1]="h.anchorY"
					[attr.x2]="h.x"
					[attr.y2]="h.y"
					[attr.stroke]="style.handleLineColor"
					[attr.stroke-width]="view().outlineWidth"
					pointer-events="none"
				/>
				<rect
					class="pptx-ng-ep-grip"
					[attr.x]="h.x - h.size / 2"
					[attr.y]="h.y - h.size / 2"
					[attr.width]="h.size"
					[attr.height]="h.size"
					[attr.fill]="style.handleFill"
					[attr.stroke]="style.handleStroke"
					[attr.stroke-width]="view().outlineWidth"
					[attr.data-pptx-edit-points-target]="h.target"
				/>
			}
			@for (n of view().nodes; track n.target) {
				<rect
					class="pptx-ng-ep-grip"
					[attr.x]="n.x - n.size / 2"
					[attr.y]="n.y - n.size / 2"
					[attr.width]="n.size"
					[attr.height]="n.size"
					[attr.fill]="n.selected ? style.selectedNodeFill : style.nodeFill"
					[attr.stroke]="n.selected ? style.selectedNodeStroke : style.nodeStroke"
					[attr.stroke-width]="view().outlineWidth"
					[attr.data-pptx-edit-points-node-type]="n.type"
					[attr.data-selected]="n.selected ? 'true' : null"
					[attr.data-pptx-edit-points-target]="n.target"
				/>
			}
		</svg>
		@if (view().menu; as menu) {
			<pptx-edit-points-menu [menu]="menu" (run)="runCommand($event)" />
		}
	`,
	styles: `
		:host {
			position: absolute;
			inset: 0;
			z-index: 60;
			overflow: visible;
		}
		.pptx-ng-edit-points-overlay {
			position: absolute;
			top: 0;
			left: 0;
			overflow: visible;
			touch-action: none;
		}
		.pptx-ng-ep-segment {
			cursor: copy;
		}
		.pptx-ng-ep-grip {
			cursor: move;
		}
	`,
})
export class EditPointsOverlayComponent {
	/** The shape whose points are being edited. */
	readonly element = input.required<PptxElement>();
	/** Stage size in slide pixels (the overlay's own coordinate space). */
	readonly canvasSize = input.required<CanvasSize>();
	/** On-screen scale of the stage, so handles keep one screen size. */
	readonly scale = input<number>(1);
	/** Menu commands the host hid. */
	readonly hiddenCommands = input<ReadonlySet<EditPointsCommandId> | undefined>(undefined);

	/** One edit (one undo step). */
	readonly commit = output<EditPointsCommit>();
	/** Leave Edit Points mode. */
	readonly exit = output<void>();

	protected readonly style = EDIT_POINTS_STYLE;
	private readonly overlayRef = viewChild<ElementRef<SVGSVGElement>>('overlay');
	private readonly host = inject(ElementRef) as ElementRef<HTMLElement>;
	/** Bumped by the session's `onChange`; the view recomputes off it. */
	private readonly version = signal(0);
	private readonly session = signal<EditPointsSession | null>(null);
	private detachKeyboard: (() => void) | null = null;

	protected readonly view = computed<EditPointsView>(() => {
		this.version();
		const session = this.session();
		const empty: EditPointsView = {
			outlineD: '',
			outlineWidth: 1,
			segments: [],
			nodes: [],
			handles: [],
			hitStrokeWidth: 1,
			menu: null,
		};
		return session ? session.view(this.scale()) : empty;
	});

	constructor() {
		// One session per shape id; every other element change is a `reconcile`
		// (its own commits, an undo, a remote edit). The session work runs
		// untracked so its `onChange` signal write never re-enters this effect.
		effect(() => {
			const element = this.element();
			const hidden = this.hiddenCommands();
			untracked(() => this.sync(element, hidden));
		});
		inject(DestroyRef).onDestroy(() => this.detachKeyboard?.());
	}

	private sync(element: PptxElement, hidden: ReadonlySet<EditPointsCommandId> | undefined): void {
		const current = this.session();
		if (current && current.elementId === element.id && !current.isEnded) {
			current.reconcile(element);
			return;
		}
		this.detachKeyboard?.();
		const session = new EditPointsSession(element, {
			onCommit: (patch) => this.commit.emit({ id: element.id, patch }),
			onExit: () => this.exit.emit(),
			onChange: () => this.version.update((n) => n + 1),
			hiddenCommands: hidden,
		});
		this.session.set(session);
		this.detachKeyboard = attachOverlayKeyboard(session);
	}

	private input(event: PointerEvent | MouseEvent) {
		const size = this.canvasSize();
		const target = this.overlayRef()?.nativeElement ?? this.host.nativeElement;
		return overlayPointerInput(event, target, size.width, size.height);
	}

	protected onPointerDown(event: PointerEvent): void {
		event.stopPropagation();
		if (event.button !== 0) {
			return;
		}
		event.preventDefault();
		(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
		this.session()?.pointerDown(this.input(event));
	}

	protected onPointerMove(event: PointerEvent): void {
		this.session()?.pointerMove(this.input(event));
	}

	protected onPointerUp(event: PointerEvent): void {
		(event.currentTarget as Element | null)?.releasePointerCapture?.(event.pointerId);
		this.session()?.pointerUp(this.input(event));
	}

	protected onContextMenu(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();
		this.session()?.contextMenu(this.input(event));
	}

	protected runCommand(id: EditPointsCommandId): void {
		this.session()?.runCommand(id);
	}
}
