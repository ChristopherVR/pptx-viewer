/**
 * slide-diff-helpers.ts: Pure label / icon helpers for the slide-diff row and
 * its change list. Framework-free so they are unit testable in isolation.
 */

import type { ElementChange, SlideDiff } from '../internal/shared';

/** Single-character glyph for a per-element change kind. */
export function changeIcon(kind: ElementChange['kind']): string {
	switch (kind) {
		case 'added':
			return '+';
		case 'removed':
			return '-';
		case 'moved':
		case 'resized':
			return '⇄';
		case 'textChanged':
			return 'T';
		default:
			return '•';
	}
}

/** Human-readable status pill label for a slide diff. */
export function statusLabel(status: SlideDiff['status']): string {
	switch (status) {
		case 'added':
			return 'Added';
		case 'removed':
			return 'Removed';
		case 'changed':
			return 'Changed';
		default:
			return 'Unchanged';
	}
}

/** "N change" / "N changes" summary for a diff's change count. */
export function changeCountLabel(count: number): string {
	return `${count} ${count === 1 ? 'change' : 'changes'}`;
}

/** 1-based slide number for a diff, preferring the base index when present. */
export function slideNumberOf(diff: SlideDiff): number {
	return diff.baseIndex >= 0 ? diff.baseIndex + 1 : diff.compareIndex + 1;
}
