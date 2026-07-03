/**
 * collaboration-text-merge.ts: character-level in-place merging of a desired
 * text state into a live Y.Text.
 *
 * `reconcileTextBody` used to replace the whole Y.Text whenever the canonical
 * decoded form differed, which made concurrent edits to the SAME text element
 * collide at element granularity (last writer wins). This module instead
 * applies a minimal edit script to the existing Y.Text:
 *
 *  - plain-text diff via common prefix/suffix (surrogate-pair safe): one
 *    delete + attributed inserts for the changed middle span
 *  - attribute reconcile: walk the current and desired attribute runs by
 *    position and `format()` only the ranges whose attributes differ
 *
 * Because each peer submits a minimal delta, Yjs merges concurrent edits to
 * the same run at character granularity (e.g. one peer prepends while another
 * appends, both survive).
 */

import type { DeltaOp, YTextLike } from './collaboration-text-codec';
import { isYTextLike } from './collaboration-text-codec';

/** Y.Text surface needed for in-place edits (delete/format on top of insert). */
export interface YTextEditableLike extends YTextLike {
	delete: (index: number, length: number) => void;
	format: (index: number, length: number, attributes: Record<string, string | null>) => void;
}

export function isYTextEditable(value: unknown): value is YTextEditableLike {
	return (
		isYTextLike(value) &&
		typeof (value as YTextEditableLike).delete === 'function' &&
		typeof (value as YTextEditableLike).format === 'function'
	);
}

const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number): boolean => code >= 0xdc00 && code <= 0xdfff;

function opsText(ops: DeltaOp[]): string {
	let text = '';
	for (const op of ops) {
		if (typeof op.insert === 'string') {
			text += op.insert;
		}
	}
	return text;
}

function commonPrefixLength(a: string, b: string): number {
	const max = Math.min(a.length, b.length);
	let i = 0;
	while (i < max && a.charCodeAt(i) === b.charCodeAt(i)) {
		i++;
	}
	// Never cut between a surrogate pair.
	if (i > 0 && isHighSurrogate(a.charCodeAt(i - 1))) {
		i--;
	}
	return i;
}

function commonSuffixLength(a: string, b: string, prefix: number): number {
	const max = Math.min(a.length, b.length) - prefix;
	let i = 0;
	while (i < max && a.charCodeAt(a.length - i - 1) === b.charCodeAt(b.length - i - 1)) {
		i++;
	}
	if (i > 0 && isLowSurrogate(a.charCodeAt(a.length - i))) {
		i--;
	}
	return i;
}

/**
 * Insert the desired-text span [from, to) into `ytext`, carrying each desired
 * op's attributes so no character inherits formatting from its neighbour.
 */
function insertSpanWithAttrs(
	ytext: YTextEditableLike,
	desiredOps: DeltaOp[],
	from: number,
	to: number,
): void {
	let opStart = 0;
	let index = from;
	for (const op of desiredOps) {
		if (typeof op.insert !== 'string') {
			continue;
		}
		const opEnd = opStart + op.insert.length;
		const start = Math.max(opStart, from);
		const end = Math.min(opEnd, to);
		if (start < end) {
			const chunk = op.insert.slice(start - opStart, end - opStart);
			// Explicit attrs always: attribute-less inserts inherit the previous
			// character's formatting in Yjs (the style-bleed bug).
			ytext.insert(index, chunk, (op.attributes ?? {}) as Record<string, string>);
			index += chunk.length;
		}
		opStart = opEnd;
	}
}

function attrsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
	const aKeys = Object.keys(a);
	if (aKeys.length !== Object.keys(b).length) {
		return false;
	}
	return aKeys.every((k) => a[k] === b[k]);
}

/**
 * Bring the attribute runs of `ytext` (whose plain text already matches the
 * desired ops) in line with the desired attributes, formatting only the
 * ranges that differ.
 */
function reconcileAttributeRuns(ytext: YTextEditableLike, desiredOps: DeltaOp[]): void {
	const currentOps = ytext.toDelta().filter((op) => typeof op.insert === 'string');
	let ci = 0;
	let cOff = 0;
	let pos = 0;
	for (const dop of desiredOps) {
		if (typeof dop.insert !== 'string') {
			continue;
		}
		const dAttrs = (dop.attributes ?? {}) as Record<string, string>;
		let remaining = dop.insert.length;
		while (remaining > 0 && ci < currentOps.length) {
			const cText = currentOps[ci].insert as string;
			const len = Math.min(cText.length - cOff, remaining);
			const cAttrs = (currentOps[ci].attributes ?? {}) as Record<string, string>;
			if (!attrsEqual(cAttrs, dAttrs)) {
				const patch: Record<string, string | null> = {};
				for (const key of Object.keys(dAttrs)) {
					if (cAttrs[key] !== dAttrs[key]) {
						patch[key] = dAttrs[key];
					}
				}
				for (const key of Object.keys(cAttrs)) {
					if (!(key in dAttrs)) {
						patch[key] = null;
					}
				}
				ytext.format(pos, len, patch);
			}
			pos += len;
			remaining -= len;
			cOff += len;
			if (cOff >= cText.length) {
				ci++;
				cOff = 0;
			}
		}
	}
}

/**
 * Apply the minimal edit script that turns the live `ytext` into the state
 * described by `desiredOps`. Returns false (leaving the caller to fall back
 * to wholesale replacement) if the text diff did not converge.
 *
 * Must be called inside a Y.Doc transaction when the text is integrated.
 */
export function mergeDeltaIntoYText(ytext: YTextEditableLike, desiredOps: DeltaOp[]): boolean {
	const currentText = opsText(ytext.toDelta());
	const desiredText = opsText(desiredOps);

	if (currentText !== desiredText) {
		const prefix = commonPrefixLength(currentText, desiredText);
		const suffix = commonSuffixLength(currentText, desiredText, prefix);
		const deleteLen = currentText.length - prefix - suffix;
		if (deleteLen > 0) {
			ytext.delete(prefix, deleteLen);
		}
		insertSpanWithAttrs(ytext, desiredOps, prefix, desiredText.length - suffix);
		if (opsText(ytext.toDelta()) !== desiredText) {
			return false;
		}
	}

	reconcileAttributeRuns(ytext, desiredOps);
	return true;
}
