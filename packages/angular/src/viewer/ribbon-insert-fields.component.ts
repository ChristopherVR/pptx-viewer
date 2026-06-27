/**
 * ribbon-insert-fields.component.ts: the Insert tab's "Action" and "Field"
 * controls, split out of {@link RibbonComponent} to keep that file small.
 *
 * Mirrors React's `toolbar/InsertSection.tsx` Action-button + Insert-Field
 * dropdowns and Vue's `ribbon/InsertSection.vue`:
 *   - Action: hover-reveal gallery of the 12 OOXML built-in action buttons
 *     (`ACTION_BUTTON_PRESETS`); each inserts a labelled nav button built by the
 *     shared `buildActionButtonElement` factory.
 *   - Field: Slide Number / Date & Time / Header / Footer field runs. Date &
 *     Time opens a small format picker modal (mirrors the React/Vue modal).
 *
 * The component injects the same root {@link EditorStateService} as the ribbon
 * and inserts directly via `addElement`, so no extra outputs are threaded
 * through the parent (matching the ribbon's existing inline insert handlers).
 */
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import type { PptxElement, TextStyle } from 'pptx-viewer-core';

import { ACTION_BUTTON_PRESETS, buildActionButtonElement } from '../internal/shared';
import { EditorStateService } from './editor-state.service';

/** Default display text per field type when no explicit value is supplied. */
function defaultFieldText(fieldType: string, slideNumber: number): string {
	switch (fieldType) {
		case 'slidenum':
			return String(slideNumber);
		case 'datetime':
			return new Date().toLocaleDateString();
		case 'header':
			return 'Header';
		case 'footer':
			return 'Footer';
		default:
			return fieldType;
	}
}

/** Generate an OOXML field GUID (`{UPPER-CASE-UUID}`), with a non-crypto fallback. */
function newFieldGuid(): string {
	const uuid =
		typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
			? crypto.randomUUID()
			: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/gu, (c) => {
					const r = (Math.random() * 16) | 0;
					const v = c === 'x' ? r : (r & 0x3) | 0x8;
					return v.toString(16);
				});
	return `{${uuid.toUpperCase()}}`;
}

@Component({
	selector: 'pptx-ribbon-insert-fields',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<!-- Action Buttons dropdown (hover-reveal, mirrors React/Vue) -->
		<div class="group relative">
			<button type="button" class="pptx-rb-pill" title="Insert action button">
				<svg
					class="h-3.5 w-3.5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<rect x="3" y="3" width="18" height="18" rx="2" />
					<path d="M13 7l4 5-4 5" />
				</svg>
				Action ▾
			</button>
			<div class="absolute left-0 top-full z-50 hidden w-44 pt-1 group-hover:block">
				<div class="rounded-lg border border-border bg-card py-1 shadow-2xl">
					@for (preset of actionPresets; track preset.shapeType) {
						<button
							type="button"
							class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
							[title]="preset.label"
							(click)="addActionButton(preset.shapeType)"
						>
							<svg
								class="h-4 w-4 flex-shrink-0"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path [attr.d]="preset.iconPath" />
							</svg>
							{{ preset.label }}
						</button>
					}
				</div>
			</div>
		</div>

		<!-- Insert Field dropdown -->
		<div class="group relative">
			<button type="button" class="pptx-rb-pill" title="Insert field">
				<svg
					class="h-3.5 w-3.5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M4 7h16M4 12h10M4 17h12" />
					<circle cx="19" cy="15" r="3" />
				</svg>
				Field ▾
			</button>
			<div class="absolute left-0 top-full z-50 hidden w-44 pt-1 group-hover:block">
				<div class="rounded-lg border border-border bg-card py-1 shadow-2xl">
					<button
						type="button"
						class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
						(click)="insertField('slidenum')"
					>
						Slide Number
					</button>
					<button
						type="button"
						class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
						(click)="openDatePicker()"
					>
						Date &amp; Time
					</button>
					<button
						type="button"
						class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
						(click)="insertField('header')"
					>
						Header
					</button>
					<button
						type="button"
						class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
						(click)="insertField('footer')"
					>
						Footer
					</button>
				</div>
			</div>
		</div>

		<!-- Date/Time picker modal -->
		@if (datePickerOpen()) {
			<div
				class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30"
				(mousedown)="onBackdropMouseDown($event)"
			>
				<div class="w-72 space-y-3 rounded-lg border border-border bg-card p-4 shadow-2xl">
					<div class="text-sm font-medium text-foreground">Date &amp; Time</div>
					<input
						type="datetime-local"
						class="w-full rounded border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
						[value]="datePickerValue()"
						(input)="datePickerValue.set($any($event.target).value)"
					/>
					<div>
						<label class="mb-1 block text-[11px] text-muted-foreground">Format</label>
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
							Cancel
						</button>
						<button
							type="button"
							class="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
							(click)="confirmDatePicker()"
						>
							Insert
						</button>
					</div>
				</div>
			</div>
		}
	`,
})
export class RibbonInsertFieldsComponent {
	private readonly editor = inject(EditorStateService);

	/** Active slide index the inserted element is appended to. */
	readonly slideIndex = input<number>(0);

	protected readonly actionPresets = ACTION_BUTTON_PRESETS;

	// ── Date/Time picker state (mirrors React/Vue local state) ────────────────
	protected readonly datePickerOpen = signal(false);
	protected readonly datePickerValue = signal('');
	protected readonly dateFormat = signal('locale');

	/** Insert an OOXML action button (Insert ▸ Action), positioned like React. */
	protected addActionButton(shapeType: string): void {
		const built = buildActionButtonElement(shapeType, '');
		if (!built) {
			return;
		}
		this.editor.addElement(this.slideIndex(), { ...built, x: 150, y: 150 } as PptxElement);
	}

	/** Insert a field run (slide number / date-time / header / footer). */
	protected insertField(fieldType: string, value?: string): void {
		const displayText = value || defaultFieldText(fieldType, this.slideIndex() + 1);
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

	protected openDatePicker(): void {
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
