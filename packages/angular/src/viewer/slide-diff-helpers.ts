/**
 * slide-diff-helpers.ts: Pure label / icon helpers for the slide-diff row and
 * its change list. Framework-free so they are unit testable in isolation.
 *
 * `statusLabel` / `changeCountLabel` accept an optional `TranslateService` so
 * callers with access to one get translated text; callers without one (e.g.
 * plain unit tests) still get the English fallback.
 */

import type { TranslateService } from '@ngx-translate/core';

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
export function statusLabel(status: SlideDiff['status'], translate?: TranslateService): string {
	switch (status) {
		case 'added':
			return translate ? translate.instant('pptx.compare.statusAdded') : 'Added';
		case 'removed':
			return translate ? translate.instant('pptx.compare.statusRemoved') : 'Removed';
		case 'changed':
			return translate ? translate.instant('pptx.compare.statusChanged') : 'Changed';
		default:
			return translate ? translate.instant('pptx.compare.statusUnchanged') : 'Unchanged';
	}
}

/** "N change" / "N changes" summary for a diff's change count. */
export function changeCountLabel(count: number, translate?: TranslateService): string {
	if (translate) {
		return translate.instant('pptx.slideDiff.changeCount', { count });
	}
	return `${count} ${count === 1 ? 'change' : 'changes'}`;
}

/** 1-based slide number for a diff, preferring the base index when present. */
export function slideNumberOf(diff: SlideDiff): number {
	return diff.baseIndex >= 0 ? diff.baseIndex + 1 : diff.compareIndex + 1;
}
