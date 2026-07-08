/**
 * selection-pane.component.ts: Side panel listing all elements on the active slide.
 *
 * Selector: `pptx-selection-pane`
 *
 * Displays elements in reverse z-order (topmost first = last in the elements array).
 * Each row shows a type icon, the element's name or id, visibility toggle, and
 * z-order nudge buttons. Clicking a row selects that element; clicking the eye icon
 * toggles its `hidden` flag; the up/down arrows bring it forward or send it backward.
 *
 * Presentational only: all state mutations are surfaced as outputs.
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideArrowDown, LucideArrowUp, LucideEye, LucideEyeOff } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

/** Unicode icon by element type (no Lucide dependency in Angular). */
const ELEMENT_TYPE_ICONS: Record<string, string> = {
	text: 'T',
	shape: '▭',
	image: 'Img',
	table: '⊞',
	chart: 'Cht',
	connector: '╱',
	group: '▣',
	smartArt: '◈',
	media: '▶',
	ink: '✏',
	ole: 'OLE',
};

function elementIcon(type: string): string {
	return ELEMENT_TYPE_ICONS[type] ?? '?';
}

function elementLabel(el: PptxElement): string {
	if ('name' in el && typeof el.name === 'string' && el.name.trim().length > 0) {
		return el.name;
	}
	return el.id;
}

@Component({
	selector: 'pptx-selection-pane',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, LucideEye, LucideEyeOff, LucideArrowUp, LucideArrowDown],
	template: `
		<aside class="pptx-ng-sel-pane" [attr.aria-label]="'pptx.selectionPane.title' | translate">
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

							<span class="pptx-ng-sel-pane__label" [title]="elLabel(el)">{{ elLabel(el) }}</span>

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
	styles: [
		`
			:host {
				display: block;
				height: 100%;
				width: 100%;
			}

			.pptx-ng-sel-pane {
				display: flex;
				flex-direction: column;
				min-height: 0;
				height: 100%;
				width: 100%;
				background: var(--pptx-card, #111827);
				color: var(--pptx-foreground, #f3f4f6);
				border-left: 1px solid var(--pptx-border, #374151);
				font-family: system-ui, sans-serif;
			}

			.pptx-ng-sel-pane__header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 12px 16px;
				border-bottom: 1px solid var(--pptx-border, #374151);
				flex-shrink: 0;
			}

			.pptx-ng-sel-pane__title {
				margin: 0;
				font-size: 14px;
				font-weight: 600;
			}

			.pptx-ng-sel-pane__count {
				font-size: 12px;
				color: var(--pptx-muted-foreground, #9ca3af);
			}

			.pptx-ng-sel-pane__list {
				list-style: none;
				margin: 0;
				padding: 8px;
				overflow-y: auto;
				flex: 1 1 auto;
				min-height: 0;
			}

			.pptx-ng-sel-pane__row {
				display: flex;
				align-items: center;
				gap: 6px;
				padding: 6px 8px;
				border-radius: 6px;
				border: 1px solid transparent;
				cursor: pointer;
				margin-bottom: 2px;
				transition: background 0.1s;
				user-select: none;
			}

			.pptx-ng-sel-pane__row:hover {
				background: var(--pptx-accent, #1f2937);
			}

			.pptx-ng-sel-pane__row--selected {
				border-color: var(--pptx-primary, #6366f1);
				background: color-mix(in srgb, var(--pptx-primary, #6366f1) 15%, transparent);
			}

			.pptx-ng-sel-pane__row--hidden {
				opacity: 0.5;
			}

			.pptx-ng-sel-pane__icon {
				flex-shrink: 0;
				width: 20px;
				text-align: center;
				font-size: 12px;
				color: var(--pptx-muted-foreground, #9ca3af);
			}

			.pptx-ng-sel-pane__label {
				flex: 1 1 auto;
				font-size: 12px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				min-width: 0;
			}

			.pptx-ng-sel-pane__actions {
				display: flex;
				gap: 2px;
				flex-shrink: 0;
			}

			.pptx-ng-sel-pane__btn {
				background: transparent;
				border: 1px solid var(--pptx-border, #374151);
				color: inherit;
				border-radius: 4px;
				padding: 2px 5px;
				font-size: 11px;
				cursor: pointer;
				line-height: 1.2;
			}

			.pptx-ng-sel-pane__btn:hover {
				background: var(--pptx-accent, #1f2937);
			}

			.pptx-ng-sel-pane__empty {
				padding: 16px;
				font-size: 13px;
				color: var(--pptx-muted-foreground, #9ca3af);
			}
		`,
	],
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

	/** Elements reversed so the topmost (last in array) appears first in the list. */
	protected readonly reversedElements = computed<readonly PptxElement[]>(() =>
		[...this.elements()].reverse(),
	);

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
