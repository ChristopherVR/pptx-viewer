/**
 * text-advanced-panel.component.ts: Standalone Angular component for editing
 * advanced text properties (letter spacing, line spacing, paragraph alignment,
 * indent, text direction, vertical anchor) on a selected PPTX element.
 *
 * Selector: `pptx-text-advanced-panel`
 *
 * Ported from / models the patterns in:
 *   packages/react/src/viewer/components/inspector/TextPropertiesHelpers.tsx
 *   packages/react/src/viewer/components/inspector/TextProperties.tsx
 *   packages/angular/src/viewer/inspector-panel.component.ts
 *
 * Contract:
 *   [element]     : the selected PptxElement (required)
 *   (patch)       : emits a Partial<PptxElement> for the orchestrator to
 *                   commit via EditorStateService.updateElement
 *
 * @module viewer/text-advanced-panel
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import {
	ALIGN_OPTIONS,
	TEXT_DIRECTION_OPTIONS,
	VALIGN_OPTIONS,
	alignPatch,
	characterSpacingPatch,
	lineSpacingPatch,
	textAdvancedPatch,
	textAdvancedStateOf,
	textDirectionPatch,
	vAlignPatch,
} from './text-advanced-helpers';
import type { TextAdvancedState } from './text-advanced-helpers';

@Component({
	selector: 'pptx-text-advanced-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="pptx-ng-txadv">
			@if (!hasText()) {
				<p class="pptx-ng-txadv__empty">Select a text element to edit advanced text properties.</p>
			} @else {
				<!-- ── Alignment row ─────────────────────────────────────── -->
				<section class="pptx-ng-txadv__section">
					<h4 class="pptx-ng-txadv__heading">Paragraph Alignment</h4>
					<div class="pptx-ng-txadv__row pptx-ng-txadv__row--wrap">
						@for (opt of alignOptions; track opt[0]) {
							<button
								type="button"
								class="pptx-ng-txadv__align-btn"
								[class.is-active]="state().align === opt[0]"
								[title]="opt[1]"
								(click)="onAlignChange(opt[0])"
							>
								{{ alignLabel(opt[0]) }}
							</button>
						}
					</div>
				</section>

				<!-- ── Vertical anchor ──────────────────────────────────── -->
				<section class="pptx-ng-txadv__section">
					<div class="pptx-ng-txadv__row">
						<label class="pptx-ng-txadv__label" for="txadv-valign">V-Align</label>
						<select
							id="txadv-valign"
							class="pptx-ng-txadv__select"
							[value]="state().vAlign"
							(change)="onVAlignChange($event)"
						>
							@for (opt of vAlignOptions; track opt[0]) {
								<option [value]="opt[0]">{{ opt[1] }}</option>
							}
						</select>
					</div>
				</section>

				<!-- ── Text direction ────────────────────────────────────── -->
				<section class="pptx-ng-txadv__section">
					<div class="pptx-ng-txadv__row">
						<label class="pptx-ng-txadv__label" for="txadv-dir">Direction</label>
						<select
							id="txadv-dir"
							class="pptx-ng-txadv__select"
							[value]="state().textDirection"
							(change)="onTextDirectionChange($event)"
						>
							@for (opt of textDirectionOptions; track opt[0]) {
								<option [value]="opt[0]">{{ opt[1] }}</option>
							}
						</select>
					</div>

					<div class="pptx-ng-txadv__row">
						<label class="pptx-ng-txadv__label" for="txadv-rtl">
							<input
								id="txadv-rtl"
								type="checkbox"
								class="pptx-ng-txadv__checkbox"
								[checked]="state().rtl"
								(change)="onRtlToggle($event)"
							/>
							RTL
						</label>
					</div>
				</section>

				<!-- ── Spacing ───────────────────────────────────────────── -->
				<section class="pptx-ng-txadv__section">
					<h4 class="pptx-ng-txadv__heading">Spacing</h4>
					@if (elementKey(); as key) {
						<div class="pptx-ng-txadv__grid" [attr.data-el-key]="key">
							<!-- Character spacing -->
							<label class="pptx-ng-txadv__label" for="txadv-cs">Letter Spc</label>
							<input
								id="txadv-cs"
								class="pptx-ng-txadv__input pptx-ng-txadv__input--number"
								type="number"
								inputmode="numeric"
								min="-5000"
								max="10000"
								step="50"
								[value]="state().characterSpacing"
								(change)="onCharacterSpacingChange($event)"
							/>

							<!-- Line spacing multiplier -->
							<label class="pptx-ng-txadv__label" for="txadv-ls">Line Spc</label>
							<input
								id="txadv-ls"
								class="pptx-ng-txadv__input pptx-ng-txadv__input--number"
								type="number"
								inputmode="decimal"
								min="0.5"
								max="5"
								step="0.05"
								[value]="state().lineSpacing"
								(change)="onLineSpacingChange($event)"
							/>

							<!-- Exact line spacing (pt) -->
							<label class="pptx-ng-txadv__label" for="txadv-lspt">Line Spc pt</label>
							<input
								id="txadv-lspt"
								class="pptx-ng-txadv__input pptx-ng-txadv__input--number"
								type="number"
								inputmode="decimal"
								min="0"
								max="200"
								step="1"
								[value]="state().lineSpacingExactPt ?? ''"
								placeholder="auto"
								(change)="onLineSpacingExactPtChange($event)"
							/>

							<!-- Para spacing before -->
							<label class="pptx-ng-txadv__label" for="txadv-spb">Space Before</label>
							<input
								id="txadv-spb"
								class="pptx-ng-txadv__input pptx-ng-txadv__input--number"
								type="number"
								inputmode="numeric"
								min="0"
								max="200"
								[value]="state().paragraphSpacingBefore"
								(change)="onSpacingBeforeChange($event)"
							/>

							<!-- Para spacing after -->
							<label class="pptx-ng-txadv__label" for="txadv-spa">Space After</label>
							<input
								id="txadv-spa"
								class="pptx-ng-txadv__input pptx-ng-txadv__input--number"
								type="number"
								inputmode="numeric"
								min="0"
								max="200"
								[value]="state().paragraphSpacingAfter"
								(change)="onSpacingAfterChange($event)"
							/>
						</div>
					}
				</section>

				<!-- ── Indent & margin ───────────────────────────────────── -->
				<section class="pptx-ng-txadv__section">
					<h4 class="pptx-ng-txadv__heading">Indent &amp; Margin</h4>
					@if (elementKey(); as key) {
						<div class="pptx-ng-txadv__grid" [attr.data-el-key]="key">
							<label class="pptx-ng-txadv__label" for="txadv-ind">Indent</label>
							<input
								id="txadv-ind"
								class="pptx-ng-txadv__input pptx-ng-txadv__input--number"
								type="number"
								inputmode="numeric"
								min="-500"
								max="500"
								step="4"
								[value]="state().paragraphIndent"
								(change)="onIndentChange($event)"
							/>

							<label class="pptx-ng-txadv__label" for="txadv-ml">Left Margin</label>
							<input
								id="txadv-ml"
								class="pptx-ng-txadv__input pptx-ng-txadv__input--number"
								type="number"
								inputmode="numeric"
								min="0"
								max="500"
								step="4"
								[value]="state().paragraphMarginLeft"
								(change)="onMarginLeftChange($event)"
							/>
						</div>
					}
				</section>
			}
		</div>
	`,
	styles: `
		.pptx-ng-txadv {
			display: flex;
			flex-direction: column;
			gap: 0;
			padding: 0.5rem;
			font-size: 12px;
			color: var(--pptx-inspector-fg, #e0e0e0);
		}

		.pptx-ng-txadv__empty {
			font-size: 11px;
			color: var(--pptx-inspector-muted, #888);
			margin: 0;
		}

		.pptx-ng-txadv__section {
			padding: 0.4rem 0;
			border-bottom: 1px solid var(--pptx-inspector-border, #333);
		}

		.pptx-ng-txadv__section:last-child {
			border-bottom: none;
		}

		.pptx-ng-txadv__heading {
			font-size: 10px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--pptx-inspector-muted, #888);
			margin: 0 0 0.3rem 0;
		}

		.pptx-ng-txadv__row {
			display: flex;
			align-items: center;
			gap: 0.35rem;
			margin-bottom: 0.3rem;
		}

		.pptx-ng-txadv__row:last-child {
			margin-bottom: 0;
		}

		.pptx-ng-txadv__row--wrap {
			flex-wrap: wrap;
		}

		.pptx-ng-txadv__grid {
			display: grid;
			grid-template-columns: auto 1fr;
			align-items: center;
			gap: 0.3rem 0.4rem;
		}

		.pptx-ng-txadv__label {
			font-size: 10px;
			color: var(--pptx-inspector-muted, #888);
			text-align: right;
			flex-shrink: 0;
			display: flex;
			align-items: center;
			gap: 0.25rem;
		}

		.pptx-ng-txadv__select,
		.pptx-ng-txadv__input {
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			padding: 2px 4px;
			font-size: 12px;
		}

		.pptx-ng-txadv__select {
			flex: 1;
			min-width: 0;
		}

		.pptx-ng-txadv__input--number {
			width: 72px;
			text-align: right;
		}

		.pptx-ng-txadv__checkbox {
			cursor: pointer;
		}

		.pptx-ng-txadv__align-btn {
			height: 24px;
			min-width: 36px;
			padding: 0 6px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			cursor: pointer;
			font-size: 10px;
			white-space: nowrap;
		}

		.pptx-ng-txadv__align-btn.is-active {
			background: var(--pptx-inspector-active, #0078d4);
			border-color: var(--pptx-inspector-active, #0078d4);
			color: #fff;
		}

		.pptx-ng-txadv__align-btn:hover:not(.is-active) {
			background: var(--pptx-inspector-hover, #3a3a3a);
		}

		/* ── Responsive: larger touch targets on coarse-pointer devices ── */
		@media (pointer: coarse), (max-width: 640px) {
			.pptx-ng-txadv {
				font-size: 14px;
			}

			.pptx-ng-txadv__input,
			.pptx-ng-txadv__select {
				min-height: 36px;
				font-size: 16px;
				padding: 4px 8px;
			}

			.pptx-ng-txadv__align-btn {
				height: 36px;
				min-width: 48px;
				font-size: 12px;
			}
		}
	`,
})
export class TextAdvancedPanelComponent {
	/** The element whose advanced text properties are being edited. */
	readonly element = input.required<PptxElement>();

	/**
	 * Emits a Partial<PptxElement> patch each time the user commits a change.
	 * The orchestrator should call EditorStateService.updateElement(slideIndex, element().id, patch).
	 */
	readonly patch = output<Partial<PptxElement>>();

	/** Whether the element supports text properties. */
	protected readonly hasText = computed(() => hasTextProperties(this.element()));

	/** Derived advanced text state from the current element. */
	protected readonly state = computed<TextAdvancedState>(() => textAdvancedStateOf(this.element()));

	/** Stable key for keying inputs to the current element (prevents caret-reset mid-edit). */
	protected readonly elementKey = computed(() => this.element().id);

	/** Exposed option arrays for the template. */
	protected readonly alignOptions = ALIGN_OPTIONS;
	protected readonly vAlignOptions = VALIGN_OPTIONS;
	protected readonly textDirectionOptions = TEXT_DIRECTION_OPTIONS;

	// ── Short display label for alignment buttons ──────────────────────────────

	protected alignLabel(align: NonNullable<TextStyle['align']>): string {
		switch (align) {
			case 'left':
				return '≡L';
			case 'center':
				return '≡C';
			case 'right':
				return '≡R';
			case 'justify':
				return '≡J';
			case 'justLow':
				return 'JL';
			case 'dist':
				return 'Di';
			case 'thaiDist':
				return 'TD';
			default:
				return '?';
		}
	}

	// ── Alignment ─────────────────────────────────────────────────────────────

	protected onAlignChange(align: NonNullable<TextStyle['align']>): void {
		this.emit(alignPatch(this.element(), align));
	}

	protected onVAlignChange(event: Event): void {
		const val = selectValueFromEvent(event) as NonNullable<TextStyle['vAlign']> | null;
		if (val && (val === 'top' || val === 'middle' || val === 'bottom')) {
			this.emit(vAlignPatch(this.element(), val));
		}
	}

	// ── Direction ─────────────────────────────────────────────────────────────

	protected onTextDirectionChange(event: Event): void {
		const val = selectValueFromEvent(event);
		if (val && isTextDirection(val)) {
			this.emit(textDirectionPatch(this.element(), val));
		}
	}

	protected onRtlToggle(event: Event): void {
		const checked = checkedFromEvent(event);
		if (checked === null) {
			return;
		}
		this.emit(textAdvancedPatch(this.element(), { rtl: checked }));
	}

	// ── Spacing ───────────────────────────────────────────────────────────────

	protected onCharacterSpacingChange(event: Event): void {
		const val = numberFromEvent(event);
		if (val === null) {
			return;
		}
		this.emit(characterSpacingPatch(this.element(), val));
	}

	protected onLineSpacingChange(event: Event): void {
		const val = numberFromEvent(event);
		if (val === null || val <= 0) {
			return;
		}
		// Changing multiplier clears exact-pt mode.
		this.emit(lineSpacingPatch(this.element(), val, null));
	}

	protected onLineSpacingExactPtChange(event: Event): void {
		const target = event.target;
		if (!(target instanceof HTMLInputElement)) {
			return;
		}
		const raw = target.value.trim();
		if (raw.length === 0) {
			// Empty → revert to multiplier mode; use current multiplier.
			this.emit(lineSpacingPatch(this.element(), this.state().lineSpacing, null));
			return;
		}
		const val = parseFloat(raw);
		if (!Number.isFinite(val) || val <= 0) {
			return;
		}
		this.emit(lineSpacingPatch(this.element(), 1.0, val));
	}

	protected onSpacingBeforeChange(event: Event): void {
		const val = numberFromEvent(event);
		if (val === null) {
			return;
		}
		this.emit(textAdvancedPatch(this.element(), { paragraphSpacingBefore: Math.max(0, val) }));
	}

	protected onSpacingAfterChange(event: Event): void {
		const val = numberFromEvent(event);
		if (val === null) {
			return;
		}
		this.emit(textAdvancedPatch(this.element(), { paragraphSpacingAfter: Math.max(0, val) }));
	}

	// ── Indent & margin ───────────────────────────────────────────────────────

	protected onIndentChange(event: Event): void {
		const val = numberFromEvent(event);
		if (val === null) {
			return;
		}
		this.emit(textAdvancedPatch(this.element(), { paragraphIndent: val }));
	}

	protected onMarginLeftChange(event: Event): void {
		const val = numberFromEvent(event);
		if (val === null) {
			return;
		}
		this.emit(textAdvancedPatch(this.element(), { paragraphMarginLeft: Math.max(0, val) }));
	}

	// ── Internal ──────────────────────────────────────────────────────────────

	private emit(p: Partial<PptxElement>): void {
		this.patch.emit(p);
	}
}

// ── Module-private helpers ────────────────────────────────────────────────────

function numberFromEvent(event: Event): number | null {
	const target = event.target;
	if (!(target instanceof HTMLInputElement)) {
		return null;
	}
	const parsed = parseFloat(target.value);
	return Number.isFinite(parsed) ? parsed : null;
}

function selectValueFromEvent(event: Event): string | null {
	const target = event.target;
	if (!(target instanceof HTMLSelectElement)) {
		return null;
	}
	const val = target.value.trim();
	return val.length > 0 ? val : null;
}

function checkedFromEvent(event: Event): boolean | null {
	const target = event.target;
	if (!(target instanceof HTMLInputElement)) {
		return null;
	}
	return target.checked;
}

const TEXT_DIRECTION_VALUES = new Set<string>([
	'horizontal',
	'vertical',
	'vertical270',
	'eaVert',
	'wordArtVert',
	'wordArtVertRtl',
	'mongolianVert',
]);

function isTextDirection(val: string): val is NonNullable<TextStyle['textDirection']> {
	return TEXT_DIRECTION_VALUES.has(val);
}
