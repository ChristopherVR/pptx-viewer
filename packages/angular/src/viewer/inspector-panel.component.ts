/**
 * inspector-panel.component.ts: Editor inspector panel for the PPTX viewer.
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
import type {
	ChartPptxElement,
	PptxElement,
	PptxElementAnimation,
	TablePptxElement,
} from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';

import { AnimationAuthorPanelComponent } from './animation-author-panel.component';
import { ChartDataEditorComponent } from './chart-data-editor.component';
import { EditorStateService } from './editor-state.service';
import { EffectsPanelComponent } from './effects-panel.component';
import { GradientPickerComponent } from './gradient-picker.component';
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
import { TableDataEditorComponent } from './table-data-editor.component';
import { TextAdvancedPanelComponent } from './text-advanced-panel.component';

@Component({
	selector: 'pptx-inspector-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		GradientPickerComponent,
		EffectsPanelComponent,
		TextAdvancedPanelComponent,
		TableDataEditorComponent,
		ChartDataEditorComponent,
		AnimationAuthorPanelComponent,
	],
	template: `
		<!--
			NOTE (mobile-safe inputs): every numeric / colour input is keyed on the
			selected element's id via @if blocks. Angular destroys and recreates the
			<input> only when a *different* element is selected, seeding its initial
			value once. While the user types, the [value] binding is NOT re-evaluated
			against the live (just-patched) element, so .value is never rewritten
			mid-edit: the caret stays put and the on-screen keyboard does not dismiss.
			All commits happen on (change) (blur), reading event.target.value.
		-->
		<aside class="pptx-ng-inspector" aria-label="Element properties">
			<!-- ── Transform: Position & Size ─────────────────────────────────── -->
			<section class="pptx-ng-inspector__section">
				<h3 class="pptx-ng-inspector__heading">Transform</h3>

				@if (elementKey(); as key) {
					<div class="pptx-ng-inspector__row" [attr.data-el-key]="key">
						<label class="pptx-ng-inspector__label" for="insp-x">X</label>
						<input
							id="insp-x"
							class="pptx-ng-inspector__input pptx-ng-inspector__input--number"
							type="number"
							inputmode="numeric"
							[value]="seed().x"
							(change)="onPositionChange($event, 'x')"
						/>
						<label class="pptx-ng-inspector__label" for="insp-y">Y</label>
						<input
							id="insp-y"
							class="pptx-ng-inspector__input pptx-ng-inspector__input--number"
							type="number"
							inputmode="numeric"
							[value]="seed().y"
							(change)="onPositionChange($event, 'y')"
						/>
					</div>

					<div class="pptx-ng-inspector__row">
						<label class="pptx-ng-inspector__label" for="insp-w">W</label>
						<input
							id="insp-w"
							class="pptx-ng-inspector__input pptx-ng-inspector__input--number"
							type="number"
							inputmode="numeric"
							min="1"
							[value]="seed().width"
							(change)="onSizeChange($event, 'width')"
						/>
						<label class="pptx-ng-inspector__label" for="insp-h">H</label>
						<input
							id="insp-h"
							class="pptx-ng-inspector__input pptx-ng-inspector__input--number"
							type="number"
							inputmode="numeric"
							min="1"
							[value]="seed().height"
							(change)="onSizeChange($event, 'height')"
						/>
					</div>

					<div class="pptx-ng-inspector__row">
						<label class="pptx-ng-inspector__label" for="insp-rot">Rot°</label>
						<input
							id="insp-rot"
							class="pptx-ng-inspector__input pptx-ng-inspector__input--number"
							type="number"
							inputmode="numeric"
							[value]="seed().rotation"
							(change)="onRotationChange($event)"
						/>
						<label class="pptx-ng-inspector__label" for="insp-opacity">Opacity</label>
						<input
							id="insp-opacity"
							class="pptx-ng-inspector__input pptx-ng-inspector__input--number"
							type="number"
							inputmode="decimal"
							min="0"
							max="1"
							step="0.01"
							[value]="seed().opacity"
							(change)="onOpacityChange($event)"
						/>
					</div>
				}
			</section>

			<!-- ── Shape fill & stroke (shape-style elements only) ────────────── -->
			@if (hasShape()) {
				<section class="pptx-ng-inspector__section">
					<h3 class="pptx-ng-inspector__heading">Fill &amp; Stroke</h3>

					@if (elementKey(); as key) {
						<div class="pptx-ng-inspector__row" [attr.data-el-key]="key">
							<label class="pptx-ng-inspector__label" for="insp-fill">Fill</label>
							<input
								id="insp-fill"
								class="pptx-ng-inspector__color"
								type="color"
								[value]="seed().fillColor"
								(change)="onFillColorChange($event)"
							/>
							<label class="pptx-ng-inspector__label" for="insp-stroke">Stroke</label>
							<input
								id="insp-stroke"
								class="pptx-ng-inspector__color"
								type="color"
								[value]="seed().strokeColor"
								(change)="onStrokeColorChange($event)"
							/>
						</div>
					}
				</section>
			}

			<!-- ── Text style (text-bearing elements only) ─────────────────────── -->
			@if (hasText()) {
				<section class="pptx-ng-inspector__section">
					<h3 class="pptx-ng-inspector__heading">Text</h3>

					@if (elementKey(); as key) {
						<div class="pptx-ng-inspector__row" [attr.data-el-key]="key">
							<label class="pptx-ng-inspector__label" for="insp-text-color">Color</label>
							<input
								id="insp-text-color"
								class="pptx-ng-inspector__color"
								type="color"
								[value]="seed().textColor"
								(change)="onTextColorChange($event)"
							/>
							<label class="pptx-ng-inspector__label" for="insp-font-size">Size</label>
							<input
								id="insp-font-size"
								class="pptx-ng-inspector__input pptx-ng-inspector__input--number"
								type="number"
								inputmode="numeric"
								min="1"
								[value]="seed().fontSize"
								(change)="onFontSizeChange($event)"
							/>
						</div>
					}

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

			<!-- ── Advanced: gradient fill (shape-style elements) ─────────────── -->
			@if (hasShape()) {
				<details class="pptx-ng-inspector__details">
					<summary class="pptx-ng-inspector__summary">Gradient fill</summary>
					<pptx-gradient-picker [element]="el()" (patch)="onPatch($event)" />
				</details>

				<!-- ── Advanced: effects (shadow / glow / reflection / soft edge) ── -->
				<details class="pptx-ng-inspector__details">
					<summary class="pptx-ng-inspector__summary">Effects</summary>
					<pptx-effects-panel [element]="el()" (patch)="onPatch($event)" />
				</details>
			}

			<!-- ── Advanced: text (spacing / alignment / direction) ───────────── -->
			@if (hasText()) {
				<details class="pptx-ng-inspector__details">
					<summary class="pptx-ng-inspector__summary">Text — advanced</summary>
					<pptx-text-advanced-panel [element]="el()" (patch)="onPatch($event)" />
				</details>
			}

			<!-- ── Table data editor ──────────────────────────────────────────── -->
			@if (tableEl(); as t) {
				<details class="pptx-ng-inspector__details">
					<summary class="pptx-ng-inspector__summary">Table data</summary>
					<pptx-table-data-editor [element]="t" (elementChange)="onElementReplace($event)" />
				</details>
			}

			<!-- ── Chart data editor ──────────────────────────────────────────── -->
			@if (chartEl(); as c) {
				<details class="pptx-ng-inspector__details">
					<summary class="pptx-ng-inspector__summary">Chart data</summary>
					<pptx-chart-data-editor [element]="c" (elementChange)="onElementReplace($event)" />
				</details>
			}

			<!-- ── Animation authoring ────────────────────────────────────────── -->
			<details class="pptx-ng-inspector__details">
				<summary class="pptx-ng-inspector__summary">Animation</summary>
				<pptx-animation-author-panel
					[element]="el()"
					[slideIndex]="slideIndex()"
					[animations]="slideAnimations()"
					(animationsChange)="onAnimationsChange($event)"
				/>
			</details>

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

		.pptx-ng-inspector__details {
			border-bottom: 1px solid var(--pptx-inspector-border, #333);
		}

		.pptx-ng-inspector__summary {
			padding: 0.5rem 0;
			font-size: 10px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--pptx-inspector-muted, #888);
			cursor: pointer;
			user-select: none;
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

		/* ── Touch / mobile: larger hit targets + full-width inputs ─────────── */
		@media (pointer: coarse), (max-width: 640px) {
			.pptx-ng-inspector {
				width: 100%;
				min-width: 0;
				box-sizing: border-box;
				font-size: 14px;
			}

			.pptx-ng-inspector__row {
				flex-wrap: wrap;
				gap: 0.5rem;
			}

			.pptx-ng-inspector__label {
				min-width: 28px;
			}

			.pptx-ng-inspector__input {
				flex: 1 1 auto;
				min-height: 40px;
				font-size: 16px; /* prevents iOS auto-zoom on focus */
				padding: 6px 8px;
			}

			.pptx-ng-inspector__input--number {
				width: auto;
				min-width: 72px;
			}

			.pptx-ng-inspector__color {
				width: 44px;
				height: 40px;
			}

			.pptx-ng-inspector__toggle {
				min-width: 44px;
				width: auto;
				flex: 1 1 auto;
				height: 40px;
				font-size: 15px;
			}

			.pptx-ng-inspector__btn {
				min-height: 40px;
				padding: 8px 10px;
				font-size: 13px;
			}
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

	/**
	 * Stable identity key for the selected element. Only changes when a
	 * *different* element is selected. The seed signal below is keyed on this so
	 * input [value] bindings never get rewritten while the user is typing into
	 * the currently-selected element (caret-reset / keyboard-dismiss guard).
	 */
	protected readonly elementKey = computed(() => this.el().id);

	/**
	 * One-shot seed of every editable field's initial display value, recomputed
	 * only when `elementKey` changes (i.e. on selection change), NOT on every
	 * edit commit. Bound to each <input>'s [value] so Angular re-evaluating the
	 * binding during change-detection always yields the same value mid-edit and
	 * therefore never rewrites the element's `.value` / resets the caret.
	 */
	protected readonly seed = computed(() => {
		// Depend on elementKey for stability, then read the element once.
		this.elementKey();
		const cur = this.el();
		return {
			x: cur.x,
			y: cur.y,
			width: cur.width,
			height: cur.height,
			rotation: cur.rotation ?? 0,
			opacity: cur.opacity ?? 1,
			fillColor: fillColorOf(cur),
			strokeColor: strokeColorOf(cur),
			textColor: textColorOf(cur),
			fontSize: fontSizeOf(cur),
		};
	});

	/** Whether the element supports shape-style (fill/stroke) editing. */
	protected readonly hasShape = computed(() => hasShapeProperties(this.el()));

	/** Whether the element supports text-style editing. */
	protected readonly hasText = computed(() => hasTextProperties(this.el()));

	// -- Computed display values (toggles only: buttons, no caret risk) -------

	protected readonly currentBold = computed(() => isBold(this.el()));
	protected readonly currentItalic = computed(() => isItalic(this.el()));
	protected readonly currentUnderline = computed(() => isUnderline(this.el()));

	/** The selected element narrowed to a table, or undefined. */
	protected readonly tableEl = computed(() =>
		this.el().type === 'table' ? (this.el() as TablePptxElement) : undefined,
	);
	/** The selected element narrowed to a chart, or undefined. */
	protected readonly chartEl = computed(() =>
		this.el().type === 'chart' ? (this.el() as ChartPptxElement) : undefined,
	);

	/** Commit a partial-element patch from an advanced sub-panel as one history entry. */
	protected onPatch(patch: Partial<PptxElement>): void {
		this.editor.updateElement(this.slideIndex(), this.el().id, patch);
	}

	/** Commit a fully-replaced element (table/chart data editors) as one history entry. */
	protected onElementReplace(updated: PptxElement): void {
		this.editor.updateElement(this.slideIndex(), updated.id, updated as Partial<PptxElement>);
	}

	/** The active slide's element-animation list (animations live on the slide). */
	protected readonly slideAnimations = computed<readonly PptxElementAnimation[]>(
		() => this.editor.slides()[this.slideIndex()]?.animations ?? [],
	);

	/** Commit an updated slide-level animation list as one history entry. */
	protected onAnimationsChange(animations: PptxElementAnimation[]): void {
		this.editor.updateSlide(this.slideIndex(), { animations });
	}

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
