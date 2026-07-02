/**
 * @ngx-translate/core configuration for the pptx-viewer Angular demo.
 *
 * The viewer components use ngx-translate (the `translate()` signal function
 * and `TranslatePipe`) for UI labels. This wires up a root TranslateService
 * with English translations and a fallback that derives display text from
 * dotted keys (e.g. "pptx.sections.addSlide" -> "Add Slide") for any key not
 * explicitly defined, mirroring the React/Vue demos.
 */
import type { Provider } from '@angular/core';
import { Injectable } from '@angular/core';
import type {
	MissingTranslationHandler,
	MissingTranslationHandlerParams,
} from '@ngx-translate/core';
import { provideTranslateService } from '@ngx-translate/core';
import { keyToLabel } from 'pptx-angular-viewer';

@Injectable()
class LabelFallbackMissingTranslationHandler implements MissingTranslationHandler {
	handle(params: MissingTranslationHandlerParams): string {
		return keyToLabel(params.key);
	}
}

export const i18nProviders: Provider[] = provideTranslateService({
	lang: 'en',
	fallbackLang: 'en',
	missingTranslationHandler: LabelFallbackMissingTranslationHandler,
});
