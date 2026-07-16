import type { MediaBookmark } from 'pptx-viewer-core';

export function appendMediaBookmark(
	bookmarks: readonly MediaBookmark[],
	trimStartMs: number,
	id: string,
): MediaBookmark[] {
	return [
		...bookmarks,
		{ id, label: `Bookmark ${bookmarks.length + 1}`, time: trimStartMs / 1000 },
	];
}
