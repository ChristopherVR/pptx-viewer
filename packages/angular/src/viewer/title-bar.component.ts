/**
 * title-bar.component.ts: PowerPoint-style top chrome row for the Angular
 * editor.
 *
 * A thin adapter around the shared `pptx-ui-title-bar` element: the logo,
 * AutoSave switch, Save/Undo/Redo + configured quick-access commands, file name
 * and status, and the command search are rendered by the shared view. This
 * component maps viewer state onto the element's controlled state
 * (`buildTitleBarState`) and re-emits its typed events as the outputs
 * {@link PowerPointViewerComponent} already has handlers for.
 *
 * `placement="belowRibbon"` renders the same element as the options-driven
 * extras row under the ribbon. Host-owned parts are projected with
 * `slot="collaboration"` and `slot="account"`.
 */
import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	inject,
	input,
	output,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { map, merge, startWith } from 'rxjs';

import {
	buildTitleBarState,
	DEFAULT_VIEWER_OPTIONS,
	extraQuickAccessCommands,
} from '../internal/shared';
import type {
	TitleBarCommandSearchEvent,
	TitleBarEvent,
	TitleBarPlacement,
	TitleBarViewState,
	ToolbarActionId,
	ViewerQuickAccessOptions,
} from '../internal/shared';
import type { AutosaveStatus } from './autosave.service';
import { ViewerOptionsService } from './viewer-options.service';

/**
 * Narrow the Quick Access options to the commands rendered BEYOND the dedicated
 * Save/Undo/Redo buttons. Exported (and pure) because this package has no
 * TestBed.
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

/**
 * The below-ribbon strip's options, or `null` when nothing renders there:
 * hidden, position `above`, or no commands beyond the dedicated trio.
 * {@link PowerPointViewerComponent} renders the row precisely when this is
 * non-null.
 */
export function resolveBelowRibbonQuickAccess(
	options: ViewerQuickAccessOptions,
): ViewerQuickAccessOptions | null {
	if (!options.visible || options.position !== 'below') {
		return null;
	}
	const narrowed = narrowToExtraQuickAccess(options);
	return narrowed.commandIds.length > 0 ? narrowed : null;
}

@Component({
	selector: 'pptx-title-bar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	host: { class: 'contents' },
	template: `
		<pptx-ui-title-bar
			[state]="view()"
			[attr.placement]="placement()"
			(toggle-autosave)="onToggleAutosave($event)"
			(save)="onEvent('save', $event)"
			(undo)="onEvent('undo', $event)"
			(redo)="onEvent('redo', $event)"
			(quick-command)="onQuickCommand($event)"
			(command-search)="onCommandSearch($event)"
		>
			<ng-content select="[slot=collaboration]"></ng-content>
			<ng-content select="[slot=account]"></ng-content>
		</pptx-ui-title-bar>
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
	/** False when the host forbade autosave: the switch renders inert. */
	readonly autosaveToggleAvailable = input<boolean>(true);
	readonly canUndo = input<boolean>(false);
	readonly canRedo = input<boolean>(false);
	readonly undoLabel = input<string | undefined>(undefined);
	readonly redoLabel = input<string | undefined>(undefined);
	/** Whether the Find & Replace panel is open (kept for API compatibility). */
	readonly findReplaceOpen = input<boolean>(false);
	/** Toolbar buttons the host wants hidden (gates Undo/Redo independently). */
	readonly hiddenActions = input<ToolbarActionId[]>([]);
	/** Live Quick Access Toolbar options (File > Options > Quick Access). */
	readonly quickAccess = input<ViewerQuickAccessOptions | null>(null);
	/** `titleBar` renders the whole row; `belowRibbon` only the extras row. */
	readonly placement = input<TitleBarPlacement>('titleBar');

	readonly toggleAutosave = output<void>();
	readonly save = output<void>();
	readonly undo = output<void>();
	readonly redo = output<void>();
	/** A configured Quick Access command was pressed (catalog id). */
	readonly quickCommand = output<string>();
	readonly toggleFindReplace = output<void>();
	readonly commandSearch = output<string>();

	private readonly translate = inject(TranslateService);
	/** Optional so the bar renders outside a full viewer host too. */
	private readonly viewerOpts = inject(ViewerOptionsService, { optional: true });
	/** Changes on language/dictionary updates so OnPush re-translates the view. */
	private readonly translations = toSignal(
		merge(this.translate.onLangChange, this.translate.onTranslationChange).pipe(
			map(() => Date.now()),
			startWith(0),
		),
		{ initialValue: 0 },
	);

	protected view(): TitleBarViewState {
		this.translations();
		const status = this.autosaveStatus();
		return buildTitleBarState({
			editing: this.canEdit(),
			fileName: this.fileName(),
			isDirty: this.isDirty(),
			autosaveState: status?.state,
			autosaveReason: status?.state === 'disabled' ? status.reason : undefined,
			autosaveEnabled: this.autosaveEnabled(),
			autosaveToggleAvailable: this.autosaveToggleAvailable(),
			canUndo: this.canUndo(),
			canRedo: this.canRedo(),
			undoLabel: this.undoLabel(),
			redoLabel: this.redoLabel(),
			hiddenActions: this.hiddenActions(),
			quickAccess: this.quickAccess() ?? DEFAULT_VIEWER_OPTIONS.quickAccess,
			screenTip: (label) =>
				this.viewerOpts ? (this.viewerOpts.screenTip(label) ?? undefined) : label,
			translate: (key, params) => this.translate.instant(key, params),
		});
	}

	/**
	 * The element's events bubble, composed, and `save`, `undo` and `redo` share
	 * their names with this component's outputs. Angular would run a host's
	 * `(undo)` binding for the DOM event as well as for the output (twice in all),
	 * so each event is consumed here.
	 */
	private consume(event?: Event): void {
		event?.stopPropagation();
	}

	protected onToggleAutosave(event?: Event): void {
		this.consume(event);
		this.toggleAutosave.emit();
	}

	protected onEvent(id: 'save' | 'undo' | 'redo', event?: Event): void {
		this.consume(event);
		this[id].emit();
	}

	protected onQuickCommand(event: Event): void {
		this.consume(event);
		this.quickCommand.emit((event as TitleBarEvent<'quick-command'>).detail.id);
	}

	protected onCommandSearch(event: Event): void {
		this.consume(event);
		const { command } = (event as TitleBarCommandSearchEvent).detail;
		if (command) {
			this.commandSearch.emit(command);
		} else {
			this.toggleFindReplace.emit();
		}
	}
}
