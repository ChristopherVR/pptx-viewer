/**
 * ribbon-insert-glyph.component.ts: the two hand-drawn Insert tab glyphs
 * (Chart, Equation) that have no Lucide equivalent matching React's toolbar,
 * lifted out of {@link RibbonInsertSectionComponent} to keep that file inside
 * the repo's 300-LOC budget. Markup is unchanged.
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
	selector: 'pptx-ribbon-insert-glyph',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	template: `
		@if (name() === 'chart') {
			<svg
				class="h-4 w-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M3 3v18h18" />
				<rect x="7" y="11" width="3" height="6" />
				<rect x="12" y="7" width="3" height="10" />
				<rect x="17" y="13" width="3" height="4" />
			</svg>
		} @else {
			<svg
				class="h-4 w-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M4 17h6M7 14v6M14 7l4.5 10M15.5 14h5" />
			</svg>
		}
	`,
})
export class RibbonInsertGlyphComponent {
	readonly name = input.required<'chart' | 'equation'>();
}
