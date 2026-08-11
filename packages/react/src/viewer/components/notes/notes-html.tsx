import type { TextSegment } from 'pptx-viewer-core';
import React from 'react';

import { isUrlSafe, safeOpenUrl } from '../../utils/hyperlink-security';
import { INDENT_PX, segmentsToParagraphs } from './notes-utils';

/* ------------------------------------------------------------------ */
/*  Segments <-> editor HTML (for contentEditable innerHTML)            */
/* ------------------------------------------------------------------ */

// Serialising segments to editor HTML and parsing them back out of the
// contentEditable are shared with the other bindings' notes editors.
export { parseSegmentsFromRichEditor, segmentsToEditorHtml } from 'pptx-viewer-shared';

/* ------------------------------------------------------------------ */
/*  Render rich notes segments as React nodes (read-only display)      */
/* ------------------------------------------------------------------ */

export function renderRichNotesSegments(segments: TextSegment[]): React.ReactNode[] {
	const paragraphs = segmentsToParagraphs(segments);
	const nodes: React.ReactNode[] = [];
	let numberedCounter = 0;

	paragraphs.forEach((para, pIdx) => {
		if (para.bulletType === 'numbered') {
			numberedCounter++;
		} else {
			numberedCounter = 0;
		}

		const divStyle: React.CSSProperties = {};
		if (para.indentLevel > 0) {
			divStyle.paddingLeft = para.indentLevel * INDENT_PX;
		}

		const children: React.ReactNode[] = [];

		if (para.bulletType === 'bullet') {
			children.push(
				<span key='bullet' style={{ marginRight: 6, color: '#9ca3af' }}>
					{'\u2022'}
				</span>,
			);
		} else if (para.bulletType === 'numbered') {
			children.push(
				<span key='num' style={{ marginRight: 6, color: '#9ca3af' }}>
					{numberedCounter}.
				</span>,
			);
		}

		para.segments.forEach((segment, sIdx) => {
			if (segment.isParagraphBreak) {
				return;
			}
			const style: React.CSSProperties = {};
			if (segment.style.bold) {
				style.fontWeight = 'bold';
			}
			if (segment.style.italic) {
				style.fontStyle = 'italic';
			}
			if (segment.style.underline) {
				style.textDecoration = 'underline';
			}
			if (segment.style.strikethrough) {
				style.textDecoration = `${style.textDecoration ? `${style.textDecoration} ` : ''}line-through`;
			}
			if (segment.style.color) {
				style.color = segment.style.color;
			}
			if (segment.style.fontSize) {
				style.fontSize = `${segment.style.fontSize}pt`;
			}
			if (segment.style.fontFamily) {
				style.fontFamily = segment.style.fontFamily;
			}

			if (segment.style.hyperlink && isUrlSafe(segment.style.hyperlink)) {
				const safeHref = segment.style.hyperlink;
				style.color = '#4a9eff';
				style.textDecoration = 'underline';
				style.cursor = 'pointer';
				children.push(
					<a
						key={`seg-${pIdx}-${sIdx}`}
						href={safeHref}
						style={style}
						onClick={(e) => {
							e.preventDefault();
							safeOpenUrl(safeHref);
						}}
					>
						{segment.text}
					</a>,
				);
			} else {
				children.push(
					<span key={`seg-${pIdx}-${sIdx}`} style={style}>
						{segment.text}
					</span>,
				);
			}
		});

		nodes.push(
			<div key={`p-${pIdx}`} style={divStyle}>
				{children.length > 0 ? children : <br />}
			</div>,
		);
	});

	return nodes;
}
