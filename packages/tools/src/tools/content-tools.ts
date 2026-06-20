import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElementWithText, TablePptxElement } from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';
import { validateSlideIndex } from './helpers.js';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Maximum allowed user-supplied regex source length. */
const MAX_REGEX_LEN = 200;

/**
 * Reject patterns containing nested unbounded quantifiers, the classic
 * "evil regex" shape (e.g. `(a+)+`, `(a*)+`, `(a+)*`) that produces
 * exponential backtracking.
 */
function hasNestedUnboundedQuantifier(pattern: string): boolean {
	// Match a parenthesised group whose body ends with `+` or `*`, immediately
	// followed by another `+` or `*` outside the group.
	return /\([^)]*[+*]\)[+*]/u.test(pattern);
}

function buildSearchRegex(query: string, useRegex: boolean, caseSensitive: boolean): RegExp | null {
	if (useRegex) {
		if (query.length > MAX_REGEX_LEN) {
			return null;
		}
		if (hasNestedUnboundedQuantifier(query)) {
			return null;
		}
	}
	const pattern = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
	const flags = caseSensitive ? 'g' : 'gi';
	try {
		return new RegExp(pattern, flags);
	} catch {
		return null;
	}
}

// ── findText ─────────────────────────────────────────────────────────────────

export interface FindTextParams {
	query: string;
	useRegex?: boolean;
	caseSensitive?: boolean;
	slideIndexes?: number[];
}

export interface TextMatch {
	slideIndex: number;
	elementId: string;
	elementType: string;
	matchedText: string;
	context: string;
}

export interface FindTextResult {
	query: string;
	matchCount: number;
	matches: TextMatch[];
}

export function findText(ctx: ToolContext, params: FindTextParams): ToolResult<FindTextResult> {
	const regex = buildSearchRegex(
		params.query,
		params.useRegex === true,
		params.caseSensitive === true,
	);

	// Invalid / unsafe regex: return empty result rather than throwing.
	if (!regex) {
		return {
			pptxData: ctx.pptxData,
			dirty: false,
			result: { query: params.query, matchCount: 0, matches: [] },
		};
	}

	const targetIndexes = params.slideIndexes
		? params.slideIndexes
		: ctx.pptxData.slides.map((_, i) => i);

	const matches: TextMatch[] = [];

	for (const si of targetIndexes) {
		const err = validateSlideIndex(si, ctx.pptxData.slides.length);
		if (err) {
			throw new Error(err);
		}

		const slide = ctx.pptxData.slides[si];

		for (const el of slide.elements) {
			if (hasTextProperties(el)) {
				const textEl = el as PptxElementWithText;
				if (textEl.text) {
					const localMatches = Array.from(textEl.text.matchAll(regex));
					for (const m of localMatches) {
						matches.push({
							slideIndex: si,
							elementId: el.id,
							elementType: el.type,
							matchedText: m[0],
							context: textEl.text.slice(
								Math.max(0, (m.index ?? 0) - 20),
								(m.index ?? 0) + m[0].length + 20,
							),
						});
					}
				}
			}

			if (el.type === 'table') {
				const tbl = el as TablePptxElement;
				if (tbl.tableData) {
					for (const row of tbl.tableData.rows) {
						for (const cell of row.cells) {
							if (cell.text) {
								const localMatches = Array.from(cell.text.matchAll(regex));
								for (const m of localMatches) {
									matches.push({
										slideIndex: si,
										elementId: el.id,
										elementType: 'table-cell',
										matchedText: m[0],
										context: cell.text.slice(
											Math.max(0, (m.index ?? 0) - 20),
											(m.index ?? 0) + m[0].length + 20,
										),
									});
								}
							}
						}
					}
				}
			}
		}

		// search notes
		if (slide.notes) {
			const noteMatches = Array.from(slide.notes.matchAll(regex));
			for (const m of noteMatches) {
				matches.push({
					slideIndex: si,
					elementId: 'notes',
					elementType: 'notes',
					matchedText: m[0],
					context: slide.notes.slice(
						Math.max(0, (m.index ?? 0) - 20),
						(m.index ?? 0) + m[0].length + 20,
					),
				});
			}
		}
	}

	return {
		pptxData: ctx.pptxData,
		dirty: false,
		result: {
			query: params.query,
			matchCount: matches.length,
			matches,
		},
	};
}

// ── replaceText ───────────────────────────────────────────────────────────────

export interface ReplaceTextParams {
	query: string;
	replacement: string;
	useRegex?: boolean;
	caseSensitive?: boolean;
	slideIndexes?: number[];
}

export interface ReplaceTextResult {
	query: string;
	replacement: string;
	replacementCount: number;
}

