/**
 * hyperlink-dialog.component.ts — Set or clear an element's click hyperlink.
 *
 * Selector: `pptx-hyperlink-dialog`
 *
 * Angular port of the Vue `HyperlinkDialog.vue`. Edits the element-level
 * `actionClick` URL + tooltip pair (mirroring the React implementation). On
 * apply it emits a `save` patch shaped as `{ actionClick: PptxAction | undefined }`:
 *  - **Set:** preserves any preexisting OOXML `action` verb.
 *  - **Clear:** an empty / unsafe URL, or the explicit "Remove link" button.
 *
 * Composes {@link ModalDialogComponent}. Pure parse / normalize / safety logic
 * lives in `./hyperlink-dialog-helpers` (which reuses `./hyperlink`).
 */

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	input,
	output,
	signal,
} from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

import {
	buildClearHyperlinkPatch,
	buildHyperlinkPatch,
	hasExistingLink,
	seedHyperlinkDraft,
} from './hyperlink-dialog-helpers';
import { ModalDialogComponent } from './modal-dialog.component';

@Component({
	selector: 'pptx-hyperlink-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ModalDialogComponent],
	template: `
		<pptx-modal-dialog [open]="open()" title="Hyperlink" (close)="onClose()">
			<div class="pptx-ng-hyperlink-form">
				<label class="pptx-ng-hyperlink-field">
					<span class="pptx-ng-hyperlink-label">Address</span>
					<input
						type="url"
						class="pptx-ng-hyperlink-input"
						placeholder="https://example.com"
						[value]="url()"
						(input)="url.set(asValue($event))"
						(keydown.enter)="onEnter($event)"
					/>
				</label>

				<label class="pptx-ng-hyperlink-field">
					<span class="pptx-ng-hyperlink-label">Tooltip</span>
					<input
						type="text"
						class="pptx-ng-hyperlink-input"
						placeholder="Shown on hover (optional)"
						[value]="tooltip()"
						(input)="tooltip.set(asValue($event))"
						(keydown.enter)="onEnter($event)"
					/>
				</label>
			</div>

			<div footer>
				@if (hasLink()) {
					<button
						type="button"
						class="pptx-ng-hyperlink-btn pptx-ng-hyperlink-btn--ghost"
						(click)="clear()"
					>
						Remove link
					</button>
				}
				<button
					type="button"
					class="pptx-ng-hyperlink-btn pptx-ng-hyperlink-btn--secondary"
					(click)="onClose()"
				>
					Cancel
				</button>
				<button
					type="button"
					class="pptx-ng-hyperlink-btn pptx-ng-hyperlink-btn--primary"
					(click)="apply()"
				>
					Apply
				</button>
			</div>
		</pptx-modal-dialog>
	`,
	styles: [
		`
			.pptx-ng-hyperlink-form {
				display: flex;
				flex-direction: column;
				gap: 12px;
				min-width: 280px;
			}

			.pptx-ng-hyperlink-field {
				display: flex;
				flex-direction: column;
				gap: 4px;
			}

			.pptx-ng-hyperlink-label {
				font-size: 12px;
				font-weight: 500;
				color: var(--pptx-muted-foreground, #6b7280);
			}

			.pptx-ng-hyperlink-input {
				width: 100%;
				padding: 6px 10px;
				font-size: 13px;
				color: var(--pptx-foreground, #111827);
				background: var(--pptx-background, #ffffff);
				border: 1px solid var(--pptx-border, #e5e7eb);
				border-radius: 4px;
				outline: none;
			}

			.pptx-ng-hyperlink-input:focus {
				border-color: var(--pptx-primary, #2563eb);
				box-shadow: 0 0 0 1px var(--pptx-primary, #2563eb);
			}

			.pptx-ng-hyperlink-btn {
				padding: 6px 12px;
				font-size: 12px;
				border-radius: 4px;
				border: 1px solid transparent;
				cursor: pointer;
			}

			.pptx-ng-hyperlink-btn--primary {
				color: var(--pptx-primary-foreground, #ffffff);
				background: var(--pptx-primary, #2563eb);
			}

			.pptx-ng-hyperlink-btn--secondary {
				color: var(--pptx-foreground, #111827);
				background: transparent;
				border-color: var(--pptx-border, #e5e7eb);
			}

			.pptx-ng-hyperlink-btn--ghost {
				margin-right: auto;
				color: var(--pptx-destructive, #dc2626);
				background: transparent;
			}

			.pptx-ng-hyperlink-btn--secondary:hover,
			.pptx-ng-hyperlink-btn--ghost:hover {
				background: var(--pptx-muted, #f3f4f6);
			}
		`,
	],
})
export class HyperlinkDialogComponent {
	/** Whether the dialog is open. */
	readonly open = input<boolean>(false);

	/** The element whose hyperlink is being edited, or `null`. */
	readonly element = input<PptxElement | null>(null);

	/** Emitted when the user applies a change. Payload is a merge patch. */
	readonly save = output<Partial<PptxElement>>();

	/** Emitted when the dialog should close without saving. */
	readonly close = output<void>();

	readonly url = signal('');
	readonly tooltip = signal('');

	/** Whether the current element already has a hyperlink set. */
	readonly hasLink = computed(() => hasExistingLink(this.element()));

	constructor() {
		// Re-seed the form from the element each time the dialog opens (or the
		// target element changes while open).
		effect(() => {
			if (this.open()) {
				const draft = seedHyperlinkDraft(this.element());
				this.url.set(draft.url);
				this.tooltip.set(draft.tooltip);
			}
		});
	}

	asValue(event: Event): string {
		return (event.target as HTMLInputElement).value;
	}

	onEnter(event: Event): void {
		event.preventDefault();
		this.apply();
	}

	onClose(): void {
		this.close.emit();
	}

	apply(): void {
		const element = this.element();
		if (!element) {
			this.onClose();
			return;
		}
		const patch = buildHyperlinkPatch(element, { url: this.url(), tooltip: this.tooltip() });
		this.save.emit(patch);
		this.onClose();
	}

	clear(): void {
		this.url.set('');
		this.tooltip.set('');
		this.save.emit(buildClearHyperlinkPatch());
		this.onClose();
	}
}
