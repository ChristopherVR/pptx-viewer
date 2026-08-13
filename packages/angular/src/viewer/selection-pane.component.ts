/**
 * selection-pane.component.ts: Side panel listing all elements on the active slide.
 *
 * Selector: `pptx-selection-pane`
 *
 * Displays elements in reverse z-order (topmost first = last in the elements array).
 * Each row shows a type icon, the element's name or id, visibility toggle, and
 * z-order nudge buttons. Clicking a row selects that element; clicking the eye icon
 * toggles its `hidden` flag; the up/down arrows bring it forward or send it backward;
 * double-clicking the name label edits it inline (Enter/blur commit, Escape cancels).
 *
 * Presentational only: all state mutations are surfaced as outputs.
 */

import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { LucideArrowDown, LucideArrowUp, LucideEye, LucideEyeOff } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import { elementIcon, elementLabel, renameCommitName } from './selection-pane-helpers';

/** Payload of `renameElement`: an empty `name` clears the element's name. */
export interface SelectionPaneRename {
	id: string;
	name: string;
}

@Component({
	selector: 'pptx-selection-pane',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, LucideEye, LucideEyeOff, LucideArrowUp, LucideArrowDown],
	template: `
		<aside
			class="pptx-ng-sel-pane"
			data-pptx-selection-pane
			[attr.aria-label]="'pptx.selectionPane.title' | translate"
		>
			<header class="pptx-ng-sel-pane__header">
				<h2 class="pptx-ng-sel-pane__title">{{ 'pptx.selectionPane.title' | translate }}</h2>
				<span class="pptx-ng-sel-pane__count">{{ elements().length }}</span>
			</header>

			@if (reversedElements().length > 0) {
				<ul class="pptx-ng-sel-pane__list" role="listbox" aria-multiselectable="true">
					@for (el of reversedElements(); track el.id) {
						<li
							class="pptx-ng-sel-pane__row"
							[class.pptx-ng-sel-pane__row--selected]="isSelected(el.id)"
							[class.pptx-ng-sel-pane__row--hidden]="el.hidden"
							role="option"
							[attr.aria-selected]="isSelected(el.id)"
							(click)="selectElement.emit(el.id)"
						>
							<span class="pptx-ng-sel-pane__icon" [attr.title]="el.type" aria-hidden="true">{{
								typeIcon(el.type)
							}}</span>

							<span
								class="pptx-ng-sel-pane__label"
								data-pptx-selection-name
								[title]="elLabel(el)"
								(dblclick)="startRename(el)"
							>
								@if (editingId() === el.id) {
									<input
										type="text"
										class="pptx-ng-sel-pane__rename"
										autofocus
										[value]="renameSeed"
										[attr.aria-label]="'pptx.selectionPane.renameElement' | translate"
										(click)="$event.stopPropagation()"
										(keydown.enter)="commitRename(el.id, $event)"
										(keydown.escape)="cancelRename($event)"
										(blur)="commitRename(el.id, $event)"
									/>
								} @else {
									{{ elLabel(el) }}
								}
							</span>

							<div class="pptx-ng-sel-pane__actions" (click)="$event.stopPropagation()">
								<button
									type="button"
									class="pptx-ng-sel-pane__btn"
									[attr.aria-label]="
										(el.hidden
											? 'pptx.selectionPane.showElement'
											: 'pptx.selectionPane.hideElement'
										) | translate
									"
									[title]="
										(el.hidden ? 'pptx.selectionPane.show' : 'pptx.selectionPane.hide') | translate
									"
									(click)="toggleHidden.emit(el.id)"
								>
									@if (el.hidden) {
										<svg lucideEyeOff class="h-3.5 w-3.5"></svg>
									} @else {
										<svg lucideEye class="h-3.5 w-3.5"></svg>
									}
								</button>
								<button
									type="button"
									class="pptx-ng-sel-pane__btn"
									[attr.aria-label]="'pptx.arrange.bringForward' | translate"
									[title]="'pptx.arrange.bringForward' | translate"
									(click)="bringForward.emit(el.id)"
								>
									<svg lucideArrowUp class="h-3.5 w-3.5"></svg>
								</button>
								<button
									type="button"
									class="pptx-ng-sel-pane__btn"
									[attr.aria-label]="'pptx.arrange.sendBackward' | translate"
									[title]="'pptx.arrange.sendBackward' | translate"
									(click)="sendBackward.emit(el.id)"
								>
									<svg lucideArrowDown class="h-3.5 w-3.5"></svg>
								</button>
							</div>
						</li>
					}
				</ul>
			} @else {
				<p class="pptx-ng-sel-pane__empty">{{ 'pptx.selectionPane.empty' | translate }}</p>
			}
		</aside>
	`,
	styleUrl: './selection-pane.component.css',
})
export class SelectionPaneComponent {
	/** All elements on the active slide. */
	readonly elements = input<readonly PptxElement[]>([]);
	/** Currently selected element ids. */
	readonly selectedIds = input<readonly string[]>([]);

	/** Emits the id of the element the user clicked. */
	readonly selectElement = output<string>();
	/** Emits the id of the element to bring one step forward in z-order. */
	readonly bringForward = output<string>();
	/** Emits the id of the element to send one step backward in z-order. */
	readonly sendBackward = output<string>();
	/** Emits the id of the element whose hidden flag should be toggled. */
	readonly toggleHidden = output<string>();
	/** Emits the rename commit; an empty `name` clears the element's name. */
	readonly renameElement = output<SelectionPaneRename>();

	/** Elements reversed so the topmost (last in array) appears first in the list. */
	protected readonly reversedElements = computed<readonly PptxElement[]>(() =>
		[...this.elements()].reverse(),
	);

	/** Id of the row whose name is being edited inline, or null. */
	protected readonly editingId = signal<string | null>(null);
	/** The label the rename input was seeded with (unedited commits are no-ops). */
	protected renameSeed = '';

	/** Double-click on the name label: open the inline rename input. */
	protected startRename(el: PptxElement): void {
		this.renameSeed = elementLabel(el);
		this.editingId.set(el.id);
	}

	/**
	 * Commit (Enter or blur). Enter closes the input, which fires blur; the
	 * editingId guard makes that second call a no-op instead of a double emit.
	 */
	protected commitRename(id: string, event: Event): void {
		if (this.editingId() !== id) {
			return;
		}
		this.editingId.set(null);
		const patch = renameCommitName(this.renameSeed, (event.target as HTMLInputElement).value);
		if (patch !== null) {
			this.renameElement.emit({ id, name: patch.name });
		}
	}

	/** Escape: drop the edit without committing. */
	protected cancelRename(event: Event): void {
		event.stopPropagation();
		this.editingId.set(null);
	}

	protected isSelected(id: string): boolean {
		return this.selectedIds().includes(id);
	}

	protected typeIcon(type: string): string {
		return elementIcon(type);
	}

	protected elLabel(el: PptxElement): string {
		return elementLabel(el);
	}
}
