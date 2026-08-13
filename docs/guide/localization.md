---
title: Localization (i18n)
description: How pptx-viewer's UI strings work across React, Vue 3, Angular, Vanilla, and Svelte, how to add a language in your app, and how to contribute a translation.
---

# Localization (i18n)

**The viewer looks up every UI label through a `pptx.*` translation key; your app supplies the dictionary.** Each binding ships English. This repository also maintains complete French, Spanish, and German reference dictionaries in the private `pptx-viewer-locales` workspace for its demos and translation QA. That workspace is not published to npm. React, Vue, and Angular delegate to their host framework's own i18n library; Vanilla and Svelte ship a small built-in translator:

| Binding | Translation call the viewer makes                        | Library you provide                                                               |
| ------- | -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| React   | `react-i18next`'s `t(key, opts)`                         | [i18next](https://www.i18next.com/) / [react-i18next](https://react.i18next.com/) |
| Vue 3   | `vue-i18n`'s `useI18n().t(key, opts)`                    | [vue-i18n](https://vue-i18n.intlify.dev/)                                         |
| Angular | `ngx-translate`'s `translate()` signal / `TranslatePipe` | [@ngx-translate/core](https://github.com/ngx-translate/core)                      |
| Vanilla | The package's own built-in `t(key, params)`              | none: pass a `messages` dictionary directly, no i18n library needed               |
| Svelte  | The package's own built-in `t(key, params)`              | none: call `registerTranslations(locale, dict)`, no i18n library needed           |

This keeps the viewer idiomatic for each ecosystem (you plug React/Vue/Angular into whatever i18n setup your app already has; Vanilla/Svelte need nothing extra) instead of forcing a translation runtime dependency onto bindings that don't already have one.

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

```ts
// Vanilla: exported from the package root, like Angular
import { translationsEn, keyToLabel } from 'pptx-vanilla-viewer';
```

```ts
// Svelte: subpath export, like React/Vue
import { translationsEn, keyToLabel } from 'pptx-svelte-viewer/i18n';
```

`translationsEn` is a flat `Record<string, string>` of every `pptx.*` key (3,396 of them), e.g. `'pptx.statusBar.allSaved': 'All saved'`. Values with dynamic content use `{{token}}` interpolation placeholders, e.g. `'pptx.statusBar.slideOf': 'Slide {{current}} of {{total}}'` - your i18n library substitutes these from the `opts` passed to `t()`/`translate()`.

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

### Vanilla

The Vanilla binding has no framework to plug an i18n library into, so it ships a tiny built-in translator: pass a `messages` dictionary keyed by locale directly to `createPptxViewer`, no separate wiring step.

```ts
import { createPptxViewer } from 'pptx-vanilla-viewer';
import { translationsFr } from './translations/fr';

const viewer = createPptxViewer(document.querySelector('#host')!, {
	source: '/deck.pptx',
	locale: 'fr',
	messages: { fr: translationsFr },
});
```

`messages` maps a locale to a flat `Record<string, string>` of `pptx.*` overrides; you don't need to include every key or spread `translationsEn` yourself, since English is always the fallback for anything missing. Switch languages at runtime with `viewer.setLocale('fr')` (this rebuilds the chrome's static labels under the new locale and re-renders).

### Svelte

Svelte also has no blessed i18n runtime, so the binding exposes `registerTranslations` from its `/i18n` subpath: register each locale's dictionary once at startup, then pass the active `locale` as a prop.

```ts
// i18n.ts
import { registerTranslations } from 'pptx-svelte-viewer/i18n';
import { translationsFr } from './translations/fr';

registerTranslations('fr', translationsFr);
```

```svelte
<!-- App.svelte -->
<script lang="ts">
	import { PowerPointViewer } from 'pptx-svelte-viewer';
	import './i18n';

	let locale = $state('fr');
	let source = $state<Uint8Array>();
	// ...fetch/read the .pptx bytes into `source` however your app loads files
</script>

<PowerPointViewer {source} {locale} />
```

Registrations merge over whatever is already registered for that locale, so you can call `registerTranslations` more than once (e.g. once per feature area) without clobbering earlier overrides. As with Vanilla, English is always the fallback for keys you haven't translated yet.

## File > Options > Language

