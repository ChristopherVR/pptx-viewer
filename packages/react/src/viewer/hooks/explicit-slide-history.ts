import type { EditorHistorySnapshot } from '../types';
import { cloneHistorySnapshot } from '../utils/clone';

function historyElementContent(
	element: EditorHistorySnapshot['slides'][number]['elements'][number],
): EditorHistorySnapshot['slides'][number]['elements'][number] {
	return {
		...element,
		// Saving refreshes these archive-only fields in place. They are needed by
		// serialization, but neither one represents a user edit.
		rawXml: undefined,
		shapeId: undefined,
		...(element.type === 'group' ? { children: element.children.map(historyElementContent) } : {}),
	};
}

/**
 * The part of a history snapshot that IS the document.
 *
 * `activeSlideIndex` is deliberately excluded. It rides along in the STORED
 * snapshot so undo/redo return the user to the slide the edit happened on, but
 * it must never take part in deciding whether the deck changed: clicking a
 * thumbnail reassigns nothing but the index, and comparing the whole snapshot
 * made that read as a document mutation. The consequences were both visible to
 * the user - the deck was marked dirty, so autosave wrote a crash-recovery
 * snapshot and the next visit offered to "recover unsaved changes" for a deck
 * that had only been read, and every slide click pushed an undo entry, so
 * Ctrl+Z walked back through navigation instead of edits. Angular and Vanilla
 * raise dirty from explicit commit choke points and never had either symptom.
 *
 * Note this is only the CHANGE GATE: an edit still announces itself through
 * `markDirty()` the moment it commits, so narrowing the comparison cannot
 * swallow an edit made immediately after a navigation.
 */
export function serializeHistoryDocument(snapshot: EditorHistorySnapshot): string {
	return JSON.stringify({
		width: snapshot.width,
		height: snapshot.height,
		slides: snapshot.slides.map((slide) => ({
			...slide,
			rawXml: undefined,
			elements: slide.elements.map(historyElementContent),
		})),
		templateElementsBySlideId: Object.fromEntries(
			Object.entries(snapshot.templateElementsBySlideId).map(([slideId, elements]) => [
				slideId,
				elements.map(historyElementContent),
			]),
		),
	});
}

/** Record pending ordinary edits, then the explicit batch, as separate entries. */
export function recordExplicitSlideUpdate(
	past: EditorHistorySnapshot[],
	future: EditorHistorySnapshot[],
	previous: EditorHistorySnapshot | null,
	before: EditorHistorySnapshot,
	label: string | undefined,
	maxDepth: number,
): void {
	if (previous && serializeHistoryDocument(previous) !== serializeHistoryDocument(before)) {
		past.push(cloneHistorySnapshot(previous));
	}
	past.push({ ...cloneHistorySnapshot(before), actionLabel: label });
	while (past.length > Math.max(1, maxDepth)) {
		past.shift();
	}
	future.length = 0;
}
