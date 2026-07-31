/**
 * ribbon-view-section.component.ts: the View ribbon tab (Presentation Views,
 * Master Views, Show, Zoom and Window groups). Split out of
 * {@link RibbonComponent}.
 *
 * Grouped the way PowerPoint groups it, which is also how every other binding
 * renders it: a tab whose controls are in a different order, or under
 * different names, cannot be scripted or documented once for all five.
 *
 * Reading View, Handout Master, Notes Master, Zoom and Macros render disabled:
 * each is a view or setting this viewer does not implement yet. Print,
 * Shortcuts and the Notes-pane toggle deliberately do NOT live here (PowerPoint
 * has none of them on View); they stay reachable from the File tab / overflow
 * menu, the Help tab, and the status bar respectively.
 *
 * Snap to Shape is NOT one of those: the viewer owns a real `snapToShape`
 * signal that the canvas reads while dragging, so this pill toggles it. A
 * previous parity wave rendered it permanently disabled and left the behaviour
 * with nowhere else to go, which took shape-edge snapping away from Angular
 * users entirely. Guides stays bound to `showGuides` (guide-overlay
 * visibility), which is the semantics all five bindings share.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { EditorStateService } from './editor-state.service';

@Component({
	selector: 'pptx-ribbon-view-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [NgClass, TranslatePipe],
	template: `
		<!-- Presentation views -->
		<button type="button" class="pptx-rb-pill" [title]="'pptx.view.normal' | translate">
			{{ 'pptx.view.normal' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.view.slideSorterTooltip' | translate"
			(click)="openSorter.emit()"
		>
			{{ 'pptx.slideSorter.title' | translate }}
		</button>
		<button type="button" class="pptx-rb-pill" disabled>
			{{ 'pptx.view.readingView' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<!-- Master views -->
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="!canEdit()"
			[title]="'pptx.view.slideMasterTooltip' | translate"
			(click)="openMasterView.emit()"
		>
			{{ 'pptx.master.title' | translate }}
		</button>
		<button type="button" class="pptx-rb-pill" disabled>
			{{ 'pptx.master.handoutMasterTitle' | translate }}
		</button>
		<button type="button" class="pptx-rb-pill" disabled>
			{{ 'pptx.master.notesMasterTitle' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<!-- Show / Hide overlays -->
		<button
			type="button"
			class="pptx-rb-pill"
			[ngClass]="showRulers() ? 'bg-primary text-primary-foreground' : ''"
			[title]="'pptx.ruler.toggleRulers' | translate"
			(click)="toggleRulers.emit()"
		>
			{{ 'pptx.ruler.rulers' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[ngClass]="showGrid() ? 'bg-primary text-primary-foreground' : ''"
			[title]="'pptx.ribbon.toggleGridOverlay' | translate"
			(click)="toggleGrid.emit()"
		>
			{{ 'pptx.grid.grid' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[ngClass]="showGuides() ? 'bg-primary text-primary-foreground' : ''"
			[title]="'pptx.ribbon.toggleGuides' | translate"
			(click)="toggleGuides.emit()"
		>
			{{ 'pptx.ribbon.guides' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[ngClass]="snapToGrid() ? 'bg-primary text-primary-foreground' : ''"
			[title]="'pptx.ribbon.snapToGridTitle' | translate"
			(click)="toggleSnapToGrid.emit()"
		>
			{{ 'pptx.grid.snapToGrid' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.ribbon.toggleSelectionPane' | translate"
			(click)="toggleSelectionPane.emit()"
		>
			{{ 'pptx.view.selection' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="!canEdit()"
			[ngClass]="eyedropperActive() ? 'pptx-rb-eyedropper-active' : ''"
			[title]="'pptx.ribbon.eyedropperTitle' | translate"
			(click)="toggleEyedropper.emit()"
		>
			{{ 'pptx.ribbon.eyedropper' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[ngClass]="snapToShape() ? 'bg-primary text-primary-foreground' : ''"
			[title]="'pptx.grid.snapToShape' | translate"
			(click)="toggleSnapToShape.emit()"
		>
			{{ 'pptx.grid.snapToShape' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.view.addHorizontalGuide' | translate"
			(click)="addGuide.emit('y')"
		>
			{{ 'pptx.view.hGuide' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.view.addVerticalGuide' | translate"
			(click)="addGuide.emit('x')"
		>
			{{ 'pptx.view.vGuide' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<!-- Zoom -->
		<button type="button" class="pptx-rb-pill" disabled>
			{{ 'pptx.slideSorter.zoom' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.view.zoomToFitTooltip' | translate"
			(click)="zoomToFit.emit()"
		>
			{{ 'pptx.view.zoomToFit' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<!-- Window -->
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="!canEdit()"
			[ngClass]="editor.editTemplateMode() ? 'pptx-rb-template-active' : ''"
			[title]="'pptx.ribbon.editTemplateTitle' | translate"
			(click)="editor.setEditTemplateMode(!editor.editTemplateMode())"
		>
			{{
				(editor.editTemplateMode() ? 'pptx.ribbon.templatesOn' : 'pptx.ribbon.templatesOff')
					| translate
			}}
		</button>
		<button type="button" class="pptx-rb-pill" disabled>
			{{ 'pptx.view.macros' | translate }}
		</button>
	`,
})
export class RibbonViewSectionComponent {
	protected readonly editor = inject(EditorStateService);

	readonly canEdit = input<boolean>(false);
	readonly showGrid = input<boolean>(false);
	readonly showRulers = input<boolean>(false);
	readonly showGuides = input<boolean>(false);
	readonly snapToGrid = input<boolean>(false);
	/** Whether dragging snaps to other shapes' edges (active-state styling). */
	readonly snapToShape = input<boolean>(true);
	readonly eyedropperActive = input<boolean>(false);

	readonly openSorter = output<void>();
	readonly openMasterView = output<void>();
	readonly toggleGrid = output<void>();
	readonly toggleRulers = output<void>();
	readonly toggleGuides = output<void>();
	readonly toggleSelectionPane = output<void>();
	readonly toggleSnapToGrid = output<void>();
	readonly toggleSnapToShape = output<void>();
	readonly addGuide = output<'x' | 'y'>();
	readonly zoomToFit = output<void>();
	readonly toggleEyedropper = output<void>();
}
