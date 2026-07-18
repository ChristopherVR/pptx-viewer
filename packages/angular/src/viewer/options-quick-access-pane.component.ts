/**
 * options-quick-access-pane.component.ts: Options > Quick Access Toolbar pane
 * (Angular port of React's `settings/OptionsQuickAccessPane.tsx`).
 *
 * PowerPoint's dual-list command chooser over the shared
 * {@link QUICK_ACCESS_COMMAND_CATALOG}: available commands on the left, the
 * current toolbar on the right, Add/Remove between them, reorder arrows, and a
 * Reset back to {@link DEFAULT_QUICK_ACCESS_COMMAND_IDS}.
 */
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import {
	addQuickAccessCommand,
	availableQuickAccessCommands,
	DEFAULT_QUICK_ACCESS_COMMAND_IDS,
	getQuickAccessCommand,
	moveQuickAccessCommand,
	removeQuickAccessCommand,
} from '../internal/shared';
import type { ViewerOptions } from '../internal/shared';

@Component({
	selector: 'pptx-options-quick-access-pane',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<div class="pptx-ng-options-qat">
			<div class="pptx-ng-options-qat-lists">
				<div class="pptx-ng-options-qat-col">
					<p>{{ 'pptx.options.quickAccess.chooseCommands' | translate }}</p>
					<div
						role="listbox"
						[attr.aria-label]="'pptx.options.quickAccess.chooseCommands' | translate"
					>
						@for (id of available(); track id) {
							<button
								type="button"
								role="option"
								[attr.aria-selected]="selectedAvailable() === id"
								[class.is-selected]="selectedAvailable() === id"
								(click)="selectedAvailable.set(id)"
							>
								{{ labelKey(id) | translate }}
							</button>
						}
					</div>
				</div>
				<div class="pptx-ng-options-qat-actions">
					<button
						type="button"
						class="pptx-ng-options-btn"
						[disabled]="!selectedAvailable()"
						(click)="add()"
					>
						{{ 'pptx.options.quickAccess.add' | translate }} &raquo;
					</button>
					<button
						type="button"
						class="pptx-ng-options-btn"
						[disabled]="!selectedCurrent()"
						(click)="remove()"
					>
						&laquo; {{ 'pptx.options.quickAccess.remove' | translate }}
					</button>
				</div>
				<div class="pptx-ng-options-qat-col">
					<p>{{ 'pptx.options.quickAccess.currentCommands' | translate }}</p>
					<div
						role="listbox"
						[attr.aria-label]="'pptx.options.quickAccess.currentCommands' | translate"
					>
						@for (id of current(); track id) {
							<button
								type="button"
								role="option"
								[attr.aria-selected]="selectedCurrent() === id"
								[class.is-selected]="selectedCurrent() === id"
								(click)="selectedCurrent.set(id)"
							>
								{{ labelKey(id) | translate }}
							</button>
						}
					</div>
				</div>
				<div class="pptx-ng-options-qat-actions">
					<button
						type="button"
						class="pptx-ng-options-btn"
						[disabled]="!selectedCurrent()"
						[attr.aria-label]="'pptx.options.quickAccess.moveUp' | translate"
						(click)="move('up')"
					>
						&#9650;
					</button>
					<button
						type="button"
						class="pptx-ng-options-btn"
						[disabled]="!selectedCurrent()"
						[attr.aria-label]="'pptx.options.quickAccess.moveDown' | translate"
						(click)="move('down')"
					>
						&#9660;
					</button>
				</div>
			</div>
			<button type="button" class="pptx-ng-options-btn" (click)="reset()">
				{{ 'pptx.options.quickAccess.reset' | translate }}
			</button>
		</div>
	`,
	styles: [
		`
			.pptx-ng-options-qat {
				display: flex;
				flex-direction: column;
				gap: 10px;
			}
			.pptx-ng-options-qat-lists {
				display: flex;
				align-items: stretch;
				gap: 10px;
			}
			.pptx-ng-options-qat-col {
				flex: 1;
				min-width: 0;
			}
			.pptx-ng-options-qat-col p {
				margin: 0 0 4px;
				color: var(--pptx-muted-foreground);
				font-size: 11px;
				font-weight: 600;
			}
			.pptx-ng-options-qat-col [role='listbox'] {
				height: 190px;
				overflow-y: auto;
				padding: 4px;
				border: 1px solid var(--pptx-border);
				border-radius: 6px;
			}
			.pptx-ng-options-qat-col [role='option'] {
				display: block;
				width: 100%;
				padding: 5px 8px;
				border: 0;
				border-radius: 4px;
				background: transparent;
				color: var(--pptx-foreground);
				font-size: 13px;
				text-align: left;
				cursor: pointer;
			}
			.pptx-ng-options-qat-col [role='option']:hover {
				background: var(--pptx-accent);
			}
			.pptx-ng-options-qat-col [role='option'].is-selected {
				background: color-mix(in srgb, var(--pptx-primary) 15%, transparent);
				color: var(--pptx-primary);
			}
			.pptx-ng-options-qat-actions {
				display: flex;
				flex-direction: column;
				justify-content: center;
				gap: 8px;
			}
			.pptx-ng-options-btn {
				padding: 5px 10px;
				border: 1px solid var(--pptx-border);
				border-radius: 4px;
				background: transparent;
				color: var(--pptx-foreground);
				font-size: 12px;
				white-space: nowrap;
				cursor: pointer;
			}
			.pptx-ng-options-btn:hover:not(:disabled) {
				background: var(--pptx-accent);
			}
			.pptx-ng-options-btn:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}
			.pptx-ng-options-qat > .pptx-ng-options-btn {
				align-self: flex-start;
			}
		`,
	],
})
export class OptionsQuickAccessPaneComponent {
	readonly options = input.required<ViewerOptions>();
	/** The full replacement command-id list (applied live by the host). */
	readonly commandsChange = output<string[]>();

	protected readonly selectedAvailable = signal<string | null>(null);
	protected readonly selectedCurrent = signal<string | null>(null);

	protected readonly current = computed(() => this.options().quickAccess.commandIds);
	protected readonly available = computed(() =>
		availableQuickAccessCommands(this.current()).map((entry) => entry.id),
	);

	protected labelKey(id: string): string {
		return getQuickAccessCommand(id)?.labelKey ?? id;
	}

	protected add(): void {
		const id = this.selectedAvailable();
		if (id) {
			this.commandsChange.emit(addQuickAccessCommand(this.current(), id));
			this.selectedAvailable.set(null);
		}
	}

	protected remove(): void {
		const id = this.selectedCurrent();
		if (id) {
			this.commandsChange.emit(removeQuickAccessCommand(this.current(), id));
			this.selectedCurrent.set(null);
		}
	}

	protected move(direction: 'up' | 'down'): void {
		const id = this.selectedCurrent();
		if (id) {
			this.commandsChange.emit(moveQuickAccessCommand(this.current(), id, direction));
		}
	}

	protected reset(): void {
		this.commandsChange.emit([...DEFAULT_QUICK_ACCESS_COMMAND_IDS]);
	}
}
