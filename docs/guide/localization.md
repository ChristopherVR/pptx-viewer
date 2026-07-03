---
title: Localization (i18n)
description: How pptx-viewer's UI strings work across React, Vue 3, and Angular, how to add a language in your app, and how to contribute a translation.
---

# Localization (i18n)

Every UI label in the viewer (toolbar, ribbon, dialogs, inspector panels, context menus, the animation/chart/SmartArt editors, and so on) is looked up through a dotted `pptx.*` translation key rather than being hard-coded in English. **None of the three binding packages ships a translation library or a bundled set of languages.** Instead, each package calls its host framework's own i18n function against these keys, and your app supplies the dictionary and the library that resolves it:

| Framework | Translation call the viewer makes                        | Library you provide                                                               |
| --------- | -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| React     | `react-i18next`'s `t(key, opts)`                         | [i18next](https://www.i18next.com/) / [react-i18next](https://react.i18next.com/) |
| Vue 3     | `vue-i18n`'s `useI18n().t(key, opts)`                    | [vue-i18n](https://vue-i18n.intlify.dev/)                                         |
| Angular   | `ngx-translate`'s `translate()` signal / `TranslatePipe` | [@ngx-translate/core](https://github.com/ngx-translate/core)                      |

This keeps the viewer framework-idiomatic (you plug it into whatever i18n setup your app already has) instead of forcing a fourth translation runtime into your bundle.

## The English dictionary

Each package re-exports a ready-made English resource bundle so you don't have to author one from scratch:

```ts
// React and Vue: subpath export
import { translationsEn, keyToLabel } from 'pptx-react-viewer/i18n'; // or 'pptx-vue-viewer/i18n'
```

```ts
// Angular: exported from the package root, not a subpath
import { translationsEn, keyToLabel } from 'pptx-angular-viewer';
```

`translationsEn` is a flat `Record<string, string>` of every `pptx.*` key (over 1,600 of them), e.g. `'pptx.statusBar.allSaved': 'All saved'`. Values with dynamic content use `{{token}}` interpolation placeholders, e.g. `'pptx.statusBar.slideOf': 'Slide {{current}} of {{total}}'` - your i18n library substitutes these from the `opts` passed to `t()`/`translate()`.

`keyToLabel(key)` derives a readable label from a key's last segment when no dictionary entry matches it (`"pptx.slideSorter.zoomIn"` → `"Zoom In"`). Wire it in as your library's missing-key handler so any key you haven't translated yet still renders something reasonable instead of the raw key string.

## Wiring it up

### React

```ts
// i18n.ts
import { createInstance } from 'i18next';
import { translationsEn, keyToLabel } from 'pptx-react-viewer/i18n';
import { initReactI18next } from 'react-i18next';

const i18nInstance = createInstance();
i18nInstance.use(initReactI18next).init({
	resources: { en: { translation: translationsEn } },
	lng: 'en',
	fallbackLng: 'en',
	interpolation: { escapeValue: false }, // React already escapes
	parseMissingKeyHandler: (key: string) => keyToLabel(key),
	missingKeyHandler: false,
});

export default i18nInstance;
```

```tsx
// app entry
import i18nInstance from './i18n';
import { I18nextProvider } from 'react-i18next';

<I18nextProvider i18n={i18nInstance}>
	<App />
</I18nextProvider>;
```

Switch languages with `i18nInstance.changeLanguage('fr')`.

### Vue 3

```ts
// i18n.ts
import { translationsEn, keyToLabel } from 'pptx-vue-viewer/i18n';
import { createI18n } from 'vue-i18n';

const i18n = createI18n({
	legacy: false,
	locale: 'en',
	fallbackLocale: 'en',
	messages: { en: translationsEn },
	missing: (_locale, key) => keyToLabel(key),
	missingWarn: false,
	fallbackWarn: false,
});

export default i18n;
```

```ts
// main.ts
import { createApp } from 'vue';
import App from './App.vue';
import i18n from './i18n';

createApp(App).use(i18n).mount('#app');
```

Switch languages by setting `i18n.global.locale.value = 'fr'`.

### Angular

```ts
// i18n.ts
import { Injectable } from '@angular/core';
import type { MissingTranslationHandlerParams } from '@ngx-translate/core';
import { MissingTranslationHandler, provideTranslateService } from '@ngx-translate/core';
import { keyToLabel } from 'pptx-angular-viewer';

@Injectable()
class LabelFallbackMissingTranslationHandler implements MissingTranslationHandler {
	handle(params: MissingTranslationHandlerParams): string {
		return keyToLabel(params.key);
	}
}

export const i18nProviders = provideTranslateService({
	lang: 'en',
	fallbackLang: 'en',
	missingTranslationHandler: {
		provide: MissingTranslationHandler,
		useClass: LabelFallbackMissingTranslationHandler,
	},
});
```

