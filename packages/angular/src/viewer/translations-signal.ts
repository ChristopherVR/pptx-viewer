import type { Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { TranslateService } from '@ngx-translate/core';
import { map, merge, startWith } from 'rxjs';

/**
 * A signal that changes whenever the language or its dictionary does, so an
 * OnPush adapter that hands translated state to a shared `pptx-ui-*` element
 * re-translates it. Call it in an injection context (a field initializer).
 */
export function translationsSignal(translate: TranslateService): Signal<number> {
	return toSignal(
		merge(translate.onLangChange, translate.onTranslationChange).pipe(
			map(() => Date.now()),
			startWith(0),
		),
		{ initialValue: 0 },
	);
}
