/**
 * inspector-panel.component.ts — Editor inspector panel for the PPTX viewer.
 *
 * Selector: `pptx-inspector-panel`
 *
 * Renders a compact property panel for the single selected element.
 * All value-extraction and patch-building is delegated to inspector-helpers.ts.
 *
 * Usage:
 * ```html
 * <pptx-inspector-panel
 *   [element]="selectedElement"
 *   [slideIndex]="activeSlideIndex()"
 * />
 * ```
 */

import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';

import { EditorStateService } from './editor-state.service';
import {
	fillColorOf,
	fontSizeOf,
	isBold,
	isItalic,
	isUnderline,
	shapeStylePatch,
	strokeColorOf,
	textColorOf,
	textStylePatch,
} from './inspector-helpers';

@Component({
	selector: 'pptx-inspector-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<aside class="pptx-ng-inspector" aria-label="Element properties">
			<!-- ── Transform: Position & Size ─────────────────────────────────── -->
			<section class="pptx-ng-inspector__section">
				<h3 class="pptx-ng-inspector__heading">Transform</h3>

				<div class="pptx-ng-inspector__row">
					<label class="pptx-ng-inspector__label" for="insp-x">X</label>
					<input
						id="insp-x"
						class="pptx-ng-inspector__input pptx-ng-inspector__input--number"
						type="number"
						[value]="el().x"
						(change)="onPositionChange($event, 'x')"
					/>
					<label class="pptx-ng-inspector__label" for="insp-y">Y</label>
					<input
						id="insp-y"
						class="pptx-ng-inspector__input pptx-ng-inspector__input--number"
						type="number"
						[value]="el().y"
						(change)="onPositionChange($event, 'y')"
					/>
				</div>

				<div class="pptx-ng-inspector__row">
					<label class="pptx-ng-inspector__label" for="insp-w">W</label>
					<input
						id="insp-w"
						class="pptx-ng-inspector__input pptx-ng-inspector__input--number"
						type="number"
						min="1"
						[value]="el().width"
						(change)="onSizeChange($event, 'width')"
					/>
					<label class="pptx-ng-inspector__label" for="insp-h">H</label>
					<input
						id="insp-h"
						class="pptx-ng-inspector__input pptx-ng-inspector__input--number"
						type="number"
						min="1"
						[value]="el().height"
						(change)="onSizeChange($event, 'height')"
					/>
				</div>

				<div class="pptx-ng-inspector__row">
					<label class="pptx-ng-inspector__label" for="insp-rot">Rot°</label>
					<input
						id="insp-rot"
						class="pptx-ng-inspector__input pptx-ng-inspector__input--number"
						type="number"
						[value]="el().rotation ?? 0"
						(change)="onRotationChange($event)"
					/>
					<label class="pptx-ng-inspector__label" for="insp-opacity">Opacity</label>
					<input
						id="insp-opacity"
						class="pptx-ng-inspector__input pptx-ng-inspector__input--number"
						type="number"
						min="0"
						max="1"
						step="0.01"
						[value]="el().opacity ?? 1"
						(change)="onOpacityChange($event)"
					/>
				</div>
			</section>

			<!-- ── Shape fill & stroke (shape-style elements only) ────────────── -->
			@if (hasShape()) {
				<section class="pptx-ng-inspector__section">
					<h3 class="pptx-ng-inspector__heading">Fill &amp; Stroke</h3>

					<div class="pptx-ng-inspector__row">
						<label class="pptx-ng-inspector__label" for="insp-fill">Fill</label>
						<input
							id="insp-fill"
							class="pptx-ng-inspector__color"
							type="color"
							[value]="currentFillColor()"
							(change)="onFillColorChange($event)"
						/>
						<label class="pptx-ng-inspector__label" for="insp-stroke">Stroke</label>
						<input
							id="insp-stroke"
							class="pptx-ng-inspector__color"
							type="color"
							[value]="currentStrokeColor()"
							(change)="onStrokeColorChange($event)"
						/>
					</div>
				</section>
			}

			<!-- ── Text style (text-bearing elements only) ─────────────────────── -->
			@if (hasText()) {
				<section class="pptx-ng-inspector__section">
					<h3 class="pptx-ng-inspector__heading">Text</h3>

					<div class="pptx-ng-inspector__row">
						<label class="pptx-ng-inspector__label" for="insp-text-color">Color</label>
						<input
							id="insp-text-color"
							class="pptx-ng-inspector__color"
							type="color"
							[value]="currentTextColor()"
							(change)="onTextColorChange($event)"
						/>
						<label class="pptx-ng-inspector__label" for="insp-font-size">Size</label>
						<input
							id="insp-font-size"
							class="pptx-ng-inspector__input pptx-ng-inspector__input--number"
							type="number"
							min="1"
							[value]="currentFontSize()"
							(change)="onFontSizeChange($event)"
						/>
					</div>

					<div class="pptx-ng-inspector__row pptx-ng-inspector__row--toggles">
						<button
							type="button"
							class="pptx-ng-inspector__toggle"
							[class.is-active]="currentBold()"
							aria-label="Bold"
							(click)="onBoldToggle()"
						>
							<strong>B</strong>
						</button>
						<button
							type="button"
							class="pptx-ng-inspector__toggle"
							[class.is-active]="currentItalic()"
							aria-label="Italic"
							(click)="onItalicToggle()"
						>
							<em>I</em>
						</button>
						<button
							type="button"
							class="pptx-ng-inspector__toggle"
							[class.is-active]="currentUnderline()"
							aria-label="Underline"
							(click)="onUnderlineToggle()"
						>
							<span style="text-decoration:underline">U</span>
						</button>
					</div>
				</section>
			}

			<!-- ── Arrange ────────────────────────────────────────────────────── -->
			<section class="pptx-ng-inspector__section">
				<h3 class="pptx-ng-inspector__heading">Arrange</h3>

				<div class="pptx-ng-inspector__row">
					<button
						type="button"
						class="pptx-ng-inspector__btn"
						title="Bring to Front"
						(click)="editor.bringSelectedToFront(slideIndex())"
					>
						Front
					</button>
					<button
						type="button"
						class="pptx-ng-inspector__btn"
						title="Send to Back"
						(click)="editor.sendSelectedToBack(slideIndex())"
					>
						Back
					</button>
					<button
						type="button"
						class="pptx-ng-inspector__btn"
						title="Bring Forward"
						(click)="editor.bringSelectedForward(slideIndex())"
					>
						↑
					</button>
					<button
						type="button"
						class="pptx-ng-inspector__btn"
						title="Send Backward"
						(click)="editor.sendSelectedBackward(slideIndex())"
					>
						↓
					</button>
				</div>
			</section>

			<!-- ── Element actions ────────────────────────────────────────────── -->
			<section class="pptx-ng-inspector__section">
				<div class="pptx-ng-inspector__row">
					<button
						type="button"
						class="pptx-ng-inspector__btn"
						(click)="editor.duplicateSelected(slideIndex())"
					>
						Duplicate
					</button>
					<button
						type="button"
						class="pptx-ng-inspector__btn pptx-ng-inspector__btn--danger"
						(click)="editor.deleteSelected(slideIndex())"
					>
						Delete
					</button>
				</div>
			</section>
		</aside>
	`,
	styles: `
		.pptx-ng-inspector {
			display: flex;
			flex-direction: column;
			gap: 0;
			padding: 0.5rem;
			background: var(--pptx-inspector-bg, #1e1e1e);
			color: var(--pptx-inspector-fg, #e0e0e0);
			font-size: 12px;
			min-width: 220px;
			overflow-y: auto;
		}

		.pptx-ng-inspector__section {
			padding: 0.5rem 0;
			border-bottom: 1px solid var(--pptx-inspector-border, #333);
		}

		.pptx-ng-inspector__section:last-child {
			border-bottom: none;
		}

		.pptx-ng-inspector__heading {
			font-size: 10px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--pptx-inspector-muted, #888);
			margin: 0 0 0.35rem 0;
		}

		.pptx-ng-inspector__row {
			display: flex;
			align-items: center;
			gap: 0.35rem;
			margin-bottom: 0.35rem;
		}

		.pptx-ng-inspector__row:last-child {
			margin-bottom: 0;
		}

		.pptx-ng-inspector__row--toggles {
			gap: 0.25rem;
		}

		.pptx-ng-inspector__label {
			font-size: 10px;
			color: var(--pptx-inspector-muted, #888);
			min-width: 32px;
			text-align: right;
			flex-shrink: 0;
		}

		.pptx-ng-inspector__input {
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			padding: 2px 4px;
			font-size: 12px;
		}

		.pptx-ng-inspector__input--number {
			width: 62px;
			text-align: right;
		}

		.pptx-ng-inspector__color {
			width: 32px;
			height: 22px;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			padding: 1px;
			cursor: pointer;
			background: transparent;
			flex-shrink: 0;
		}

		.pptx-ng-inspector__toggle {
			width: 26px;
			height: 22px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 12px;
		}

		.pptx-ng-inspector__toggle.is-active {
			background: var(--pptx-inspector-active, #0078d4);
			border-color: var(--pptx-inspector-active, #0078d4);
			color: #fff;
		}

		.pptx-ng-inspector__btn {
			flex: 1;
			padding: 3px 6px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			cursor: pointer;
			font-size: 11px;
			white-space: nowrap;
		}

		.pptx-ng-inspector__btn:hover {
			background: var(--pptx-inspector-hover, #3a3a3a);
		}

		.pptx-ng-inspector__btn--danger {
			color: var(--pptx-inspector-danger, #f47c7c);
			border-color: var(--pptx-inspector-danger-border, #6b2a2a);
		}

		.pptx-ng-inspector__btn--danger:hover {
			background: var(--pptx-inspector-danger-hover, #4a1a1a);
		}
	`,
})
export class InspectorPanelComponent {
	/** The single selected element whose properties are being edited. */
	readonly element = input.required<PptxElement>();
	/** Zero-based index of the active slide. */
	readonly slideIndex = input.required<number>();

	protected readonly editor = inject(EditorStateService);

	/** Alias so the template can call el() without conflicting with Angular internals. */
	protected readonly el = computed(() => this.element());

	/** Whether the element supports shape-style (fill/stroke) editing. */
	protected readonly hasShape = computed(() => hasShapeProperties(this.el()));

	/** Whether the element supports text-style editing. */
	protected readonly hasText = computed(() => hasTextProperties(this.el()));

	// ── Computed display values ──────────────────────────────────────────────

	protected readonly currentFillColor = computed(() => fillColorOf(this.el()));
	protected readonly currentStrokeColor = computed(() => strokeColorOf(this.el()));
	protected readonly currentTextColor = computed(() => textColorOf(this.el()));
	protected readonly currentFontSize = computed(() => fontSizeOf(this.el()));
	protected readonly currentBold = computed(() => isBold(this.el()));
	protected readonly currentItalic = computed(() => isItalic(this.el()));
	protected readonly currentUnderline = computed(() => isUnderline(this.el()));

	// ── Position & size ──────────────────────────────────────────────────────

	protected onPositionChange(event: Event, axis: 'x' | 'y'): void {
		const val = numberFromEvent(event);
		if (val === null) {
			return;
		}
		const cur = this.el();
		const x = axis === 'x' ? val : cur.x;
		const y = axis === 'y' ? val : cur.y;
		this.editor.setPosition(this.slideIndex(), cur.id, x, y);
	}

	protected onSizeChange(event: Event, dim: 'width' | 'height'): void {
		const val = numberFromEvent(event);
		if (val === null || val < 1) {
			return;
		}
		const cur = this.el();
		const width = dim === 'width' ? val : cur.width;
		const height = dim === 'height' ? val : cur.height;
		this.editor.resize(this.slideIndex(), cur.id, width, height);
	}

	// ── Rotation & opacity ───────────────────────────────────────────────────

	protected onRotationChange(event: Event): void {
		const val = numberFromEvent(event);
		if (val === null) {
			return;
		}
		const cur = this.el();
		this.editor.updateElement(this.slideIndex(), cur.id, { rotation: val } as Partial<PptxElement>);
	}

	protected onOpacityChange(event: Event): void {
		const val = numberFromEvent(event);
		if (val === null) {
			return;
		}
		const clamped = Math.min(1, Math.max(0, val));
		const cur = this.el();
		this.editor.updateElement(this.slideIndex(), cur.id, {
			opacity: clamped,
		} as Partial<PptxElement>);
	}

	// ── Fill & stroke ────────────────────────────────────────────────────────

	protected onFillColorChange(event: Event): void {
		const color = stringFromEvent(event);
		if (!color) {
			return;
		}
		const cur = this.el();
		this.editor.updateElement(
			this.slideIndex(),
			cur.id,
			shapeStylePatch(cur, { fillColor: color }),
		);
	}

	protected onStrokeColorChange(event: Event): void {
		const color = stringFromEvent(event);
		if (!color) {
			return;
		}
		const cur = this.el();
		this.editor.updateElement(
			this.slideIndex(),
			cur.id,
			shapeStylePatch(cur, { strokeColor: color }),
		);
	}

	// ── Text style ───────────────────────────────────────────────────────────

	protected onTextColorChange(event: Event): void {
		const color = stringFromEvent(event);
		if (!color) {
			return;
		}
		const cur = this.el();
		this.editor.updateElement(this.slideIndex(), cur.id, textStylePatch(cur, { color }));
	}

	protected onFontSizeChange(event: Event): void {
		const val = numberFromEvent(event);
		if (val === null || val < 1) {
			return;
		}
		const cur = this.el();
		this.editor.updateElement(this.slideIndex(), cur.id, textStylePatch(cur, { fontSize: val }));
	}

	protected onBoldToggle(): void {
		const cur = this.el();
		this.editor.updateElement(
			this.slideIndex(),
			cur.id,
			textStylePatch(cur, { bold: !this.currentBold() }),
		);
	}

	protected onItalicToggle(): void {
		const cur = this.el();
		this.editor.updateElement(
			this.slideIndex(),
			cur.id,
			textStylePatch(cur, { italic: !this.currentItalic() }),
		);
	}

	protected onUnderlineToggle(): void {
		const cur = this.el();
		this.editor.updateElement(
			this.slideIndex(),
			cur.id,
			textStylePatch(cur, { underline: !this.currentUnderline() }),
		);
	}
}

// ── Module-private helpers ───────────────────────────────────────────────────

/** Extract a finite number from an input change event, or null if invalid. */
function numberFromEvent(event: Event): number | null {
	const target = event.target;
	if (!(target instanceof HTMLInputElement)) {
		return null;
	}
	const parsed = parseFloat(target.value);
	return Number.isFinite(parsed) ? parsed : null;
}

/** Extract a non-empty string value from an input change event. */
function stringFromEvent(event: Event): string | null {
	const target = event.target;
	if (!(target instanceof HTMLInputElement)) {
		return null;
	}
	const val = target.value.trim();
	return val.length > 0 ? val : null;
}
