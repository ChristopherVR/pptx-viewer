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
 * Purely presentational + `OnPush`: every action is an `output()` the
 * {@link PowerPointViewerComponent} already has handlers for. Class tokens come
 * verbatim from the shared {@link TITLE_BAR_CLASSES} so the three bindings stay
 * pixel-identical. The host is a plain block (no `display:contents`) so the row
 * renders as one 36px flex strip.
 *
 * The search box and its command palette live in
 * {@link TitleBarSearchComponent}: they are the only stateful part of this row,
 * and keeping them here pushed the file past the repo's 300 LOC ceiling.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideRedo, LucideSave, LucideUndo } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

import {
	DEFAULT_VIEWER_OPTIONS,
	extraQuickAccessCommands,
	resolveTitleBarStatusKey,
	TITLE_BAR_CLASSES,
	TITLE_BAR_DEFAULT_FILE_KEY,
} from '../internal/shared';
import type { ToolbarActionId, ViewerQuickAccessOptions } from '../internal/shared';
import type { AutosaveStatus } from './autosave.service';
import { QuickAccessStripComponent } from './quick-access-strip.component';
import { TitleBarSearchComponent } from './title-bar-search.component';
import { toolbarVisibility } from './toolbar-visibility';

/**
 * Narrow the Quick Access options to the commands rendered BEYOND the dedicated
 * Save/Undo/Redo buttons (which keep their own gating + labels), so the
 * remainder can be handed to {@link QuickAccessStripComponent} as-is.
 *
 * Exported (and pure) because this package has no TestBed: the template's
 * `@if (extraQat().commandIds.length > 0)` is exactly this list, so asserting
 * it asserts what the strip renders.
 */
export function narrowToExtraQuickAccess(
	options: ViewerQuickAccessOptions,
): ViewerQuickAccessOptions {
	return {
		...options,
		commandIds: options.visible
			? extraQuickAccessCommands(options.commandIds).map((entry) => entry.id)
			: [],
	};
}

@Component({
	selector: 'pptx-title-bar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		NgClass,
		TranslatePipe,
		LucideSave,
		LucideUndo,
		LucideRedo,
		QuickAccessStripComponent,
		TitleBarSearchComponent,
	],
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

				@if (qat().visible) {
					<button
						type="button"
						[class]="tb.quickButton"
						[title]="'pptx.titleBar.save' | translate"
						[attr.aria-label]="'pptx.titleBar.save' | translate"
						(click)="save.emit()"
					>
						<svg lucideSave class="h-3.5 w-3.5"></svg>
					</button>
					@if (!toolbar.isHidden('undo')) {
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
							<svg lucideUndo class="h-3.5 w-3.5"></svg>
						</button>
					}
					@if (!toolbar.isHidden('redo')) {
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
							<svg lucideRedo class="h-3.5 w-3.5"></svg>
						</button>
					}
					@if (extraQat().commandIds.length > 0) {
						<pptx-quick-access-strip
							[quickAccess]="extraQat()"
							(command)="onQuickCommand($event)"
						/>
					}
				}

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
					<pptx-title-bar-search
						[findReplaceOpen]="findReplaceOpen()"
						(commandSearch)="commandSearch.emit($event)"
						(toggleFindReplace)="toggleFindReplace.emit()"
					/>
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
	/** Toolbar buttons the host wants hidden (gates Undo/Redo independently). */
	readonly hiddenActions = input<ToolbarActionId[]>([]);
	/** Live Quick Access Toolbar options (File > Options > Quick Access). */
	readonly quickAccess = input<ViewerQuickAccessOptions | null>(null);

	readonly toggleAutosave = output<void>();
	readonly save = output<void>();
	readonly undo = output<void>();
	readonly redo = output<void>();
	/** A configured Quick Access command was pressed (catalog id). */
	readonly quickCommand = output<string>();
	readonly toggleFindReplace = output<void>();
	readonly commandSearch = output<string>();

	protected readonly tb = TITLE_BAR_CLASSES;
	protected readonly defaultFileKey = TITLE_BAR_DEFAULT_FILE_KEY;
	protected readonly toolbar = toolbarVisibility(this.hiddenActions);

	/** Resolved Quick Access options (host-supplied, or the default trio+). */
	protected readonly qat = computed<ViewerQuickAccessOptions>(
		() => this.quickAccess() ?? DEFAULT_VIEWER_OPTIONS.quickAccess,
	);

	/**
	 * The Quick Access options narrowed to the commands beyond the dedicated
	 * save/undo/redo buttons. Reusing {@link QuickAccessStripComponent} for the
	 * remainder means those buttons carry real icons rather than a letter glyph.
	 */
	protected readonly extraQat = computed(() => narrowToExtraQuickAccess(this.qat()));

	/**
	 * Route a Quick Access press: keep the dedicated save/undo/redo outputs
	 * (existing host wiring, `hiddenActions` gating) and forward everything
	 * else through the generic {@link quickCommand} output.
	 */
	protected onQuickCommand(id: string): void {
		if (id === 'save') {
			this.save.emit();
		} else if (id === 'undo' && !this.toolbar.isHidden('undo')) {
			this.undo.emit();
		} else if (id === 'redo' && !this.toolbar.isHidden('redo')) {
			this.redo.emit();
		} else if (id !== 'undo' && id !== 'redo') {
			this.quickCommand.emit(id);
		}
	}

	/** The i18n key for the save-location status text (next to the file name). */
	protected readonly statusKey = computed(() => {
		const status = this.autosaveStatus();
		return resolveTitleBarStatusKey({
			autosaveState: status?.state ?? 'idle',
			isDirty: this.isDirty(),
			autosaveEnabled: this.autosaveEnabled(),
			disabledReason: status?.state === 'disabled' ? status.reason : undefined,
		});
	});

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
