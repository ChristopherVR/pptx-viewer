/**
 * edit-points-menu.component.ts: the Edit Points right-click menu (a vertex or
 * a segment).
 *
 * Selector: `pptx-edit-points-menu`
 *
 * Entries, order, greying and checks come from the shared `EditPointsSession`;
 * this is the Angular paint, in the canvas context menu's look. It renders
 * inside the scaled stage at the click's slide position and is scaled back by
 * `inverseScale`, so it stays screen-sized at every zoom without an overlay
 * container (a `position: fixed` child of the transformed stage would be
 * placed relative to the stage, not the viewport).
 *
 * Reference binding: packages/react/src/viewer/components/canvas/EditPointsMenu.tsx
 *
 * @module viewer/edit-points-menu
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { EditPointsCommandId, EditPointsMenuView } from '../internal/shared';
import { EDITOR_CONTEXT_MENU_STYLES } from './editor-context-menu.styles';

/**
 * Re-anchors the context menu's look inside the stage: it follows
 * `EDITOR_CONTEXT_MENU_STYLES`, so this `:host` rule wins over its fixed one
 * (and the inline left / top bindings win over its custom-property position).
 */
const MENU_HOST_STYLES = `
	:host {
		position: absolute;
		z-index: 61;
		display: block;
		transform-origin: 0 0;
	}
	.pptx-ctx__check {
		display: inline-block;
		width: 12px;
		margin-right: 6px;
	}
`;

@Component({
	selector: 'pptx-edit-points-menu',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<ul
			class="pptx-ctx__menu"
			role="menu"
			data-pptx-edit-points-menu="true"
			[attr.aria-label]="'pptx.editPoints.menu' | translate"
		>
			@for (entry of menu().entries; track entry.id) {
				@if (entry.separatorBefore) {
					<li role="separator" class="pptx-ctx__divider"></li>
				}
				<li role="none" [attr.data-pptx-edit-points-command]="entry.id">
					<button
						type="button"
						class="pptx-ctx__item"
						[attr.role]="entry.checked === undefined ? 'menuitem' : 'menuitemcheckbox'"
						[attr.aria-checked]="entry.checked === undefined ? null : entry.checked"
						[disabled]="!!entry.disabled"
						(click)="run.emit(entry.id)"
					>
						@if (entry.checked !== undefined) {
							<span class="pptx-ctx__check" aria-hidden="true">{{
								entry.checked ? check : ''
							}}</span>
						}
						{{ entry.labelKey | translate }}
					</button>
				</li>
			}
		</ul>
	`,
	styles: [EDITOR_CONTEXT_MENU_STYLES, MENU_HOST_STYLES],
	host: {
		'[style.left.px]': 'menu().x',
		'[style.top.px]': 'menu().y',
		'[style.transform]': '"scale(" + menu().inverseScale + ")"',
		'(pointerdown)': '$event.stopPropagation()',
		'(mousedown)': '$event.stopPropagation()',
		'(click)': '$event.stopPropagation()',
		'(contextmenu)': '$event.preventDefault(); $event.stopPropagation()',
	},
})
export class EditPointsMenuComponent {
	readonly menu = input.required<EditPointsMenuView>();
	/** A command was chosen. */
	readonly run = output<EditPointsCommandId>();
	/** The tick drawn beside a checked vertex type / segment kind. */
	protected readonly check = '✓';
}
