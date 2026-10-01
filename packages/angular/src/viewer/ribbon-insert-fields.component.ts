/**
 * ribbon-insert-fields.component.ts: the native half of the Insert tab's Action and
 * Field controls. The shared `pptx-ui-ribbon-insert` renders the Action and Field
 * menus; this component keeps what must stay native to the Angular binding: building
 * and inserting the action-button / field elements through the root
 * {@link EditorStateService}, and the Date/Time format picker modal.
 *
 * {@link RibbonInsertSectionComponent} calls `addActionButton`, `insertField` and
 * `openDatePicker` when the shared element emits the matching intent.
 */
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { PptxElement, TextStyle } from 'pptx-viewer-core';

import { buildActionButtonElement, secureRandomUuid } from '../internal/shared';
import { EditorStateService } from './editor-state.service';

/** Default display text per field type when no explicit value is supplied. */
function defaultFieldText(
	fieldType: string,
	slideNumber: number,
	translate: (key: string) => string,
): string {
	switch (fieldType) {
		case 'slidenum':
			return String(slideNumber);
		case 'datetime':
			return new Date().toLocaleDateString();
		case 'header':
			return translate('pptx.field.header');
		case 'footer':
			return translate('pptx.field.footer');
		default:
			return fieldType;
	}
}

/**
 * Generate an OOXML field GUID (`{UPPER-CASE-UUID}`). Delegates to the shared
 * `secureRandomUuid` helper, which prefers `crypto.randomUUID()` and falls
 * back to a `crypto.getRandomValues`-backed UUID (never `Math.random()`).
 */
function newFieldGuid(): string {
	return `{${secureRandomUuid().toUpperCase()}}`;
}

@Component({
	selector: 'pptx-ribbon-insert-fields',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [TranslatePipe],
	template: `
		<!-- Date/Time picker modal -->
		@if (datePickerOpen()) {
			<div
				class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30"
				(mousedown)="onBackdropMouseDown($event)"
			>
				<div class="w-72 space-y-3 rounded-lg border border-border bg-card p-4 shadow-2xl">
					<div class="text-sm font-medium text-foreground">
						{{ 'pptx.headerFooter.dateAndTime' | translate }}
					</div>
					<input
						type="datetime-local"
						class="w-full rounded border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
						[value]="datePickerValue()"
						(input)="datePickerValue.set($any($event.target).value)"
					/>
					<div>
						<label class="mb-1 block text-[11px] text-muted-foreground">{{
							'pptx.field.format' | translate
						}}</label>
						<select
							class="w-full rounded border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
							[value]="dateFormat()"
							(change)="dateFormat.set($any($event.target).value)"
						>
							<option value="locale">{{ previewLocale() }}</option>
							<option value="long">{{ previewLong() }}</option>
							<option value="short">{{ previewShort() }}</option>
							<option value="iso">{{ previewIso() }}</option>
							<option value="time">{{ previewTime() }}</option>
						</select>
					</div>
					<div class="flex justify-end gap-2 pt-1">
						<button
							type="button"
							class="rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
							(click)="datePickerOpen.set(false)"
						>
							{{ 'pptx.common.cancel' | translate }}
						</button>
						<button
							type="button"
							class="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
							(click)="confirmDatePicker()"
						>
							{{ 'pptx.common.insert' | translate }}
						</button>
					</div>
				</div>
			</div>
		}
	`,
})
export class RibbonInsertFieldsComponent {
	private readonly editor = inject(EditorStateService);
	private readonly translate = inject(TranslateService);

	/** Active slide index the inserted element is appended to. */
	readonly slideIndex = input<number>(0);

	// ── Date/Time picker state (mirrors React/Vue local state) ────────────────
	protected readonly datePickerOpen = signal(false);
	protected readonly datePickerValue = signal('');
	protected readonly dateFormat = signal('locale');

	/** Insert an OOXML action button (Insert ▸ Action), positioned like React. */
	addActionButton(shapeType: string): void {
		const built = buildActionButtonElement(shapeType, '');
		if (!built) {
			return;
		}
		this.editor.addElement(this.slideIndex(), { ...built, x: 150, y: 150 } as PptxElement);
	}

	/** Insert a field run (slide number / date-time / header / footer). */
	insertField(fieldType: string, value?: string): void {
		const displayText =
			value ||
			defaultFieldText(fieldType, this.slideIndex() + 1, (key) => this.translate.instant(key));
		const fieldGuid = newFieldGuid();
		const element: PptxElement = {
			type: 'shape',
			id: '',
			x: 120,
			y: 200,
			width: 200,
			height: 40,
			text: displayText,
			textStyle: { fontSize: 14 } as TextStyle,
			textSegments: [
				{ text: displayText, style: { fontSize: 14 } as TextStyle, fieldType, fieldGuid },
			],
		} as PptxElement;
		this.editor.addElement(this.slideIndex(), element);
	}

	openDatePicker(): void {
		const now = new Date();
		const pad = (n: number): string => String(n).padStart(2, '0');
		this.datePickerValue.set(
			`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`,
		);
		this.dateFormat.set('locale');
		this.datePickerOpen.set(true);
	}

	protected confirmDatePicker(): void {
		const d = new Date(this.datePickerValue());
		if (isNaN(d.getTime())) {
			return;
		}
		let formatted: string;
		switch (this.dateFormat()) {
			case 'iso':
				formatted = d.toISOString().slice(0, 10);
				break;
			case 'long':
				formatted = d.toLocaleDateString(undefined, {
					weekday: 'long',
					year: 'numeric',
					month: 'long',
					day: 'numeric',
				});
				break;
			case 'short':
				formatted = d.toLocaleDateString(undefined, {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
				});
				break;
			case 'time':
				formatted = d.toLocaleString();
				break;
			default:
				formatted = d.toLocaleDateString();
				break;
		}
		this.insertField('datetime', formatted);
		this.datePickerOpen.set(false);
	}

	protected onBackdropMouseDown(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			this.datePickerOpen.set(false);
		}
	}

	// ── Format preview strings for the <select> options ───────────────────────
	private previewDate(): Date {
		return new Date(this.datePickerValue() || Date.now());
	}
	protected previewLocale(): string {
		return this.previewDate().toLocaleDateString();
	}
	protected previewLong(): string {
		return this.previewDate().toLocaleDateString(undefined, {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
	}
	protected previewShort(): string {
		return this.previewDate().toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	}
	protected previewIso(): string {
		return this.previewDate().toISOString().slice(0, 10);
	}
	protected previewTime(): string {
		return this.previewDate().toLocaleString();
	}
}
