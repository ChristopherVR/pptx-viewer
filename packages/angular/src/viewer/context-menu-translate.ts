/**
 * Translation for the menus' view state.
 *
 * The shared `pptx-ui-context-menu` takes already-translated rows, so the
 * components build their state in `computed()`. Reading the returned function
 * subscribes that computed to language and dictionary changes, which is what the
 * `translate` pipe did for the old templates. Without a `TranslateService` (a
 * bare injector in a unit test) labels fall back to their keys.
 */
import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { map, merge, startWith } from 'rxjs';

export type MenuTranslate = (key: string, params?: Record<string, string | number>) => string;

/** Call from an injection context (a component field initializer). */
export function injectMenuTranslate(): MenuTranslate {
	const translate = inject(TranslateService, { optional: true });
	if (!translate) {
		return (key) => key;
	}
	const revision = toSignal(
		merge(translate.onLangChange, translate.onTranslationChange).pipe(
			map(() => Date.now()),
			startWith(0),
		),
		{ initialValue: 0 },
	);
	return (key, params) => {
		revision();
		return translate.instant(key, params) as string;
	};
}
