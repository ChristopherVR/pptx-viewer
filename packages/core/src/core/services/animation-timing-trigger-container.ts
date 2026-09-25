/**
 * Which trigger container an effect lives in (the click sequence, a shape's
 * interactive sequence, or a media bookmark's), and which one an editor
 * animation asks for.
 *
 * The surgical timing writer patches an existing effect in place, which is
 * right for timing edits but wrong when the TRIGGER changed containers: an
 * effect switched from "On click" to "On bookmark" has to leave the main
 * sequence for a bookmark-gated interactive sequence, or PowerPoint keeps
 * playing it on the click. Comparing these two keys is how that is detected.
 *
 * @module services/animation-timing-trigger-container
 */
import type { PptxElementAnimation } from '../types';
import type { EffectNodeRef } from './animation-timing-tree';
import { bookmarkTriggerOf } from './animation-write-bookmark-sequence';
import {
	extractBookmarkTrigger,
	extractTriggerShapeId,
	isXmlObject,
} from './native-animation-helpers';

const MAIN = 'main';

function bookmarkKey(shapeId: string, bookmarkName: string): string {
	return `bmk:${shapeId}\u0000${bookmarkName}`;
}

/** The trigger container an existing effect node sits in. */
export function triggerContainerOf(ref: EffectNodeRef): string {
	for (const link of ref.chain) {
		const cTn = link.node['p:cTn'];
		if (!isXmlObject(cTn) || cTn['@_nodeType'] !== 'interactiveSeq') {
			continue;
		}
		const bookmark = extractBookmarkTrigger(cTn);
		if (bookmark) {
			return bookmarkKey(bookmark.shapeId, bookmark.bookmarkName);
		}
		const shapeId = extractTriggerShapeId(cTn);
		return shapeId ? `shape:${shapeId}` : MAIN;
	}
	return MAIN;
}

/**
 * The trigger container an editor animation asks for, or `undefined` when it
 * does not say (no trigger recorded, or an interactive trigger still missing
 * its shape / bookmark): such an effect is left wherever it already is.
 */
export function desiredTriggerContainer(anim: PptxElementAnimation): string | undefined {
	switch (anim.trigger) {
		case undefined:
			return undefined;
		case 'onShapeClick':
			return anim.triggerShapeId ? `shape:${anim.triggerShapeId}` : undefined;
		case 'onMediaBookmark': {
			const key = bookmarkTriggerOf(anim);
			return key ? bookmarkKey(key.shapeId, key.bookmarkName) : undefined;
		}
		default:
			return MAIN;
	}
}
