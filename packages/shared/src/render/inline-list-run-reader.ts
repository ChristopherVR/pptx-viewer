import type { TextSegment, TextStyle } from 'pptx-viewer-core';

import { inlineListStyleDelta } from './inline-list-run-style';
import { inlineListDescendants } from './inline-list-seed';
import type { InlineListSession } from './inline-list-types';

function bodyOnly(segment: TextSegment): TextSegment {
	const result = { ...segment };
	delete result.bulletInfo;
	delete result.paragraphLevel;
	delete result.paragraphProperties;
	delete result.endParaRunProperties;
	delete result.paragraphInsertionStyle;
	return result;
}

/** Reads authored inline nodes only; no writes and no computed-style flattening. */
export function readInlineListRuns(
	session: InlineListSession,
	block: HTMLElement,
	bodyStyle?: TextStyle,
): { runs: TextSegment[]; unchanged: boolean } | undefined {
	const runs: TextSegment[] = [];
	let unsupported = false;
	let unchanged = true;
	let placeholder = false;
	const walk = (node: Node, inherited?: TextStyle, parentDelta: TextStyle = {}): void => {
		if (node.nodeType === 3) {
			if (node.nodeValue) {
				unchanged = false;
				if (!inherited) {
					unsupported = true;
				} else {
					runs.push({ text: node.nodeValue, style: { ...inherited, ...parentDelta } });
				}
			}
			return;
		}
		if (!(node instanceof HTMLElement)) {
			return;
		}
		if (node.hasAttribute('data-pptx-bullet-marker') || node.tagName === 'RT') {
			return;
		}
		const originalIndex = session.runNodes.get(node);
		const tokenIndex = session.runTokens.get(node.dataset.pptxListRun ?? '');
		const index = tokenIndex ?? originalIndex;
		const source = index === undefined ? undefined : session.segments[index];
		const original = originalIndex === undefined ? undefined : session.segments[originalIndex];
		const inheritedDelta = tokenIndex === undefined ? parentDelta : {};
		const delta =
			node === block
				? inheritedDelta
				: {
						...inheritedDelta,
						...inlineListStyleDelta(
							node,
							(index === undefined ? undefined : session.runCss.get(index)) ??
								(originalIndex === undefined ? '' : session.runCss.get(originalIndex)),
							{ ...(source?.style ?? inherited), ...inheritedDelta }.color,
						),
					};
		const style = { ...(source?.style ?? inherited), ...delta };
		const children = inlineListDescendants(node);
		const oldChildren =
			originalIndex === undefined ? undefined : session.runChildren.get(originalIndex);
		const intact =
			originalIndex !== undefined &&
			node.innerHTML === session.runHtml.get(originalIndex) &&
			children.length === oldChildren?.length &&
			children.every((child, childIndex) => child === oldChildren[childIndex]);
		if (intact && original) {
			runs.push({ ...bodyOnly(original), style });
			unchanged &&= index === originalIndex && Object.keys(delta).length === 0;
			return;
		}
		if (source) {
			unchanged = false;
		}
		if (
			node !== block &&
			!['SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'A', 'FONT', 'RUBY', 'BR'].includes(
				node.tagName,
			)
		) {
			unsupported = true;
			return;
		}
		if (node.tagName === 'BR') {
			runs.push({ text: '\n', style, isLineBreak: true });
			placeholder = original?.isLineBreak !== true;
			return;
		}
		for (const child of Array.from(node.childNodes)) {
			walk(child, source?.style ?? inherited, delta);
		}
	};
	walk(block, bodyStyle);
	if (runs.length === 1 && runs[0].isLineBreak && placeholder) {
		return { runs: [{ text: '', style: runs[0].style }], unchanged: false };
	}
	return unsupported ? undefined : { runs, unchanged };
}
