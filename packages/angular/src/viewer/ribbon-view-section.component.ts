/**
 * ribbon-view-section.component.ts: the View ribbon tab, split out of
 * {@link RibbonComponent}. A thin adapter for the shared `pptx-ui-ribbon-view`:
 * the shared element owns groups, icons, labels and pressed/disabled state;
 * this component supplies viewer options and routes typed intents to outputs.
 *
 * Guides stays bound to `showGuides` (guide-overlay visibility) and Snap to
 * Shape to its own `snapToShape` signal, the semantics all five bindings share.
 * Handout Master, Notes Master, Zoom and Macros render disabled in the shared view.
 */
import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	inject,
	input,
	output,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import type { RibbonViewRequestEvent } from '../internal/shared';
import { EditorStateService } from './editor-state.service';

@Component({
	selector: 'pptx-ribbon-view-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `<pptx-ui-ribbon-view [state]="view()" (view-request)="request($event)" />`,
})
export class RibbonViewSectionComponent {
	protected readonly editor = inject(EditorStateService);
	private readonly translation = inject(TranslateService, { optional: true });

	readonly canEdit = input<boolean>(false);
	readonly showGrid = input<boolean>(false);
	readonly showRulers = input<boolean>(false);
	readonly showGuides = input<boolean>(false);
	readonly snapToGrid = input<boolean>(false);
	/** Whether dragging snaps to other shapes' edges (active-state styling). */
	readonly snapToShape = input<boolean>(true);
	readonly eyedropperActive = input<boolean>(false);

	/**
	 * View > Normal: leave whichever alternate view (slide sorter, reading,
	 * outline, master) is open and return to the ordinary editing canvas.
	 */
	readonly goToNormalView = output<void>();
	readonly openSorter = output<void>();
	/** Enter Reading View: the deck full-window, NOT the fullscreen slide show. */
	readonly openReadingView = output<void>();
	/** Enter Outline view: the deck as editable indented text. */
	readonly openOutlineView = output<void>();
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

	protected view() {
		return {
			editable: this.canEdit(),
			showRulers: this.showRulers(),
			showGrid: this.showGrid(),
			showGuides: this.showGuides(),
			snapToGrid: this.snapToGrid(),
			snapToShape: this.snapToShape(),
			templateEditing: this.editor.editTemplateMode(),
			eyedropperActive: this.eyedropperActive(),
			translate: (key: string) => this.translation?.instant(key) ?? key,
		};
	}

	protected request(event: Event): void {
		const intent = (event as RibbonViewRequestEvent).detail;
		if (intent.kind === 'guide') {
			this.addGuide.emit(intent.axis === 'h' ? 'y' : 'x');
		} else if (intent.kind === 'option') {
			const outputs = {
				showRulers: this.toggleRulers,
				showGrid: this.toggleGrid,
				showGuides: this.toggleGuides,
				snapToGrid: this.toggleSnapToGrid,
				snapToShape: this.toggleSnapToShape,
			};
			if (intent.value === 'templateEditing') {
				this.editor.setEditTemplateMode(intent.enabled);
			} else {
				outputs[intent.value].emit();
			}
		} else {
			const commands = {
				normal: this.goToNormalView,
				slideSorter: this.openSorter,
				outline: this.openOutlineView,
				readingView: this.openReadingView,
				slideMaster: this.openMasterView,
				selectionPane: this.toggleSelectionPane,
				eyedropper: this.toggleEyedropper,
				zoomToFit: this.zoomToFit,
			};
			commands[intent.value].emit();
		}
	}
}
