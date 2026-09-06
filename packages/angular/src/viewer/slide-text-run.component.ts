import { NgStyle, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { EquationRendererComponent } from './equation-renderer.component';
import { shouldPreventHyperlinkNavigation } from './hyperlink-confirm';
import type { TextRun } from './paragraph-view';
import { ViewerOptionsService } from './viewer-options.service';

/**
 * SlideTextRunComponent: renders ONE run of a paragraph (hyperlink / ruby /
 * inline equation / plain span), plus its optional `a:reflection` mirrored
 * sibling. Extracted from `element-renderer.component.html`'s inline
 * `runBase`/`runContent` `<ng-template>`s so `SlideTextBlockComponent` - used
 * by both the LIVE renderer and `ReflectionMirrorContentComponent`'s mirror -
 * reaches ruby annotation, inline equations, tab-stop layout and per-script
 * font pieces without a second, simplified re-paint.
 *
 * `interactive` gates the hyperlink click-confirm handling: `false` (the
 * default, what the inert mirror gets) renders a plain anchor with no
 * `(click)` binding, since a mirror is `aria-hidden` and never meant to be
 * interacted with; the live renderer passes `[interactive]="true"`.
 *
 * `a:reflection` is wrapped HERE, around the whole base run, rather than
 * inside the ruby/hyperlink/plain branches below: a `<ruby>` run's own
 * `display: ruby` (which positions the annotation above its base text) would
 * break if forced to `display: inline-block` to host an absolutely
 * positioned mirror, so the positioning box has to be an outer element that
 * leaves the base run's own tag untouched.
 *
 * `@if (run(); as r)` aliases the input signal to a local template variable
 * once per template (rather than calling `run()` repeatedly): the signal is
 * `input.required`, so this is always truthy, used purely so TypeScript's
 * narrowing of `r.tabLines` / `r.scriptRuns` etc. actually survives into the
 * nested blocks below it (narrowing a signal CALL does not survive a second,
 * separate call the way narrowing a plain variable does).
 */
@Component({
	selector: 'pptx-slide-text-run',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, NgTemplateOutlet, EquationRendererComponent],
	template: `
		@if (run(); as r) {
			@if (r.reflection; as refl) {
				<span style="position: relative; display: inline-block">
					<ng-container [ngTemplateOutlet]="runBase" [ngTemplateOutletContext]="{ r: r }" />
					<span class="pptx-ng-text-reflection" aria-hidden="true" [ngStyle]="refl"
						><span [ngStyle]="r.style"
							><ng-container
								[ngTemplateOutlet]="runContent"
								[ngTemplateOutletContext]="{ r: r }" /></span
					></span>
				</span>
			} @else {
				<ng-container [ngTemplateOutlet]="runBase" [ngTemplateOutletContext]="{ r: r }" />
			}
		}

		<ng-template #runBase let-r="r">
			@if (r.equationXml) {
				<pptx-equation-renderer [equationXml]="r.equationXml" [equationNumber]="r.equationNumber" />
			} @else if (r.href) {
				<a
					class="pptx-ng-link"
					[href]="r.href"
					[attr.target]="r.target ?? '_blank'"
					[attr.rel]="r.rel ?? 'noopener noreferrer'"
					[attr.title]="r.tooltip ?? null"
					[ngStyle]="r.style"
					(click)="interactive() ? onHyperlinkClick($event, r.href) : null"
					><ng-container [ngTemplateOutlet]="runContent" [ngTemplateOutletContext]="{ r: r }"
				/></a>
			} @else if (r.rubyText) {
				<!-- 'a:ruby': the phonetic guide sits above its base
				     text; the <rp> parentheses are the fallback for a
				     browser without ruby support. -->
				<ruby [ngStyle]="r.style"
					><ng-container [ngTemplateOutlet]="runContent" [ngTemplateOutletContext]="{ r: r }" /><rp>
						(</rp
					><rt [ngStyle]="r.rubyStyle">{{ r.rubyText }}</rt
					><rp>)</rp></ruby
				>
			} @else {
				<span [ngStyle]="r.style"
					><ng-container [ngTemplateOutlet]="runContent" [ngTemplateOutletContext]="{ r: r }"
				/></span>
			}
		</ng-template>

		<!--
			A run's text content, honouring shared's per-script font split
			(r.scriptRuns) and measured tab-stop layout (r.tabLines) when
			either is present. Both descriptors come from pptx-viewer-shared's
			buildParagraphs (the per-script split was React-only before this
			existed: CJK, Arabic, Hebrew and Thai text rendered in the wrong
			typeface here; the tab layout was likewise React-only, so a
			TOC-style row lost its leader dots and right-aligned page number).
		-->
		<ng-template #runContent let-r="r">
			@if (r.tabLines; as lines) {
				@for (line of lines; track $index) {
					<span style="display: inline-block; white-space: nowrap">
						@for (piece of line.pieces; track $index) {
							@if (piece.leaderStyle) {
								<span aria-hidden="true" [ngStyle]="piece.leaderStyle">{{ piece.leaderText }}</span>
							}
							<!-- u="words": one sibling span per word/gap in place of the piece span. -->
							@if (piece.words) {
								@for (word of piece.words; track $index) {
									<span [ngStyle]="word.style">{{ word.text }}</span>
								}
							} @else {
								<span [ngStyle]="piece.style">{{ piece.text }}</span>
							}
						}
					</span>
					@if (!$last) {
						<br />
					}
				}
			} @else if (r.scriptRuns ?? r.underlineWordPieces; as pieces) {
				<!-- A bare interpolation as the sole content of an @if/@else
				     block leaks a real leading + trailing whitespace text node
				     (see the original element-renderer.component.html history,
				     commits 20d4d177/18eebb6f): <ng-container> avoids it. -->
				@for (piece of pieces; track $index) {
					@if (piece.style) {
						<span [ngStyle]="piece.style">{{ piece.text }}</span>
					} @else {
						<ng-container>{{ piece.text }}</ng-container>
					}
				}
			} @else {
				<ng-container>{{ r.text }}</ng-container>
			}
		</ng-template>
	`,
})
export class SlideTextRunComponent {
	readonly run = input.required<TextRun>();
	/**
	 * `false` (the default) renders the hyperlink anchor with no click
	 * handler - what the inert reflection mirror gets. The live renderer
	 * passes `true` so the Trust Center confirm-before-navigating gate runs.
	 */
	readonly interactive = input<boolean>(false);

	private readonly viewerOpts = inject(ViewerOptionsService, { optional: true });

	protected onHyperlinkClick(event: MouseEvent, href: string): void {
		const confirm = this.viewerOpts?.confirmExternalHyperlink.bind(this.viewerOpts);
		if (shouldPreventHyperlinkNavigation(confirm, href)) {
			event.preventDefault();
		}
	}
}
