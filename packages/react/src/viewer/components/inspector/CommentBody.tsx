/**
 * CommentBody: renders a comment's text with its `@`-mentions highlighted.
 *
 * The split into text/mention runs is a shared decision function
 * (`commentTextSegments`), so react, vue, angular, svelte and vanilla all
 * produce the same runs and cannot drift. This component only maps the
 * resulting `CommentTextSegment[]` onto spans.
 */

import type { PptxComment } from 'pptx-viewer-core';
import {
	COMMENT_MENTION_ATTRIBUTE,
	COMMENT_MENTION_CLASS,
	commentTextSegments,
} from 'pptx-viewer-shared';
import React from 'react';

export interface CommentBodyProps {
	text: string;
	mentions?: PptxComment['mentions'];
	className?: string;
}

export function CommentBody({ text, mentions, className }: CommentBodyProps): React.ReactElement {
	const segments = commentTextSegments(text, mentions);
	if (!segments.some((segment) => segment.kind === 'mention')) {
		return <div className={className}>{text}</div>;
	}
	return (
		<div className={className}>
			{segments.map((segment, index) =>
				segment.kind === 'mention' ? (
					<span
						// eslint-disable-next-line react/no-array-index-key -- segments are positional
						key={index}
						className={`${COMMENT_MENTION_CLASS} rounded bg-primary/15 px-0.5 font-semibold text-primary`}
						{...{ [COMMENT_MENTION_ATTRIBUTE]: segment.personId || '' }}
						title={segment.authorName}
					>
						{segment.text}
					</span>
				) : (
					// eslint-disable-next-line react/no-array-index-key -- segments are positional
					<React.Fragment key={index}>{segment.text}</React.Fragment>
				),
			)}
		</div>
	);
}
