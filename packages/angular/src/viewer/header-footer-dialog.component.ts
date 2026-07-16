import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxHeaderFooter } from 'pptx-viewer-core';

@Component({
	selector: 'pptx-header-footer-dialog',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (open()) {
			<div class="backdrop" (mousedown)="closeFromBackdrop($event)">
				<section
					role="dialog"
					aria-modal="true"
					[attr.aria-label]="'pptx.headerFooter.title' | translate"
				>
					<header>
						<h2>{{ 'pptx.headerFooter.title' | translate }}</h2>
						<button
							type="button"
							(click)="close.emit()"
							[attr.aria-label]="'pptx.headerFooter.close' | translate"
						>
							×
						</button>
					</header>
					<div class="body">
						<label
							><input
								type="checkbox"
								[checked]="draft().hasDateTime ?? false"
								(change)="setFlag('hasDateTime', $event)"
							/>{{ 'pptx.headerFooter.dateAndTime' | translate }}</label
						>
						@if (draft().hasDateTime) {
							<div class="nested">
								<label
									><input
										type="checkbox"
										[checked]="draft().dateTimeAuto ?? false"
										(change)="setFlag('dateTimeAuto', $event)"
									/>{{ 'pptx.headerFooter.updateAutomatically' | translate }}</label
								>
								@if (!draft().dateTimeAuto) {
									<input
										type="text"
										[value]="draft().dateTimeText ?? ''"
										[placeholder]="'pptx.headerFooter.fixedDate' | translate"
										(input)="setText('dateTimeText', $event)"
									/>
								}
							</div>
						}
						<label
							><input
								type="checkbox"
								[checked]="draft().hasSlideNumber ?? false"
								(change)="setFlag('hasSlideNumber', $event)"
							/>{{ 'pptx.headerFooter.slideNumber' | translate }}</label
						>
						<label
							><input
								type="checkbox"
								[checked]="draft().hasHeader ?? false"
								(change)="setFlag('hasHeader', $event)"
							/>{{ 'pptx.field.header' | translate }}</label
						>
						@if (draft().hasHeader) {
							<input
								class="nested"
								type="text"
								[value]="draft().headerText ?? ''"
								[placeholder]="'pptx.headerFooter.headerText' | translate"
								(input)="setText('headerText', $event)"
							/>
						}
						<label
							><input
								type="checkbox"
								[checked]="draft().hasFooter ?? false"
								(change)="setFlag('hasFooter', $event)"
							/>{{ 'pptx.headerFooter.footer' | translate }}</label
						>
						@if (draft().hasFooter) {
							<input
								class="nested"
								type="text"
								[value]="draft().footerText ?? ''"
								[placeholder]="'pptx.headerFooter.footerPlaceholder' | translate"
								(input)="setText('footerText', $event)"
							/>
						}
					</div>
					<footer>
						<button type="button" (click)="apply()">
							{{ 'pptx.headerFooter.applyToAll' | translate }}
						</button>
						<button type="button" class="primary" (click)="apply()">
							{{ 'pptx.headerFooter.applyToCurrent' | translate }}
						</button>
					</footer>
				</section>
			</div>
		}
	`,
	styles: `
		.backdrop {
			position: fixed;
			inset: 0;
			z-index: 9999;
			display: grid;
			place-items: center;
			padding: 16px;
			background: #0007;
		}
		section {
			width: min(390px, 100%);
			overflow: hidden;
			border: 1px solid var(--pptx-border, #444);
			border-radius: 8px;
			background: var(--pptx-bg, #202020);
			color: var(--pptx-fg, #eee);
			box-shadow: 0 20px 50px #0008;
		}
		header,
		footer {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 8px;
			padding: 12px 16px;
			border-bottom: 1px solid var(--pptx-border, #444);
		}
		header h2 {
			margin: 0;
			font-size: 14px;
		}
		header button {
			border: 0;
			background: transparent;
			color: inherit;
			font-size: 18px;
			cursor: pointer;
		}
		.body {
			display: grid;
			gap: 12px;
			padding: 16px;
		}
		label {
			display: flex;
			align-items: center;
			gap: 9px;
			font-size: 12px;
		}
		input[type='checkbox'] {
			accent-color: var(--pptx-primary, #2563eb);
		}
		input[type='text'] {
			box-sizing: border-box;
			width: 100%;
			padding: 7px 9px;
			border: 1px solid var(--pptx-border, #444);
			border-radius: 4px;
			background: var(--pptx-input-bg, #2d2d2d);
			color: inherit;
		}
		.nested {
			margin-left: 24px;
			width: calc(100% - 24px);
		}
		div.nested {
			display: grid;
			gap: 8px;
		}
		footer {
			justify-content: flex-end;
			border-top: 1px solid var(--pptx-border, #444);
			border-bottom: 0;
		}
		footer button {
			padding: 6px 10px;
			border: 1px solid var(--pptx-border, #444);
			border-radius: 4px;
			background: var(--pptx-input-bg, #2d2d2d);
			color: inherit;
			cursor: pointer;
		}
		footer .primary {
			border-color: var(--pptx-primary, #2563eb);
			background: var(--pptx-primary, #2563eb);
			color: #fff;
		}
	`,
})
export class HeaderFooterDialogComponent {
	readonly open = input<boolean>(false);
	readonly value = input<PptxHeaderFooter>({});
	readonly save = output<PptxHeaderFooter>();
	readonly close = output<void>();
	protected readonly draft = signal<PptxHeaderFooter>({});

	constructor() {
		effect(() => {
			if (this.open()) {
				this.draft.set(structuredClone(this.value()));
			}
		});
	}

	protected setFlag(key: keyof PptxHeaderFooter, event: Event): void {
		this.draft.update((value) => ({
			...value,
			[key]: (event.target as HTMLInputElement).checked,
		}));
	}

	protected setText(key: keyof PptxHeaderFooter, event: Event): void {
		this.draft.update((value) => ({
			...value,
			[key]: (event.target as HTMLInputElement).value,
		}));
	}

	protected apply(): void {
		this.save.emit(structuredClone(this.draft()));
		this.close.emit();
	}

	protected closeFromBackdrop(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			this.close.emit();
		}
	}
}
