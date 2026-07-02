/**
 * effects-panel.component.ts: Standalone Angular component for editing
 * visual effects (outer/inner shadow, glow, reflection, soft edge) on a
 * selected PPTX element.
 *
 * Selector: `pptx-effects-panel`
 *
 * Ported from / models the patterns in:
 *   packages/react/src/viewer/components/inspector/fill-stroke-effect-configs.ts
 *   packages/react/src/viewer/components/inspector/fill-stroke-visual-configs.ts
 *   packages/angular/src/viewer/inspector-panel.component.ts
 *
 * Contract:
 *   [element]     : the selected PptxElement (required)
 *   (patch)       : emits a Partial<PptxElement> for the orchestrator to
 *                   commit via EditorStateService.updateElement
 *
 * @module viewer/effects-panel
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import {
	disableGlowPatch,
	disableInnerShadowPatch,
	disableOuterShadowPatch,
	disableReflectionPatch,
	disableSoftEdgePatch,
	effectsStateOf,
	enableGlowPatch,
	enableInnerShadowPatch,
	enableOuterShadowPatch,
	enableReflectionPatch,
	enableSoftEdgePatch,
	updateGlowPatch,
	updateInnerShadowPatch,
	updateOuterShadowPatch,
	updateReflectionPatch,
} from './effects-helpers';
import type { EffectsState } from './effects-helpers';

@Component({
	selector: 'pptx-effects-panel',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="pptx-ng-fx">
			<!-- ── Outer Shadow ─────────────────────────────────────────── -->
			<section class="pptx-ng-fx__section">
				<label class="pptx-ng-fx__toggle-row">
					<input
						type="checkbox"
						class="pptx-ng-fx__checkbox"
						[checked]="state().outerShadow.enabled"
						(change)="onOuterShadowToggle($event)"
					/>
					<span class="pptx-ng-fx__section-title">{{
						'pptx.effects.outerShadow' | translate
					}}</span>
				</label>
				@if (state().outerShadow.enabled) {
					<div class="pptx-ng-fx__fields" [attr.data-el-key]="elementKey()">
						<label class="pptx-ng-fx__label" for="fx-os-color">{{
							'pptx.effects.color' | translate
						}}</label>
						<input
							id="fx-os-color"
							class="pptx-ng-fx__color"
							type="color"
							[value]="state().outerShadow.color"
							(change)="onOuterShadowField('color', $event)"
						/>
						<label class="pptx-ng-fx__label" for="fx-os-opacity">{{
							'pptx.effects.opacity' | translate
						}}</label>
						<input
							id="fx-os-opacity"
							class="pptx-ng-fx__input pptx-ng-fx__input--number"
							type="number"
							inputmode="decimal"
							min="0"
							max="1"
							step="0.05"
							[value]="state().outerShadow.opacity"
							(change)="onOuterShadowField('opacity', $event)"
						/>
						<label class="pptx-ng-fx__label" for="fx-os-blur">{{
							'pptx.effects.blur' | translate
						}}</label>
						<input
							id="fx-os-blur"
							class="pptx-ng-fx__input pptx-ng-fx__input--number"
							type="number"
							inputmode="numeric"
							min="0"
							max="96"
							[value]="state().outerShadow.blur"
							(change)="onOuterShadowField('blur', $event)"
						/>
						<label class="pptx-ng-fx__label" for="fx-os-angle">{{
							'pptx.effects.angle' | translate
						}}</label>
						<input
							id="fx-os-angle"
							class="pptx-ng-fx__input pptx-ng-fx__input--number"
							type="number"
							inputmode="numeric"
							min="0"
							max="359"
							[value]="state().outerShadow.angle"
							(change)="onOuterShadowField('angle', $event)"
						/>
						<label class="pptx-ng-fx__label" for="fx-os-dist">{{
							'pptx.effects.distance' | translate
						}}</label>
						<input
							id="fx-os-dist"
							class="pptx-ng-fx__input pptx-ng-fx__input--number"
							type="number"
							inputmode="decimal"
							min="0"
							max="100"
							step="0.5"
							[value]="state().outerShadow.distance"
							(change)="onOuterShadowField('distance', $event)"
						/>
					</div>
				}
			</section>

			<!-- ── Inner Shadow ─────────────────────────────────────────── -->
			<section class="pptx-ng-fx__section">
				<label class="pptx-ng-fx__toggle-row">
					<input
						type="checkbox"
						class="pptx-ng-fx__checkbox"
						[checked]="state().innerShadow.enabled"
						(change)="onInnerShadowToggle($event)"
					/>
					<span class="pptx-ng-fx__section-title">{{
						'pptx.effects.innerShadow' | translate
					}}</span>
				</label>
				@if (state().innerShadow.enabled) {
					<div class="pptx-ng-fx__fields" [attr.data-el-key]="elementKey()">
						<label class="pptx-ng-fx__label" for="fx-is-color">{{
							'pptx.effects.color' | translate
						}}</label>
						<input
							id="fx-is-color"
							class="pptx-ng-fx__color"
							type="color"
							[value]="state().innerShadow.color"
							(change)="onInnerShadowField('color', $event)"
						/>
						<label class="pptx-ng-fx__label" for="fx-is-opacity">{{
							'pptx.effects.opacity' | translate
						}}</label>
						<input
							id="fx-is-opacity"
							class="pptx-ng-fx__input pptx-ng-fx__input--number"
							type="number"
							inputmode="decimal"
							min="0"
							max="1"
							step="0.05"
							[value]="state().innerShadow.opacity"
							(change)="onInnerShadowField('opacity', $event)"
						/>
						<label class="pptx-ng-fx__label" for="fx-is-blur">{{
							'pptx.effects.blur' | translate
						}}</label>
						<input
							id="fx-is-blur"
							class="pptx-ng-fx__input pptx-ng-fx__input--number"
							type="number"
							inputmode="numeric"
							min="0"
							max="96"
							[value]="state().innerShadow.blur"
							(change)="onInnerShadowField('blur', $event)"
						/>
						<label class="pptx-ng-fx__label" for="fx-is-ox">{{
							'pptx.effects.offsetX' | translate
						}}</label>
						<input
							id="fx-is-ox"
							class="pptx-ng-fx__input pptx-ng-fx__input--number"
							type="number"
							inputmode="numeric"
							min="-96"
							max="96"
							[value]="state().innerShadow.offsetX"
							(change)="onInnerShadowField('offsetX', $event)"
						/>
						<label class="pptx-ng-fx__label" for="fx-is-oy">{{
							'pptx.effects.offsetY' | translate
						}}</label>
						<input
							id="fx-is-oy"
							class="pptx-ng-fx__input pptx-ng-fx__input--number"
							type="number"
							inputmode="numeric"
							min="-96"
							max="96"
							[value]="state().innerShadow.offsetY"
							(change)="onInnerShadowField('offsetY', $event)"
						/>
					</div>
				}
			</section>

			<!-- ── Glow ─────────────────────────────────────────────────── -->
			<section class="pptx-ng-fx__section">
				<label class="pptx-ng-fx__toggle-row">
					<input
						type="checkbox"
						class="pptx-ng-fx__checkbox"
						[checked]="state().glow.enabled"
						(change)="onGlowToggle($event)"
					/>
					<span class="pptx-ng-fx__section-title">{{ 'pptx.effects.glow' | translate }}</span>
				</label>
				@if (state().glow.enabled) {
					<div class="pptx-ng-fx__fields" [attr.data-el-key]="elementKey()">
						<label class="pptx-ng-fx__label" for="fx-glow-color">{{
							'pptx.effects.color' | translate
						}}</label>
						<input
							id="fx-glow-color"
							class="pptx-ng-fx__color"
							type="color"
							[value]="state().glow.color"
							(change)="onGlowField('color', $event)"
						/>
						<label class="pptx-ng-fx__label" for="fx-glow-radius">{{
							'pptx.effects.size' | translate
						}}</label>
						<input
							id="fx-glow-radius"
							class="pptx-ng-fx__input pptx-ng-fx__input--number"
							type="number"
							inputmode="numeric"
							min="0"
							max="96"
							[value]="state().glow.radius"
							(change)="onGlowField('radius', $event)"
						/>
						<label class="pptx-ng-fx__label" for="fx-glow-opacity">{{
							'pptx.effects.opacity' | translate
						}}</label>
						<input
							id="fx-glow-opacity"
							class="pptx-ng-fx__input pptx-ng-fx__input--number"
							type="number"
							inputmode="decimal"
							min="0"
							max="1"
							step="0.05"
							[value]="state().glow.opacity"
							(change)="onGlowField('opacity', $event)"
						/>
					</div>
				}
			</section>

			<!-- ── Reflection ───────────────────────────────────────────── -->
			<section class="pptx-ng-fx__section">
				<label class="pptx-ng-fx__toggle-row">
					<input
						type="checkbox"
						class="pptx-ng-fx__checkbox"
						[checked]="state().reflection.enabled"
						(change)="onReflectionToggle($event)"
					/>
					<span class="pptx-ng-fx__section-title">{{ 'pptx.effects.reflection' | translate }}</span>
				</label>
				@if (state().reflection.enabled) {
					<div class="pptx-ng-fx__fields" [attr.data-el-key]="elementKey()">
						<label class="pptx-ng-fx__label" for="fx-ref-blur">{{
							'pptx.effects.blur' | translate
						}}</label>
						<input
							id="fx-ref-blur"
							class="pptx-ng-fx__input pptx-ng-fx__input--number"
							type="number"
							inputmode="decimal"
							min="0"
							max="20"
							step="0.5"
							[value]="state().reflection.blurRadius"
							(change)="onReflectionField('blurRadius', $event)"
						/>
						<label class="pptx-ng-fx__label" for="fx-ref-so">{{
							'pptx.effects.startPercent' | translate
						}}</label>
						<input
							id="fx-ref-so"
							class="pptx-ng-fx__input pptx-ng-fx__input--number"
							type="number"
							inputmode="numeric"
							min="0"
							max="100"
							[value]="state().reflection.startOpacity"
							(change)="onReflectionField('startOpacity', $event)"
						/>
						<label class="pptx-ng-fx__label" for="fx-ref-eo">{{
							'pptx.effects.endPercent' | translate
						}}</label>
						<input
							id="fx-ref-eo"
							class="pptx-ng-fx__input pptx-ng-fx__input--number"
							type="number"
							inputmode="numeric"
							min="0"
							max="100"
							[value]="state().reflection.endOpacity"
							(change)="onReflectionField('endOpacity', $event)"
						/>
						<label class="pptx-ng-fx__label" for="fx-ref-dist">{{
							'pptx.effects.distance' | translate
						}}</label>
						<input
							id="fx-ref-dist"
							class="pptx-ng-fx__input pptx-ng-fx__input--number"
							type="number"
							inputmode="numeric"
							min="0"
							max="50"
							[value]="state().reflection.distance"
							(change)="onReflectionField('distance', $event)"
						/>
						<label class="pptx-ng-fx__label" for="fx-ref-dir">{{
							'pptx.effects.direction' | translate
						}}</label>
						<input
							id="fx-ref-dir"
							class="pptx-ng-fx__input pptx-ng-fx__input--number"
							type="number"
							inputmode="numeric"
							min="0"
							max="360"
							[value]="state().reflection.direction"
							(change)="onReflectionField('direction', $event)"
						/>
					</div>
				}
			</section>

			<!-- ── Soft Edge ─────────────────────────────────────────────── -->
			<section class="pptx-ng-fx__section">
				<label class="pptx-ng-fx__toggle-row">
					<input
						type="checkbox"
						class="pptx-ng-fx__checkbox"
						[checked]="state().softEdge.enabled"
						(change)="onSoftEdgeToggle($event)"
					/>
					<span class="pptx-ng-fx__section-title">{{ 'pptx.effects.softEdge' | translate }}</span>
				</label>
				@if (state().softEdge.enabled) {
					<div class="pptx-ng-fx__fields" [attr.data-el-key]="elementKey()">
						<label class="pptx-ng-fx__label" for="fx-se-radius">{{
							'pptx.effects.radius' | translate
						}}</label>
						<input
							id="fx-se-radius"
							class="pptx-ng-fx__input pptx-ng-fx__input--number"
							type="number"
							inputmode="numeric"
							min="0"
							max="96"
							[value]="state().softEdge.radius"
							(change)="onSoftEdgeRadius($event)"
						/>
					</div>
				}
			</section>
		</div>
	`,
	styles: `
		.pptx-ng-fx {
			display: flex;
			flex-direction: column;
			gap: 0;
			padding: 0.5rem;
			font-size: 12px;
			color: var(--pptx-inspector-fg, #e0e0e0);
		}

		.pptx-ng-fx__section {
			padding: 0.35rem 0;
			border-bottom: 1px solid var(--pptx-inspector-border, #333);
		}

		.pptx-ng-fx__section:last-child {
			border-bottom: none;
		}

		.pptx-ng-fx__section-title {
			font-size: 11px;
			font-weight: 500;
		}

		.pptx-ng-fx__toggle-row {
			display: flex;
			align-items: center;
			gap: 0.4rem;
			cursor: pointer;
		}

		.pptx-ng-fx__checkbox {
			cursor: pointer;
		}

		.pptx-ng-fx__fields {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.3rem;
			padding: 0.35rem 0 0 1.25rem;
		}

		.pptx-ng-fx__label {
			font-size: 10px;
			color: var(--pptx-inspector-muted, #888);
			min-width: 36px;
			text-align: right;
			flex-shrink: 0;
		}

		.pptx-ng-fx__input {
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			padding: 2px 4px;
			font-size: 12px;
		}

		.pptx-ng-fx__input--number {
			width: 56px;
			text-align: right;
		}

		.pptx-ng-fx__color {
			width: 32px;
			height: 22px;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			padding: 1px;
			cursor: pointer;
			background: transparent;
			flex-shrink: 0;
		}
	`,
})
export class EffectsPanelComponent {
	/** The element whose effects are being edited. */
	readonly element = input.required<PptxElement>();

	/**
	 * Emits a Partial<PptxElement> patch each time the user commits a change.
	 * The orchestrator should call EditorStateService.updateElement(slideIndex, element().id, patch).
	 */
	readonly patch = output<Partial<PptxElement>>();

	/** Derived EffectsState from the current element. */
	protected readonly state = computed<EffectsState>(() => effectsStateOf(this.element()));

	/** Stable key for keying inputs to the current element (prevents caret-reset). */
	protected readonly elementKey = computed(() => this.element().id);

	// ── Outer shadow ──────────────────────────────────────────────────────────

	protected onOuterShadowToggle(event: Event): void {
		const checked = checkedFromEvent(event);
		if (checked === null) {
			return;
		}
		const el = this.element();
		this.emit(
			checked ? enableOuterShadowPatch(el, this.state().outerShadow) : disableOuterShadowPatch(el),
		);
	}

	protected onOuterShadowField(
		field: 'color' | 'opacity' | 'blur' | 'angle' | 'distance',
		event: Event,
	): void {
		const el = this.element();
		if (field === 'color') {
			const val = stringFromEvent(event);
			if (val) {
				this.emit(updateOuterShadowPatch(el, { color: val }));
			}
			return;
		}
		const val = numberFromEvent(event);
		if (val === null) {
			return;
		}
		this.emit(updateOuterShadowPatch(el, { [field]: val }));
	}

	// ── Inner shadow ──────────────────────────────────────────────────────────

	protected onInnerShadowToggle(event: Event): void {
		const checked = checkedFromEvent(event);
		if (checked === null) {
			return;
		}
		const el = this.element();
		this.emit(
			checked ? enableInnerShadowPatch(el, this.state().innerShadow) : disableInnerShadowPatch(el),
		);
	}

	protected onInnerShadowField(
		field: 'color' | 'opacity' | 'blur' | 'offsetX' | 'offsetY',
		event: Event,
	): void {
		const el = this.element();
		if (field === 'color') {
			const val = stringFromEvent(event);
			if (val) {
				this.emit(updateInnerShadowPatch(el, { color: val }));
			}
			return;
		}
		const val = numberFromEvent(event);
		if (val === null) {
			return;
		}
		this.emit(updateInnerShadowPatch(el, { [field]: val }));
	}

	// ── Glow ──────────────────────────────────────────────────────────────────

	protected onGlowToggle(event: Event): void {
		const checked = checkedFromEvent(event);
		if (checked === null) {
			return;
		}
		const el = this.element();
		this.emit(checked ? enableGlowPatch(el, this.state().glow) : disableGlowPatch(el));
	}

	protected onGlowField(field: 'color' | 'radius' | 'opacity', event: Event): void {
		const el = this.element();
		if (field === 'color') {
			const val = stringFromEvent(event);
			if (val) {
				this.emit(updateGlowPatch(el, { color: val }));
			}
			return;
		}
		const val = numberFromEvent(event);
		if (val === null) {
			return;
		}
		this.emit(updateGlowPatch(el, { [field]: val }));
	}

	// ── Reflection ────────────────────────────────────────────────────────────

	protected onReflectionToggle(event: Event): void {
		const checked = checkedFromEvent(event);
		if (checked === null) {
			return;
		}
		const el = this.element();
		this.emit(
			checked ? enableReflectionPatch(el, this.state().reflection) : disableReflectionPatch(el),
		);
	}

	protected onReflectionField(
		field: 'blurRadius' | 'startOpacity' | 'endOpacity' | 'distance' | 'direction',
		event: Event,
	): void {
		const val = numberFromEvent(event);
		if (val === null) {
			return;
		}
		this.emit(updateReflectionPatch(this.element(), { [field]: val }));
	}

	// ── Soft edge ─────────────────────────────────────────────────────────────

	protected onSoftEdgeToggle(event: Event): void {
		const checked = checkedFromEvent(event);
		if (checked === null) {
			return;
		}
		const el = this.element();
		this.emit(
			checked
				? enableSoftEdgePatch(el, this.state().softEdge.radius || 6)
				: disableSoftEdgePatch(el),
		);
	}

	protected onSoftEdgeRadius(event: Event): void {
		const val = numberFromEvent(event);
		if (val === null) {
			return;
		}
		this.emit(enableSoftEdgePatch(this.element(), val));
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

function stringFromEvent(event: Event): string | null {
	const target = event.target;
	if (!(target instanceof HTMLInputElement)) {
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
