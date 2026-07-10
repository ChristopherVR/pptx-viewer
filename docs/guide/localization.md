---
title: Localization (i18n)
description: How pptx-viewer's UI strings work across React, Vue 3, Angular, Vanilla, and Svelte, how to add a language in your app, and how to contribute a translation.
---

# Localization (i18n)

**The viewer looks up every UI label through a `pptx.*` translation key; your app supplies the dictionary.** No binding ships a bundled language other than English. React, Vue, and Angular delegate to their host framework's own i18n library; Vanilla and Svelte have no framework to delegate to, so they ship a small built-in translator instead:

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

### Vanilla

The Vanilla binding has no framework to plug an i18n library into, so it ships a tiny built-in translator: pass a `messages` dictionary keyed by locale directly to `createPptxViewer`, no separate wiring step.

```ts
import { createPptxViewer } from 'pptx-vanilla-viewer';
import { translationsFr } from './i18n-locales-fr'; // your own dictionary, see below

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
import { translationsFr } from './i18n-locales-fr'; // your own dictionary, see below

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

The packages only ship `translationsEn` today; there's no built-in registry of other locales yet, but nothing stops you from contributing one. To add a first-class language to `pptx-viewer-shared` (and therefore to all three bindings at once, since each bundles it in):

1. Add `packages/shared/src/i18n/translations-<code>.ts` (e.g. `translations-fr.ts`) that exports `translationsFr` (or your locale's name) typed as `Record<TranslationKey, string>`, importing `TranslationKey` from `./translations-en`. The type parameter alone will tell you (at typecheck time) about any key you're missing.
2. Translate every value, preserving `{{token}}` interpolation placeholders exactly and keeping the dotted keys unchanged.
3. Re-export it from `packages/shared/src/i18n/index.ts`, then from each binding's `i18n.ts` (React/Vue), `public-api.ts` (Angular), package root `index.ts` (Vanilla), or `i18n.ts` subpath entry (Svelte), mirroring how `translationsEn` is already re-exported.
4. Run `bun run typecheck` and `bun run test` from the repo root, and open a PR following the [commit conventions](https://github.com/ChristopherVR/pptx-viewer/blob/main/CLAUDE.md#commit-conventions) (e.g. `feat(shared): add French translation dictionary`).

Machine-translated first drafts are a reasonable starting point, but flag them as such in the PR - a native or fluent reviewer should confirm terminology before it ships to users, especially for domain-specific PowerPoint vocabulary (SmartArt, morph transitions, chart trendlines, and so on).

## Try it in the demos

The [React](https://christophervr.github.io/pptx-viewer/demo/), [Vue](https://christophervr.github.io/pptx-viewer/demo-vue/), [Angular](https://christophervr.github.io/pptx-viewer/demo-angular/), Vanilla, and Svelte demos each include a language picker (the globe icon next to the theme picker) that switches between English, French, Spanish, and German. The non-English dictionaries cover the high-visibility UI and fall back to English elsewhere - a realistic partial-coverage rollout, exactly as described above. The Vanilla/Svelte dictionaries currently cover a smaller slice of keys than React/Vue/Angular's (the high-traffic toolbar, status bar, and dialog strings); anything beyond that falls back to English until someone extends them - a good first contribution if you want one.

The picker and dictionaries are demo-only code (not part of the published packages), but they're a complete working reference for wiring up multi-language support:

- **React**: `demos/demo-react/i18n.ts`, `i18n-locales.ts`, `LanguagePicker.tsx`
- **Vue**: `demos/demo-vue/src/i18n.ts`, `i18n-locales.ts`, `LanguagePicker.vue`
- **Angular**: `demos/demo-angular/src/i18n.ts`, `i18n-locales.ts`, `language-picker.component.ts`
- **Vanilla**: `demos/demo-vanilla/src/demo-i18n.ts`, `i18n-locales-{fr,es,de}.ts`, `language-picker.ts`
- **Svelte**: `demos/demo-svelte/src/demo-i18n.svelte.ts`, `i18n-locales-{fr,es,de}.ts`, `LanguagePicker.svelte`

## Next steps

- [Installation](/guide/installation) - peer dependencies, including `i18next`/`react-i18next`.
- [React Hooks](/react/hooks) - `t` is threaded through the hook layer if you need to call it outside the viewer's own components.
