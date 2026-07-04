/**
 * title-bar.component.ts: PowerPoint-style top chrome row for the Angular
 * editor, at parity with React's `viewer/components/toolbar/TitleBar.tsx`.
 *
 * Renders (left to right): the square "P" app mark, an AutoSave label + switch
 * toggle + On/Off text, quick-access Save/Undo/Redo icon buttons, the open
 * document's name + a save-location status (resolved via the shared
 * {@link resolveTitleBarStatusKey}), and a centred search button that opens
 * Find & Replace. Rendered ABOVE and OUTSIDE the ribbon's `role="toolbar"`
 * container so the toolbar height stays measurable for the e2e parity spec.
 *
 * Purely presentational + `OnPush`: every action is an `output()` the
 * {@link PowerPointViewerComponent} already has handlers for. Class tokens come
 * verbatim from the shared {@link TITLE_BAR_CLASSES} so the three bindings stay
 * pixel-identical. The host is a plain block (no `display:contents`) so the row
 * renders as one 36px flex strip.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import {
	resolveTitleBarStatusKey,
	TITLE_BAR_CLASSES,
	TITLE_BAR_DEFAULT_FILE_KEY,
} from '../internal/shared';
import type { AutosaveStatus } from './autosave.service';

@Component({
	selector: 'pptx-title-bar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgClass, TranslatePipe],
	template: `
		<div [class]="tb.container" data-pptx-title-bar>
			<span [class]="tb.logo" aria-hidden="true">P</span>

			@if (canEdit()) {
				<span [class]="tb.autosaveGroup">
					<span [class]="tb.autosaveLabel">{{ 'pptx.titleBar.autoSave' | translate }}</span>
					<button
						type="button"
						role="switch"
						[attr.aria-checked]="autosaveEnabled()"
						[class]="tb.toggleTrack"
						[ngClass]="autosaveEnabled() ? tb.toggleTrackOn : tb.toggleTrackOff"
						[title]="'pptx.titleBar.toggleAutoSave' | translate"
						[attr.aria-label]="'pptx.titleBar.toggleAutoSave' | translate"
						(click)="toggleAutosave.emit()"
					>
						<span
							[class]="tb.toggleKnob"
							[ngClass]="autosaveEnabled() ? tb.toggleKnobOn : tb.toggleKnobOff"
						></span>
					</button>
					<span [class]="tb.autosaveLabel">{{
						(autosaveEnabled() ? 'pptx.titleBar.autoSaveOn' : 'pptx.titleBar.autoSaveOff')
							| translate
					}}</span>
				</span>

				<div [class]="tb.separator"></div>

				<button
					type="button"
					[class]="tb.quickButton"
					[title]="'pptx.titleBar.save' | translate"
					[attr.aria-label]="'pptx.titleBar.save' | translate"
					(click)="save.emit()"
				>
					💾
				</button>
				<button
					type="button"
					[class]="tb.quickButton"
					[disabled]="!canUndo()"
					[title]="
						undoLabel()
							? ('pptx.toolbar.undoAction' | translate: { action: undoLabel() })
							: ('pptx.toolbar.undo' | translate)
					"
					[attr.aria-label]="'pptx.toolbar.undo' | translate"
					(click)="undo.emit()"
				>
					↶
				</button>
				<button
					type="button"
					[class]="tb.quickButton"
					[disabled]="!canRedo()"
					[title]="
						redoLabel()
							? ('pptx.toolbar.redoAction' | translate: { action: redoLabel() })
							: ('pptx.toolbar.redo' | translate)
					"
					[attr.aria-label]="'pptx.toolbar.redo' | translate"
					(click)="redo.emit()"
				>
					↷
				</button>

				<div [class]="tb.separator"></div>
			}

			<span [class]="tb.fileGroup">
				<span [class]="tb.fileName">{{ fileName() || (defaultFileKey | translate) }}</span>
				@if (canEdit()) {
					<span [class]="tb.statusDot" aria-hidden="true">&bull;</span>
					<span [class]="tb.statusText" [ngClass]="statusStateClass()">{{
						statusKey() | translate
					}}</span>
				}
			</span>

			<span [class]="tb.searchWrap">
				@if (canEdit()) {
					<button
						type="button"
						[class]="tb.searchBox"
						[ngClass]="findReplaceOpen() ? 'text-foreground bg-background' : ''"
						[title]="'pptx.findReplace.title' | translate"
						[attr.aria-label]="'pptx.titleBar.search' | translate"
						(click)="toggleFindReplace.emit()"
					>
						<span [class]="tb.searchIcon" aria-hidden="true">⌕</span>
						<span [class]="tb.searchLabel">{{ 'pptx.titleBar.search' | translate }}</span>
					</button>
				}
			</span>

			<span [class]="tb.rightSpacer"></span>
		</div>
	`,
})
export class TitleBarComponent {
	/** Whether the deck is editable (gates the autosave/quick-access/search chrome). */
	readonly canEdit = input<boolean>(false);
	/** Display name of the open document (host-supplied). */
	readonly fileName = input<string | undefined>(undefined);
	/** Whether the document has unsaved changes. */
	readonly isDirty = input<boolean>(false);
	/** Current autosave engine status (drives the save-location text). */
	readonly autosaveStatus = input<AutosaveStatus | undefined>(undefined);
	/** Whether the AutoSave toggle is on. */
	readonly autosaveEnabled = input<boolean>(true);
	readonly canUndo = input<boolean>(false);
	readonly canRedo = input<boolean>(false);
	readonly undoLabel = input<string | undefined>(undefined);
	readonly redoLabel = input<string | undefined>(undefined);
	/** Whether the Find & Replace panel is open (search-button active state). */
	readonly findReplaceOpen = input<boolean>(false);

	readonly toggleAutosave = output<void>();
	/** Quick-access save (downloads the `.pptx`). */
	readonly save = output<void>();
	readonly undo = output<void>();
	readonly redo = output<void>();
	readonly toggleFindReplace = output<void>();

	protected readonly tb = TITLE_BAR_CLASSES;
	protected readonly defaultFileKey = TITLE_BAR_DEFAULT_FILE_KEY;

	/** The i18n key for the save-location status text (next to the file name). */
	protected readonly statusKey = computed(() =>
		resolveTitleBarStatusKey({
			autosaveState: this.autosaveStatus()?.state ?? 'idle',
			isDirty: this.isDirty(),
			autosaveEnabled: this.autosaveEnabled(),
		}),
	);

	/** Colour override for the status text on saving/error (when autosave is on). */
	protected readonly statusStateClass = computed(() => {
		const state = this.autosaveStatus()?.state;
		if (!this.autosaveEnabled()) {
			return '';
		}
		if (state === 'error') {
			return this.tb.statusError;
		}
		if (state === 'saving') {
			return this.tb.statusSaving;
		}
		return '';
	});
}
