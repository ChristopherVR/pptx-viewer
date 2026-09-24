/**
 * paste-options-toolbar.component.ts: the small icon-strip PowerPoint anchors
 * to the bottom-right corner of a just-pasted element, offering the same four
 * formats as the Paste Special dialog as a one-click follow-up. Dismissed by
 * any subsequent pointerdown or keydown, same as the element context menu.
 *
 * Selector: `pptx-paste-options-toolbar`
 *
 * Angular port of the React `PasteOptionsToolbar.tsx` / Vue `PasteOptionsToolbar.vue`.
 */
import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { PASTE_SPECIAL_OPTIONS } from '../internal/shared';
import type { PasteSpecialFormat } from '../internal/shared';

@Component({
	selector: 'pptx-paste-options-toolbar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (elementId() && rect(); as position) {
			<div
				role="toolbar"
				tabindex="-1"
				[attr.aria-label]="'pptx.pasteSpecial.optionsLabel' | translate"
				data-pptx-paste-options
				class="pptx-ng-paste-options"
				[style.left.px]="position.left + 4"
				[style.top.px]="position.top + 4"
				(mousedown)="$event.stopPropagation()"
			>
				@for (option of options; track option.id) {
					<button
						type="button"
						class="pptx-ng-paste-options-btn"
						[attr.title]="option.labelKey | translate"
						[attr.aria-label]="option.labelKey | translate"
						(click)="choose.emit(option.id)"
					>
						{{ option.labelKey | translate }}
					</button>
				}
			</div>
		}
	`,
	styles: [
		`
			.pptx-ng-paste-options {
				position: fixed;
				z-index: 1100;
				display: flex;
				align-items: center;
				gap: 0.125rem;
				padding: 0.25rem;
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 0.25rem;
				background: var(--pptx-popover, #111827);
				box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
			}

			.pptx-ng-paste-options-btn {
				padding: 0.25rem 0.5rem;
				border: none;
				border-radius: 0.25rem;
				background: transparent;
				color: var(--pptx-foreground, #f3f4f6);
				font-size: 0.6875rem;
				white-space: nowrap;
				cursor: pointer;
			}

			.pptx-ng-paste-options-btn:hover {
				background: var(--pptx-accent, #1f2937);
			}
		`,
	],
})
export class PasteOptionsToolbarComponent {
	/** The just-pasted element's id, or null when the toolbar should be hidden. */
	readonly elementId = input<string | null>(null);

	readonly choose = output<PasteSpecialFormat>();
	readonly dismiss = output<void>();

	protected readonly options = PASTE_SPECIAL_OPTIONS;
	protected readonly rect = signal<{ left: number; top: number } | null>(null);

	private removeListeners: (() => void) | undefined;

	constructor() {
		effect(() => {
			const id = this.elementId();
			this.removeListeners?.();
			this.removeListeners = undefined;
			if (!id) {
				this.rect.set(null);
				return;
			}
			// One frame for the pasted element to mount before measuring it.
			requestAnimationFrame(() => this.measure(id));
		});
	}

	private measure(id: string): void {
		const node = document.querySelector<HTMLElement>(`[data-element-id="${id}"]`);
		if (!node) {
			this.rect.set(null);
			return;
		}
		const box = node.getBoundingClientRect();
		this.rect.set({ left: box.right, top: box.bottom });
		const onOutsideEvent = () => this.dismiss.emit();
		// Deferred so the paste action's OWN pointerdown/keydown does not
		// immediately dismiss the toolbar it just opened.
		window.setTimeout(() => {
			window.addEventListener('pointerdown', onOutsideEvent, true);
			window.addEventListener('keydown', onOutsideEvent, true);
		}, 0);
		this.removeListeners = () => {
			window.removeEventListener('pointerdown', onOutsideEvent, true);
			window.removeEventListener('keydown', onOutsideEvent, true);
		};
	}
}