```ts
// main.ts
bootstrapApplication(AppComponent, { providers: [i18nProviders] });
```

Register the English dictionary once (typically in your root component) and switch languages through `TranslateService`:

```ts
import { inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { translationsEn } from 'pptx-angular-viewer';

const translate = inject(TranslateService);
translate.setTranslation('en', translationsEn);
// later, to switch:
translate.use('fr');
```

::: tip Pass a plain `Provider` object, not a bare class
If you write your own `MissingTranslationHandler`, pass it as `{ provide: MissingTranslationHandler, useClass: YourHandler }` rather than a bare class reference. Under some build toolchains (Vite/Rolldown with standard decorators), ngx-translate's `isClass()` heuristic can misfire in production builds and invoke the handler without `new`, throwing at bootstrap.
:::

## Adding a language in your app

Translating the viewer into another language doesn't require touching this repo at all - it's exactly the same shape of work as translating any other part of your app. Build a dictionary with the same keys as `translationsEn` and register it as a second resource/locale/translation in whichever library your framework uses (`resources.fr` for i18next, `messages.fr` for vue-i18n, `translate.setTranslation('fr', ...)` for ngx-translate). You don't need every key on day one - anything you haven't translated yet falls back through `keyToLabel` automatically, so partial coverage degrades gracefully rather than showing blank labels or raw keys.

To catch missing/misspelled keys at compile time instead of relying on the runtime fallback, type your dictionary against the exported `TranslationKey` union rather than a bare `Record<string, string>`:

```ts
import type { TranslationKey } from 'pptx-react-viewer/i18n'; // 'pptx-vue-viewer/i18n', or from 'pptx-angular-viewer' root for Angular

export const translationsFr: Record<TranslationKey, string> = {
	'pptx.statusBar.allSaved': 'Tout enregistré',
	// TypeScript errors if you miss a key, misspell one, or add one that doesn't exist
	...
};
```

This is exactly the pattern used to add French and Spanish to the three demo apps - see [Try it in the demos](#try-it-in-the-demos) below for a working, end-to-end example you can copy from.

## Contributing a translation upstream

The packages only ship `translationsEn` today; there's no built-in registry of other locales; there is nothing stopping you from contributing one. To add a first-class language to `pptx-viewer-shared` (and therefore to all three bindings at once, since each bundles it in):

1. Add `packages/shared/src/i18n/translations-<code>.ts` (e.g. `translations-fr.ts`) that exports `translationsFr` (or your locale's name) typed as `Record<TranslationKey, string>`, importing `TranslationKey` from `./translations-en`. The type parameter alone will tell you (at typecheck time) about any key you're missing.
2. Translate every value, preserving `{{token}}` interpolation placeholders exactly and keeping the dotted keys unchanged.
3. Re-export it from `packages/shared/src/i18n/index.ts`, then from each binding's `i18n.ts` (React/Vue) and `public-api.ts` (Angular), mirroring how `translationsEn` is already re-exported.
4. Run `bun run typecheck` and `bun run test` from the repo root, and open a PR following the [commit conventions](https://github.com/ChristopherVR/pptx-viewer/blob/main/CLAUDE.md#commit-conventions) (e.g. `feat(shared): add French translation dictionary`).

Machine-translated first drafts are a reasonable starting point, but flag them as such in the PR - a native or fluent reviewer should confirm terminology before it ships to users, especially for domain-specific PowerPoint vocabulary (SmartArt, morph transitions, chart trendlines, and so on).

## Try it in the demos

The [React](https://christophervr.github.io/pptx-viewer/demo-react/), [Vue](https://christophervr.github.io/pptx-viewer/demo-vue/), and [Angular](https://christophervr.github.io/pptx-viewer/demo-angular/) demos each include a language picker (the globe icon next to the theme picker) that switches between English, French, and Spanish. The French/Spanish dictionaries translate the high-visibility core (status bar, toolbar, ribbon actions, dialogs, comments, presenter view, and so on) and fall back to English for less common panels not yet overridden - a realistic example of the graceful, partial-coverage rollout described above, not a claim of 100% coverage. It's a demo-only feature - the picker component and the dictionaries live in each `demos/demo-*` app, not in the published packages - but its source is a complete, working reference for wiring up multi-language support: `demos/demo-react/i18n.ts` + `i18n-locales.ts` + `LanguagePicker.tsx`, `demos/demo-vue/src/i18n.ts` + `i18n-locales.ts` + `LanguagePicker.vue`, and `demos/demo-angular/src/i18n.ts` + `i18n-locales.ts` + `language-picker.component.ts`.

## Next steps

- [Installation](/guide/installation) - peer dependencies, including `i18next`/`react-i18next`.
- [React Hooks](/react/hooks) - `t` is threaded through the hook layer if you need to call it outside the viewer's own components.