Every binding's Settings dialog also has a **Language** tab: a list of locales the user can pick from at runtime, right next to the [Appearance](/guide/theming) tab. It never bundles or fetches translation content itself - it only offers a UI to switch between locales _you've already registered_ with whichever i18n setup you wired up above. Concretely, when you don't supply `availableLocales` yourself, each binding introspects what's already loaded:

| Binding | How it discovers available locales                                            |
| ------- | ----------------------------------------------------------------------------- |
| React   | `i18n.options.resources` / `i18n.languages` from the `react-i18next` instance |
| Vue 3   | `useI18n().availableLocales` (a built-in `vue-i18n` composable property)      |
| Angular | `TranslateService.getLangs()`                                                 |
| Vanilla | the `messages` dictionary passed to `createPptxViewer`, plus `'en'`           |
| Svelte  | every locale passed to `registerTranslations`                                 |

So if you've only ever registered `en` and `fr`, the Language tab offers exactly those two - never a locale with no dictionary behind it. Codes are labeled via the shared `LOCALE_CATALOG` (English/French/Spanish/German display names) when recognized, or shown as the raw code otherwise.

Precedence mirrors the Appearance tab: a picked locale applies immediately by calling into your i18n instance directly (`i18n.changeLanguage`, `locale.value =`, `TranslateService.use`, etc.) and persists to `localStorage` (`pptx-viewer-prefs`) - unless you pass `onLocaleChange`, in which case the viewer never touches your i18n instance itself and only calls that callback, leaving persistence and application entirely up to you. See [Theming](/guide/theming) for the full `defaultLocale`/`availableLocales`/`onLocaleChange` prop reference (same shape as the theme props, documented there once rather than twice).

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

This is the pattern used by all five demo apps. See [Try it in the demos](#try-it-in-the-demos) below for working, end-to-end examples.

## Contributing a translation upstream

The private `packages/locales` workspace holds complete reference dictionaries.
Each language is organized into named product-area files such as `charts.ts`,
`presenting-and-slide-show.ts`, and `text-and-equations.ts`.

Native and fluent speakers can help without reviewing an entire dictionary:

1. Pick one product-area file under `packages/locales/src/fr`, `src/es`, or `src/de`.
2. Compare each value with the matching key in `packages/shared/src/i18n/translations-en.ts`.
3. Improve translated values while leaving dotted keys and every `{{token}}` placeholder unchanged.
4. Prefer terminology from the localized Microsoft PowerPoint UI, especially for SmartArt, morph transitions, charts, and master views.
5. Run `bun run --filter 'pptx-viewer-locales' test`, `typecheck`, and `build`, then identify the reviewed language and product areas in the pull request.

When English gains new keys, `bun run locales:generate` reads the existing
semantic files and preserves every valid translation, including reviewed values
that intentionally match English. It fills only missing entries or entries with
invalid placeholders. Review machine-assisted additions before committing them.
The generator fails if a new key prefix has not been assigned to a named section.

To add another language, add its locale entry point, generator configuration,
root export, and test case. Exact key parity and interpolation placeholders are
enforced by `packages/locales/src/locales.test.ts`.

## Try it in the demos

The [React](https://christophervr.github.io/pptx-viewer/demo/), [Vue](https://christophervr.github.io/pptx-viewer/demo-vue/), [Angular](https://christophervr.github.io/pptx-viewer/demo-angular/), Vanilla, and Svelte demos each include a language picker that switches between English, French, Spanish, and German. All three non-English dictionaries cover every canonical viewer key through the repository's private locale workspace.

The picker wiring is demo code; the dictionaries are referenced from `packages/locales` through the Bun workspace:

- **React**: `demos/demo-react/i18n.ts`, `LanguagePicker.tsx`
- **Vue**: `demos/demo-vue/src/i18n.ts`, `LanguagePicker.vue`
- **Angular**: `demos/demo-angular/src/i18n.ts`, `language-picker.component.ts`
- **Vanilla**: `demos/demo-vanilla/src/demo-i18n.ts`, `language-picker.ts`
- **Svelte**: `demos/demo-svelte/src/demo-i18n.svelte.ts`, `LanguagePicker.svelte`

## Next steps

- [Installation](/guide/installation) - peer dependencies, including `i18next`/`react-i18next`.
- [React Hooks](/react/hooks) - `t` is threaded through the hook layer if you need to call it outside the viewer's own components.
