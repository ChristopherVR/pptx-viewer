import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { SafeHtml } from '@angular/platform-browser';

import { ommlToMathml } from './omml-to-mathml';

/**
 * EquationRendererComponent — Angular port of the Vue `EquationRenderer.vue`
 * (single-equation variant).
 *
 * Renders one parsed OMML equation tree as inline MathML via Angular's
 * `DomSanitizer.bypassSecurityTrustHtml`, which is required because Angular's
 * default HTML sanitizer strips `<math>` namespace markup.
 *
 * The wrapper is an inline-block `<span>` so the component flows inside a text
 * paragraph in place of a regular text run. When an equation number is
 * supplied the layout mirrors the Vue numbered-equation row: centred equation
 * with the number right-aligned (flex row, width 100%).
 *
 * Pure conversion logic lives in `omml-to-mathml.ts` (Angular-free) so it can
 * be unit-tested without TestBed.
 */
@Component({
	selector: 'pptx-equation-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [],
	template: `
		@if (equationNumber()) {
			<span class="pptx-ng-equation-numbered">
				<span class="pptx-ng-equation-number-spacer" aria-hidden="true"
					>({{ equationNumber() }})</span
				>
				<span class="pptx-ng-equation pptx-ng-equation-centered" [innerHTML]="safeMathml()"></span>
				<span class="pptx-ng-equation-number">({{ equationNumber() }})</span>
			</span>
		} @else {
			<span class="pptx-ng-equation" [innerHTML]="safeMathml()"></span>
		}
	`,
	styles: [
		`
			:host {
				display: inline-block;
				vertical-align: middle;
			}

			.pptx-ng-equation {
				display: inline-block;
				vertical-align: middle;
				font-family: 'Cambria Math', 'STIX Two Math', serif;
			}

			.pptx-ng-equation-numbered {
				display: flex;
				justify-content: space-between;
				align-items: center;
				width: 100%;
			}

			.pptx-ng-equation-centered {
				flex: 1;
				text-align: center;
			}

			.pptx-ng-equation-number-spacer {
				visibility: hidden;
				white-space: nowrap;
			}

			.pptx-ng-equation-number {
				white-space: nowrap;
				font-family: 'Cambria Math', 'STIX Two Math', serif;
			}
		`,
	],
})
export class EquationRendererComponent {
	/** Parsed OMML equation tree (the `equationXml` field of a `TextSegment`). */
	readonly equationXml = input.required<Record<string, unknown>>();

	/** Optional equation number shown right-aligned, e.g. `"1"` → `(1)`. */
	readonly equationNumber = input<string | undefined>(undefined);

	private readonly sanitizer = inject(DomSanitizer);

	/**
	 * Converts the OMML input to MathML and wraps it in a `SafeHtml` value so
	 * Angular's `[innerHTML]` binding renders the `<math>` markup instead of
	 * stripping it.
	 */
	readonly safeMathml = computed<SafeHtml>(() =>
		this.sanitizer.bypassSecurityTrustHtml(ommlToMathml(this.equationXml())),
	);
}