export function replaceText(
	ctx: ToolContext,
	params: ReplaceTextParams,
): ToolResult<ReplaceTextResult> {
	const regex = buildSearchRegex(
		params.query,
		params.useRegex === true,
		params.caseSensitive === true,
	);

	if (!regex) {
		return {
			pptxData: ctx.pptxData,
			dirty: false,
			result: { query: params.query, replacement: params.replacement, replacementCount: 0 },
		};
	}

	const targetIndexes = params.slideIndexes
		? params.slideIndexes
		: ctx.pptxData.slides.map((_, i) => i);

	let count = 0;

	for (const si of targetIndexes) {
		const err = validateSlideIndex(si, ctx.pptxData.slides.length);
		if (err) {
			throw new Error(err);
		}

		const slide = ctx.pptxData.slides[si];

		for (const el of slide.elements) {
			if (hasTextProperties(el)) {
				const textEl = el as PptxElementWithText;
				if (textEl.text) {
					const before = textEl.text;
					const after = before.replace(regex, params.replacement);
					if (after !== before) {
						const matchCount = Array.from(before.matchAll(regex)).length;
						count += matchCount;
						textEl.text = after;
						// update textSegments if present
						if (textEl.textSegments && textEl.textSegments.length > 0) {
							// rebuild first segment with updated text
							const firstSeg = textEl.textSegments[0];
							const updatedFirst = firstSeg.text.replace(regex, params.replacement);
							if (updatedFirst !== firstSeg.text) {
								firstSeg.text = updatedFirst;
							} else {
								// spread the whole new text across the first segment
								textEl.textSegments = [{ text: after, style: firstSeg.style }];
							}
						}
					}
				}
			}

			if (el.type === 'table') {
				const tbl = el as TablePptxElement;
				if (tbl.tableData) {
					for (const row of tbl.tableData.rows) {
						for (const cell of row.cells) {
							if (cell.text) {
								const before = cell.text;
								const after = before.replace(regex, params.replacement);
								if (after !== before) {
									count += Array.from(before.matchAll(regex)).length;
									cell.text = after;
								}
							}
						}
					}
				}
			}
		}

		if (slide.notes) {
			const before = slide.notes;
			const after = before.replace(regex, params.replacement);
			if (after !== before) {
				count += Array.from(before.matchAll(regex)).length;
				slide.notes = after;
			}
		}
	}

	return {
		pptxData: ctx.pptxData,
		dirty: count > 0,
		result: {
			query: params.query,
			replacement: params.replacement,
			replacementCount: count,
		},
	};
}

// ── manageComments ────────────────────────────────────────────────────────────

export interface ManageCommentsParams {
	action: 'list' | 'add' | 'delete' | 'resolve';
	slideIndex?: number;
	text?: string;
	author?: string;
	commentId?: string;
	resolved?: boolean;
	includeResolved?: boolean;
}

export interface CommentInfo {
	id: string;
	slideIndex: number;
	text: string;
	author?: string;
	createdAt?: string;
	resolved?: boolean;
}

export interface ManageCommentsResult {
	action: string;
	comments?: CommentInfo[];
	commentId?: string;
	count?: number;
}

export function manageComments(
	ctx: ToolContext,
	params: ManageCommentsParams,
): ToolResult<ManageCommentsResult> {
	switch (params.action) {
		case 'list': {
			const all: CommentInfo[] = [];
			for (let si = 0; si < ctx.pptxData.slides.length; si++) {
				if (params.slideIndex !== undefined && si !== params.slideIndex) {
					continue;
				}
				const slide = ctx.pptxData.slides[si];
				for (const c of slide.comments ?? []) {
					if (!params.includeResolved && c.resolved) {
						continue;
					}
					all.push({
						id: c.id,
						slideIndex: si,
						text: c.text,
						author: c.author,
						createdAt: c.createdAt,
						resolved: c.resolved,
					});
				}
			}
			return {
				pptxData: ctx.pptxData,
				dirty: false,
				result: { action: 'list', comments: all, count: all.length },
			};
		}

		case 'add': {
			if (params.slideIndex === undefined) {
				throw new Error('slideIndex is required for add action.');
			}
			const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
			if (err) {
				throw new Error(err);
			}
			if (!params.text) {
				throw new Error('text is required for add action.');
			}
			const slide = ctx.pptxData.slides[params.slideIndex];
			if (!slide.comments) {
				slide.comments = [];
			}
			const newId = `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			slide.comments.push({
				id: newId,
				text: params.text,
				author: params.author,
				createdAt: new Date().toISOString(),
				resolved: false,
			});
			return {
				pptxData: ctx.pptxData,
				dirty: true,
				result: { action: 'add', commentId: newId },
			};
		}

		case 'delete': {
			if (!params.commentId) {
				throw new Error('commentId is required for delete action.');
			}
			let deleted = false;
			for (const slide of ctx.pptxData.slides) {
				if (!slide.comments) {
					continue;
				}
				const before = slide.comments.length;
				slide.comments = slide.comments.filter((c) => c.id !== params.commentId);
				if (slide.comments.length < before) {
					deleted = true;
					break;
				}
			}
			if (!deleted) {
				throw new Error(`Comment '${params.commentId}' not found.`);
			}
			return {
				pptxData: ctx.pptxData,
				dirty: true,
				result: { action: 'delete', commentId: params.commentId },
			};
		}

		case 'resolve': {
			if (!params.commentId) {
				throw new Error('commentId is required for resolve action.');
			}
			let found = false;
			for (const slide of ctx.pptxData.slides) {
				const comment = slide.comments?.find((c) => c.id === params.commentId);
				if (comment) {
					comment.resolved = params.resolved !== false;
					found = true;
					break;
				}
			}
			if (!found) {
				throw new Error(`Comment '${params.commentId}' not found.`);
			}
			return {
				pptxData: ctx.pptxData,
				dirty: true,
				result: { action: 'resolve', commentId: params.commentId },
			};
		}

		default: {
			throw new Error(`Unknown action: ${String(params.action)}`);
		}
	}
}
