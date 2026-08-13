/**
 * comment-body.component.ts: a comment's text with its `@`-mentions highlighted.
 *
 * Selector: `pptx-comment-body`
 *
 * The split into text/mention runs is the shared decision function
 * `commentTextSegments`, so all five bindings produce identical runs. This
 * component only maps the resulting descriptor onto spans; it holds no logic
 * of its own, which is what keeps Angular from drifting off the others.
 *
 * The template is one unbroken line on purpose: Angular collapses literal
 * whitespace between control-flow blocks, and a pretty-printed template would
 * inject spaces that are not in the comment body.
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PptxComment } from 'pptx-viewer-core';

import type { CommentTextSegment } from '../internal/shared';
import { commentTextSegments } from '../internal/shared';

const COMMENT_BODY_TEMPLATE = `@for (segment of segments(); track $index) {@if (segment.kind === 'mention') {<span class="pptx-comment-mention" [attr.data-pptx-comment-mention]="segment.personId || ''" [attr.title]="segment.authorName || null">{{ segment.text }}</span>} @else {<span>{{ segment.text }}</span>}}`;

const COMMENT_BODY_STYLES = `:host { white-space: pre-wrap; }
.pptx-comment-mention {
	border-radius: 3px;
	background: color-mix(in srgb, var(--pptx-primary, #6366f1) 15%, transparent);
	color: var(--pptx-primary, #6366f1);
	font-weight: 600;
	padding: 0 2px;
}`;

@Component({
	selector: 'pptx-comment-body',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: COMMENT_BODY_TEMPLATE,
	styles: [COMMENT_BODY_STYLES],
})
export class CommentBodyComponent {
	/** The comment's flattened plain text. */
	readonly text = input<string>('');

	/** Mention spans indexed into `text`. */
	readonly mentions = input<PptxComment['mentions']>(undefined);

	readonly segments = computed<CommentTextSegment[]>(() =>
		commentTextSegments(this.text(), this.mentions()),
	);
}

/**
 * The runs this component's template renders, as a pure function.
 *
 * Angular has no TestBed rendering in this package (see
 * `action-settings-panel.component.test.ts`), so the template's only decision
 * is factored out here and asserted directly.
 */
export function commentBodySegments(
	text: string,
	mentions: PptxComment['mentions'],
): CommentTextSegment[] {
	return commentTextSegments(text, mentions);
}
