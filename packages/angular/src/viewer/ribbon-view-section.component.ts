/**
 * ribbon-view-section.component.ts: the View ribbon tab (Slide Sorter / Notes /
 * Print / Shortcuts, grid/rulers/guides overlays, Selection Pane, snap-to-grid,
 * the template-editing toggle and the eyedropper). Split out of
 * {@link RibbonComponent}; behaviour and markup are unchanged.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { EditorStateService } from './editor-state.service';

@Component({
	selector: 'pptx-ribbon-view-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgClass, TranslatePipe],
	template: `
		<!-- Presentation views -->
		<button type="button" class="pptx-rb-pill" (click)="openSorter.emit()">
			{{ 'pptx.slideSorter.title' | translate }}
		</button>
		<button type="button" class="pptx-rb-pill" (click)="toggleNotes.emit()">
			{{ 'pptx.notes.title' | translate }}
		</button>
		<button type="button" class="pptx-rb-pill" (click)="print.emit()">
			{{ 'pptx.print.printButton' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.ribbon.shortcutsTitle' | translate"
			(click)="openShortcuts.emit()"
		>
			{{ 'pptx.ribbon.shortcuts' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<!-- Show / Hide overlays -->
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
			[ngClass]="showRulers() ? 'bg-primary text-primary-foreground' : ''"
			[title]="'pptx.ruler.toggleRulers' | translate"
			(click)="toggleRulers.emit()"
		>
			{{ 'pptx.ruler.rulers' | translate }}
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
		<span class="pptx-rb-sep"></span>
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.ribbon.toggleSelectionPane' | translate"
			(click)="toggleSelectionPane.emit()"
		>
			{{ 'pptx.selectionPane.title' | translate }}
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
		<span class="pptx-rb-sep"></span>
		<button
			type="button"
			class="pptx-rb-pill"
			[ngClass]="eyedropperActive() ? 'pptx-rb-eyedropper-active' : ''"
			[title]="'pptx.ribbon.eyedropperTitle' | translate"
			(click)="toggleEyedropper.emit()"
		>
			{{ 'pptx.ribbon.eyedropper' | translate }}
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
	readonly eyedropperActive = input<boolean>(false);

	readonly openSorter = output<void>();
	readonly toggleNotes = output<void>();
	readonly print = output<void>();
	readonly openShortcuts = output<void>();
	readonly toggleGrid = output<void>();
	readonly toggleRulers = output<void>();
	readonly toggleGuides = output<void>();
	readonly toggleSelectionPane = output<void>();
	readonly toggleSnapToGrid = output<void>();
	readonly toggleEyedropper = output<void>();
}
