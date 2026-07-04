/**
 * shortcut-panel.component.ts: Floating keyboard-shortcut cheat sheet.
 *
 * Selector: `pptx-shortcut-panel`
 *
 * Angular port of the React `ShortcutPanel` component
 * (`packages/react/src/viewer/components/ShortcutPanel.tsx`). Unlike the
 * dialogs, this is NOT a modal: it is a small floating popover anchored to the
 * top-right of the viewer that lists the keyboard shortcuts from
 * {@link SHORTCUT_REFERENCE_ITEMS}. The host owns the `open` flag; the component
 * only renders and emits `close`.
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { SHORTCUT_REFERENCE_ITEMS } from './shortcut-reference';

@Component({
	selector: 'pptx-shortcut-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (open()) {
			<div class="pptx-ng-shortcuts" data-pptx-shortcuts-panel="true">
				<div class="pptx-ng-shortcuts-header">
					<span class="pptx-ng-shortcuts-title">{{ 'pptx.shortcuts.title' | translate }}</span>
					<button type="button" class="pptx-ng-shortcuts-close" (click)="close.emit()">
						{{ 'pptx.common.close' | translate }}
					</button>
				</div>
				<div class="pptx-ng-shortcuts-list">
					@for (item of items; track item.actionKey) {
						<div class="pptx-ng-shortcuts-row">
							<span class="pptx-ng-shortcuts-action">{{ item.actionKey | translate }}</span>
							<span class="pptx-ng-shortcuts-keys">{{ item.shortcut }}</span>
						</div>
					}
				</div>
			</div>
		}
	`,
	styles: [
		`
			.pptx-ng-shortcuts {
				position: absolute;
				top: 3.5rem;
				right: 0.75rem;
				z-index: 40;
				width: min(24rem, calc(100% - 1.5rem));
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 0.25rem;
				background: var(--pptx-popover, #111827);
				color: var(--pptx-foreground, #f3f4f6);
				box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
			}

			.pptx-ng-shortcuts-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.5rem;
				padding: 0.5rem 0.75rem;
				border-bottom: 1px solid var(--pptx-border, #374151);
			}

			.pptx-ng-shortcuts-title {
				font-size: 0.75rem;
				text-transform: uppercase;
				letter-spacing: 0.05em;
				color: var(--pptx-foreground, #f3f4f6);
			}

			.pptx-ng-shortcuts-close {
				padding: 0.25rem 0.5rem;
				font-size: 0.6875rem;
				color: var(--pptx-foreground, #f3f4f6);
				background: transparent;
				border: none;
				border-radius: 0.25rem;
				cursor: pointer;
			}

			.pptx-ng-shortcuts-close:hover {
				background: var(--pptx-muted, #1f2937);
			}

			.pptx-ng-shortcuts-list {
				max-height: 16rem;
				overflow-y: auto;
				padding: 0.5rem;
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
			}

			.pptx-ng-shortcuts-row {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.75rem;
				padding: 0.375rem 0.5rem;
				border-radius: 0.25rem;
				background: var(--pptx-muted, rgba(31, 41, 55, 0.8));
			}

			.pptx-ng-shortcuts-action {
				font-size: 0.75rem;
				color: var(--pptx-foreground, #f3f4f6);
			}

			.pptx-ng-shortcuts-keys {
				font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
				font-size: 0.6875rem;
				white-space: nowrap;
				color: var(--pptx-foreground, #f3f4f6);
			}
		`,
	],
})
export class ShortcutPanelComponent {
	/** Whether the popover is visible. */
	readonly open = input<boolean>(false);

	/** Fired when the Close button is clicked. */
	readonly close = output<void>();

	/** Static shortcut reference rows. */
	protected readonly items = SHORTCUT_REFERENCE_ITEMS;
}
