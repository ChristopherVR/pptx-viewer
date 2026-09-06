import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { buildTextBuildSpec, textBuildSpanStyle } from '../internal/shared';
import type { ElementAnimationState, TextBuildSpec } from '../internal/shared';
import type { StyleMap } from './element-style';
import type { Paragraph, TextRun } from './paragraph-view';
import { SlideTextRunComponent } from './slide-text-run.component';

/** A run whose text is exactly a newline is a hard line break, not content. */
const NEWLINE_RUN = '\n';

/**
 * SlideTextBlockComponent: renders an element's rich text as paragraphs of
 * styled runs with bullet markers + hanging indents. The paragraph model is
 * built by the shared, framework-agnostic `buildParagraphs` (via
 * `paragraph-view.ts`'s `buildAngularParagraphs`); this component is pure
 * presentation, reusing `SlideTextRunComponent` for each run's own
 * hyperlink/ruby/equation/reflection handling.
 *
 * Extracted from `element-renderer.component.html`'s inline `@else if
 * (hasText())` paragraph loop so BOTH the live renderer and
 * `ReflectionMirrorContentComponent`'s mirror render text from the exact same
 * template: the mirror used to fall back to a simplified re-paint (plain run
 * text plus bullet marker, no ruby / inline equation / tab-stop layout / per-
 * script font pieces), which is what this removes.
 *
 * `elementId` + `subElementAnimStates` are OPTIONAL: present only for the
 * live renderer (staged text-build sub-animations key off the owning
 * element's id), absent for the mirror, which has no `data-element-id` and
 * is never itself animated - PowerPoint's "Animate text: By letter" plays on
 * the live element, and its reflection just tracks the live raster.
 */
@Component({
	selector: 'pptx-slide-text-block',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, SlideTextRunComponent],
	template: `
		<div class="pptx-ng-text" [ngStyle]="textStyle()">
			@for (para of paragraphs(); track $index) {
				<p
					class="pptx-ng-para"
					[ngStyle]="para.paragraphStyle ?? null"
					[style.padding-left.px]="para.indentPx"
					[style.text-indent.px]="para.textIndentPx ?? null"
					[style.line-height]="para.lineHeight ?? null"
					[style.margin-top.px]="para.spaceBeforePx ?? null"
					[style.margin-bottom.px]="para.spaceAfterPx ?? null"
					[style.font-size.px]="para.strutFontSizePx ?? null"
				>
					@if (para.bulletPicture?.src) {
						<img
							class="pptx-ng-bullet-image"
							[src]="para.bulletPicture.src"
							[alt]="para.bulletPicture.accessibleLabel"
							[style.width.px]="para.bulletPicture.sizePx"
							[style.height.px]="para.bulletPicture.sizePx"
							style="
								display: inline-block;
								vertical-align: middle;
								margin-inline-end: 4px;
								object-fit: contain;
							"
						/>
					} @else if (para.bulletMarker) {
						<span
							class="pptx-ng-bullet"
							[ngStyle]="para.bulletStyle"
							[attr.aria-label]="para.bulletPicture?.accessibleLabel ?? null"
							>{{ para.bulletMarker }}</span
						>
					}
					@if (specs()[$index]; as spec) {
						<!-- Staged text build: render the split pieces so each one
					     carries its own sub-animation. -->
						@if (spec.granularity === 'paragraph') {
							<span [attr.data-anim-id]="spec.animId" [ngStyle]="buildSpanStyle(spec)">{{
								paragraphText(para)
							}}</span>
						} @else {
							@for (span of spec.spans ?? []; track $index) {
								<span [attr.data-anim-id]="span.animId" [ngStyle]="buildSpanStyle(span)">{{
									span.text
								}}</span>
							}
						}
					} @else {
						@for (run of para.runs; track $index) {
							@if (run.text === newlineRun) {
								<br />
							} @else {
								<pptx-slide-text-run [run]="run" [interactive]="interactive()" />
							}
						}
					}
					@if (para.isEmpty) {
						<!-- An authored blank line has no runs, so without this the
					     <p> collapses to zero height and the gap a deck puts
					     between a heading and its bullet list disappears. -->
						<br />
					}
				</p>
			}
		</div>
	`,
})
export class SlideTextBlockComponent {
	readonly paragraphs = input.required<Paragraph[]>();
	readonly textStyle = input<StyleMap>({});
	/** Owning element id, needed to key this element's text-build sub-animations. */
	readonly elementId = input<string | undefined>(undefined);
	/**
	 * Live per-sub-element animation states. Present only while a staged text
	 * build (by paragraph / word / letter) is playing; absent everywhere else.
	 */
	readonly subElementAnimStates = input<ReadonlyMap<string, ElementAnimationState> | undefined>(
		undefined,
	);
	/**
	 * Forwarded to each {@link SlideTextRunComponent}: `false` (the default,
	 * what the inert mirror gets) renders hyperlink runs with no click
	 * handler; the live renderer passes `true`.
	 */
	readonly interactive = input<boolean>(false);

	/** Exposed to the template as a plain field (a template expression cannot reference a module constant). */
	protected readonly newlineRun = NEWLINE_RUN;

	/**
	 * The split for a paragraph whose text is being revealed piece by piece,
	 * or `undefined` to render the runs normally. PowerPoint's "Animate text:
	 * By letter" needs the rendered text split to match the per-character
	 * sub-animations, otherwise the whole box just fades as one.
	 */
	protected readonly specs = computed<Array<TextBuildSpec<StyleMap> | undefined>>(() => {
		const id = this.elementId();
		if (!id) {
			return [];
		}
		const states = this.subElementAnimStates();
		return this.paragraphs().map((para, paraIndex) =>
			buildTextBuildSpec<StyleMap>(
				id,
				paraIndex,
				para.runs
					.filter((run) => run.text !== NEWLINE_RUN)
					.map((run) => ({ text: run.text, style: run.style })),
				states,
			),
		);
	});

	/** Whole-paragraph text, for the paragraph-level build wrapper. */
	protected paragraphText(para: Paragraph): string {
		return para.runs.map((run: TextRun) => run.text).join('');
	}

	/** Style for one build piece, merged over the run's own style. */
	protected buildSpanStyle(span: { style?: StyleMap; hidden?: boolean; cssAnimation?: string }) {
		return { ...(span.style ?? {}), ...textBuildSpanStyle(span) };
	}
}
