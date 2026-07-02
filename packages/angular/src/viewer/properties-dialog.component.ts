/**
 * properties-dialog.component.ts: View and edit document core metadata.
 *
 * Selector: `pptx-properties-dialog`
 *
 * Angular port of the Vue `PropertiesDialog.vue`. Editable: title, author
 * (`creator`), subject, keywords. Read-only: `created` / `modified`
 * timestamps. Edits are held in a local draft and committed only via `save`,
 * which carries a `Partial<PptxCoreProperties>` of the changed fields.
 *
 * Composes {@link ModalDialogComponent}. Pure read / format / diff logic lives
 * in `./properties-dialog-helpers`.
 */

import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxCoreProperties } from 'pptx-viewer-core';

import { ModalDialogComponent } from './modal-dialog.component';
import {
	buildPropertiesPatch,
	formatPropertyDate,
	seedPropertiesDraft,
} from './properties-dialog-helpers';
import type { DocumentProperties } from './properties-dialog-helpers';

@Component({
	selector: 'pptx-properties-dialog',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ModalDialogComponent, TranslatePipe],
	template: `
		<pptx-modal-dialog
			[open]="open()"
			[title]="'pptx.documentProperties.dialogTitle' | translate"
			(close)="close.emit()"
		>
			<div class="pptx-ng-props-form">
				<div class="pptx-ng-props-field">
					<label for="pptx-ng-props-title" class="pptx-ng-props-label">{{
						'pptx.documentProperties.summary.title' | translate
					}}</label>
					<input
						id="pptx-ng-props-title"
						type="text"
						class="pptx-ng-props-input"
						[value]="title()"
						(input)="title.set(asValue($event))"
					/>
				</div>

				<div class="pptx-ng-props-field">
					<label for="pptx-ng-props-creator" class="pptx-ng-props-label">{{
						'pptx.documentProperties.summary.author' | translate
					}}</label>
					<input
						id="pptx-ng-props-creator"
						type="text"
						class="pptx-ng-props-input"
						[value]="creator()"
						(input)="creator.set(asValue($event))"
					/>
				</div>

				<div class="pptx-ng-props-field">
					<label for="pptx-ng-props-subject" class="pptx-ng-props-label">{{
						'pptx.documentProperties.summary.subject' | translate
					}}</label>
					<input
						id="pptx-ng-props-subject"
						type="text"
						class="pptx-ng-props-input"
						[value]="subject()"
						(input)="subject.set(asValue($event))"
					/>
				</div>

				<div class="pptx-ng-props-field">
					<label for="pptx-ng-props-keywords" class="pptx-ng-props-label">{{
						'pptx.documentProperties.summary.keywords' | translate
					}}</label>
					<input
						id="pptx-ng-props-keywords"
						type="text"
						class="pptx-ng-props-input"
						[value]="keywords()"
						(input)="keywords.set(asValue($event))"
					/>
				</div>

				<div class="pptx-ng-props-meta">
					<div class="pptx-ng-props-meta-row">
						<span class="pptx-ng-props-meta-label">{{
							'pptx.documentProperties.created' | translate
						}}</span>
						<span class="pptx-ng-props-meta-value">{{ createdDisplay() }}</span>
					</div>
					<div class="pptx-ng-props-meta-row">
						<span class="pptx-ng-props-meta-label">{{
							'pptx.documentProperties.modified' | translate
						}}</span>
						<span class="pptx-ng-props-meta-value">{{ modifiedDisplay() }}</span>
					</div>
				</div>
			</div>

			<div footer>
				<button type="button" class="pptx-ng-props-btn" (click)="close.emit()">
					{{ 'pptx.common.cancel' | translate }}
				</button>
				<button
					type="button"
					class="pptx-ng-props-btn pptx-ng-props-btn-primary"
					(click)="handleSave()"
				>
					{{ 'pptx.common.save' | translate }}
				</button>
			</div>
		</pptx-modal-dialog>
	`,
	styles: [
		`
			.pptx-ng-props-form {
				display: flex;
				flex-direction: column;
				gap: 0.75rem;
			}

			.pptx-ng-props-field {
				display: flex;
				flex-direction: column;
				gap: 0.375rem;
			}

			.pptx-ng-props-label {
				font-size: 0.75rem;
				font-weight: 500;
				color: var(--pptx-foreground, #e5e5e5);
			}

			.pptx-ng-props-input {
				width: 100%;
				padding: 0.375rem 0.75rem;
				border-radius: 0.375rem;
				border: 1px solid var(--pptx-border, #2a2a2a);
				background: var(--pptx-background, #111);
				color: var(--pptx-foreground, #e5e5e5);
				font-size: 0.8125rem;
			}

			.pptx-ng-props-input:focus {
				outline: none;
				border-color: var(--pptx-primary, #6366f1);
				box-shadow: 0 0 0 1px var(--pptx-primary, #6366f1);
			}

			.pptx-ng-props-meta {
				display: flex;
				flex-direction: column;
				gap: 0.375rem;
				padding-top: 0.5rem;
				border-top: 1px solid var(--pptx-border, #2a2a2a);
			}

			.pptx-ng-props-meta-row {
				display: flex;
				justify-content: space-between;
				font-size: 0.75rem;
			}

			.pptx-ng-props-meta-label {
				color: var(--pptx-muted-foreground, #9a9a9a);
			}

			.pptx-ng-props-meta-value {
				color: var(--pptx-foreground, #e5e5e5);
			}

			.pptx-ng-props-btn {
				padding: 0.375rem 0.75rem;
				border: none;
				border-radius: 0.375rem;
				background: var(--pptx-muted, #2a2a2a);
				color: var(--pptx-foreground, #e5e5e5);
				font-size: 0.75rem;
				cursor: pointer;
			}

			.pptx-ng-props-btn-primary {
				background: var(--pptx-primary, #6366f1);
				color: var(--pptx-primary-foreground, #fff);
			}
		`,
	],
})
export class PropertiesDialogComponent {
	/** Whether the dialog is visible. */
	readonly open = input<boolean>(false);

	/** Current document metadata. */
	readonly properties = input.required<DocumentProperties>();

	/** Fired with the edited (changed-only) fields when the user saves. */
	readonly save = output<Partial<PptxCoreProperties>>();

	/** Fired when the dialog is dismissed. */
	readonly close = output<void>();

	// Editable draft fields.
	readonly title = signal('');
	readonly creator = signal('');
	readonly subject = signal('');
	readonly keywords = signal('');

	constructor() {
		// Re-seed the draft whenever the dialog (re)opens or the source changes.
		effect(() => {
			if (this.open()) {
				const draft = seedPropertiesDraft(this.properties());
				this.title.set(draft.title);
				this.creator.set(draft.creator);
				this.subject.set(draft.subject);
				this.keywords.set(draft.keywords);
			}
		});
	}

	createdDisplay(): string {
		return formatPropertyDate(this.properties().created);
	}

	modifiedDisplay(): string {
		return formatPropertyDate(this.properties().modified);
	}

	asValue(event: Event): string {
		return (event.target as HTMLInputElement).value;
	}

	handleSave(): void {
		const patch = buildPropertiesPatch(this.properties(), {
			title: this.title(),
			creator: this.creator(),
			subject: this.subject(),
			keywords: this.keywords(),
		});
		this.save.emit(patch);
	}
}
