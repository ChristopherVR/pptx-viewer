/**
 * options-pane.component.ts: generic, schema-driven File > Options pane
 * (Angular port of React's `settings/OptionsPane.tsx`).
 *
 * Renders one {@link ViewerOptionsTabDefinition}: the headline, then each
 * section's toggle/select/number/text controls with optional "(i)" info
 * tooltips and PowerPoint-style indenting. Bespoke blocks are handled via
 * `special`: `clearCache` renders inline (emitting {@link clearCache}), and
 * `themePicker` projects host content marked `themePicker` (the appearance
 * swatch gallery). Extra custom content (the Quick Access chooser) projects
 * after the sections.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { clampOptionNumber } from '../internal/shared';
import type {
	ViewerOptionPrimitive,
	ViewerOptions,
	ViewerOptionsControl,
	ViewerOptionsGroupId,
	ViewerOptionsTabDefinition,
} from '../internal/shared';
import { OPTIONS_PANE_STYLES } from './options-pane-styles';

/** One dialog-level option edit (group + key + new primitive value). */
export interface OptionValueChange {
	group: ViewerOptionsGroupId;
	key: string;
	value: ViewerOptionPrimitive;
}

/** Read a control's current primitive value off the options snapshot. */
export function readOptionValue(
	options: ViewerOptions,
	control: Pick<ViewerOptionsControl, 'group' | 'key'>,
): ViewerOptionPrimitive | undefined {
	const group = options[control.group] as unknown as Record<string, unknown>;
	// oxlint-disable-next-line eslint/one-var -- distinct concern from the lookup above, forcing one statement hurts readability
	const value = group[control.key];
	return typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string'
		? value
		: undefined;
}

@Component({
	selector: 'pptx-options-pane',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<div class="pptx-ng-options-pane">
			<p class="pptx-ng-options-headline">{{ tab().descriptionKey | translate }}</p>
			@for (section of tab().sections; track section.id) {
				<section class="pptx-ng-options-section">
					<h3>{{ section.titleKey | translate }}</h3>
					@if (section.descriptionKey; as descriptionKey) {
						<p class="pptx-ng-options-note">{{ descriptionKey | translate }}</p>
					}
					@for (control of section.controls; track control.group + '.' + control.key) {
						@if (control.kind === 'toggle') {
							<!-- The whole row is the label so the 44px touch target
							     (see the compact media query below) isn't limited to the
							     22px checkbox glyph itself. -->
							<label class="pptx-ng-options-row" [class.is-indented]="control.indent">
								<span class="pptx-ng-options-label">
									{{ control.labelKey | translate }}
									@if (control.infoKey; as infoKey) {
										<span
											class="pptx-ng-options-info"
											[title]="infoKey | translate"
											aria-hidden="true"
											>&#9432;</span
										>
									}
								</span>
								<input
									type="checkbox"
									class="pptx-ng-options-check"
									[checked]="value(control) === true"
									[attr.aria-label]="control.labelKey | translate"
									(change)="emitToggle(control, $event)"
								/>
							</label>
						} @else {
							<div class="pptx-ng-options-row" [class.is-indented]="control.indent">
								<span class="pptx-ng-options-label">
									{{ control.labelKey | translate }}
									@if (control.infoKey; as infoKey) {
										<span
											class="pptx-ng-options-info"
											[title]="infoKey | translate"
											aria-hidden="true"
											>&#9432;</span
										>
									}
								</span>
								@switch (control.kind) {
									@case ('select') {
										<select
											class="pptx-ng-options-select"
											[value]="value(control)"
											[attr.aria-label]="control.labelKey | translate"
											(change)="emitSelect(control, $event)"
										>
											@for (choice of selectChoices(control); track choice.value) {
												<option [value]="choice.value" [selected]="choice.value === value(control)">
													{{ choice.labelKey | translate }}
												</option>
											}
										</select>
									}
									@case ('number') {
										<span class="pptx-ng-options-number">
											<input
												type="number"
												[min]="numberMin(control)"
												[max]="numberMax(control)"
												[value]="value(control)"
												[attr.aria-label]="control.labelKey | translate"
												(change)="emitNumber(control, $event)"
											/>
											@if (numberUnitKey(control); as unitKey) {
												<span class="pptx-ng-options-note">{{ unitKey | translate }}</span>
											}
										</span>
									}
									@default {
										<input
											type="text"
											class="pptx-ng-options-text"
											maxlength="64"
											[value]="value(control) ?? ''"
											[attr.aria-label]="control.labelKey | translate"
											(change)="emitText(control, $event)"
										/>
									}
								}
							</div>
						}
					}
					@if (section.special === 'themePicker') {
						<ng-content select="[themePicker]" />
					} @else if (section.special === 'customFonts') {
						<ng-content select="[customFonts]" />
					} @else if (section.special === 'clearCache') {
						<p class="pptx-ng-options-note">
							{{ 'pptx.options.save.clearCacheDescription' | translate }}
						</p>
						<button type="button" class="pptx-ng-options-btn" (click)="clearCache.emit()">
							{{ 'pptx.options.save.clearCacheNow' | translate }}
						</button>
					}
				</section>
			}
			<ng-content />
		</div>
	`,
	styles: [OPTIONS_PANE_STYLES],
})
export class OptionsPaneComponent {
	readonly tab = input.required<ViewerOptionsTabDefinition>();
	readonly options = input.required<ViewerOptions>();
	/** One control edited (applied live by the host). */
	readonly valueChange = output<OptionValueChange>();
	/** Options > Save > "Delete cached files" pressed. */
	readonly clearCache = output<void>();

	protected value(control: ViewerOptionsControl): ViewerOptionPrimitive | undefined {
		return readOptionValue(this.options(), control);
	}

	protected selectChoices(
		control: ViewerOptionsControl,
	): readonly { value: string; labelKey: string }[] {
		return control.kind === 'select' ? control.choices : [];
	}

	protected numberMin(control: ViewerOptionsControl): number {
		return control.kind === 'number' ? control.min : 0;
	}

	protected numberMax(control: ViewerOptionsControl): number {
		return control.kind === 'number' ? control.max : 0;
	}

	protected numberUnitKey(control: ViewerOptionsControl): string | undefined {
		return control.kind === 'number' ? control.unitKey : undefined;
	}

	protected emitToggle(control: ViewerOptionsControl, event: Event): void {
		this.emit(control, (event.target as HTMLInputElement).checked);
	}

	protected emitSelect(control: ViewerOptionsControl, event: Event): void {
		this.emit(control, (event.target as HTMLSelectElement).value);
	}

	protected emitNumber(control: ViewerOptionsControl, event: Event): void {
		if (control.kind !== 'number') {
			return;
		}
		const clamped = clampOptionNumber(
			(event.target as HTMLInputElement).value,
			control.min,
			control.max,
		);
		if (clamped !== undefined) {
			this.emit(control, clamped);
		}
	}

	protected emitText(control: ViewerOptionsControl, event: Event): void {
		this.emit(control, (event.target as HTMLInputElement).value);
	}

	private emit(control: ViewerOptionsControl, value: ViewerOptionPrimitive): void {
		this.valueChange.emit({ group: control.group, key: control.key, value });
	}
}
