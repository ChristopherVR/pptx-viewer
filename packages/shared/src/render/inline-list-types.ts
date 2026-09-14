import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';

import type { RenderParagraph } from './paragraph-types';

/** Current editor payload. Missing segments explicitly denotes plain-text fallback. */
export interface InlineTextEditSnapshot {
	elementId: string;
	text: string;
	textSegments?: TextSegment[];
}

export interface InlineListRun {
	token: string;
	segmentIndex: number;
	text: string;
	style: Readonly<TextStyle>;
	isLineBreak?: true;
}

export interface InlineListParagraph {
	token: string;
	sourceIndex: number;
	runs: readonly InlineListRun[];
	presentation: RenderParagraph;
}

/** Descriptor identity also identifies the private provenance registry. */
export interface InlineListSeed {
	elementId: string;
	paragraphs: readonly InlineListParagraph[];
}

export type InlineListParagraphFormat = Pick<
	TextSegment,
	'bulletInfo' | 'paragraphLevel' | 'paragraphProperties'
>;

export type InlineListReadResult =
	| { kind: 'supported'; snapshot: InlineTextEditSnapshot; paragraphs: RenderParagraph[] }
	| { kind: 'unsupported'; reason: string; text: string };

/** Internal state is not exported from the package barrel. */
export interface InlineListSession {
	element: PptxElement;
	segments: TextSegment[];
	originalSegments: TextSegment[];
	paragraphs: Array<{ segments: TextSegment[]; terminator?: TextSegment }>;
	paragraphNodes: WeakMap<Node, number>;
	runNodes: WeakMap<Node, number>;
	boundParagraphs: Set<number>;
	boundRuns: Set<number>;
	paragraphTokens: Map<string, number>;
	runTokens: Map<string, number>;
	runCss: Map<number, string>;
	runHtml: Map<number, string>;
	runChildren: Map<number, Node[]>;
	formats: Map<string, InlineListParagraphFormat>;
}
