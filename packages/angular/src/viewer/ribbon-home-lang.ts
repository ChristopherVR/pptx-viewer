import type { Signal } from '@angular/core';
/**
 * ribbon-home-lang.ts: runtime-locale plumbing for the shared Home elements.
 *
 * The shared elements call `translate` while they render, outside Angular's
 * dependency tracking. Reading {@link homeLanguage} inside a state method
 * makes an OnPush view re-derive its state (and so re-translate) whenever the
 * language or a dictionary changes; the snapshot translator resolves the
 * families' labels at that moment.
 */
import { toSignal } from '@angular/core/rxjs-interop';
import type { TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import { homeSnapshotTranslator } from '../internal/shared';
import type { RibbonHomeFamily } from '../internal/shared';

/** Changes on every language or dictionary update; must run in an injection context. */
export function homeLanguage(translation: TranslateService | null): Signal<number> {
	const changes = translation
		? merge(translation.onLangChange, translation.onTranslationChange).pipe(
				map(() => Date.now()),
				startWith(0),
			)
		: undefined;
	return changes ? toSignal(changes, { initialValue: 0 }) : ((() => 0) as Signal<number>);
}

/** A translator for `families` resolved now, so a locale switch re-translates their labels. */
export function homeTranslator(
	translation: TranslateService | null,
	language: Signal<number>,
	families: readonly RibbonHomeFamily[],
): (key: string) => string {
	language();
	return homeSnapshotTranslator(families, (key) => translation?.instant(key) ?? key);
}
