---
title: Localisation (i18n)
description: Comment les chaines de l'interface de pptx-viewer fonctionnent avec React, Vue 3 et Angular, comment ajouter une langue dans votre application et comment contribuer une traduction.
---

# Localisation (i18n)

**Le visualiseur recherche chaque libelle d'interface via une cle de traduction `pptx.*` ; votre application fournit la bibliotheque i18n et le dictionnaire.** Aucune liaison ne livre une bibliotheque de traduction ou des langues integrees.

| Framework | Appel de traduction que le visualiseur effectue         | Bibliotheque que vous fournissez                             |
| --------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| React     | `react-i18next` `t(key, opts)`                          | [i18next](https://www.i18next.com/) / react-i18next          |
| Vue 3     | `vue-i18n` `useI18n().t(key, opts)`                     | [vue-i18n](https://vue-i18n.intlify.dev/)                    |
| Angular   | signal `translate()` / `TranslatePipe` de ngx-translate | [@ngx-translate/core](https://github.com/ngx-translate/core) |

## Le dictionnaire anglais

Chaque package re-exporte un bundle de ressources anglaises pret a l'emploi :

```ts
// React et Vue : export de sous-chemin
import { translationsEn, keyToLabel } from 'pptx-react-viewer/i18n';
```

```ts
// Angular : exporte depuis la racine du package, pas un sous-chemin
import { translationsEn, keyToLabel } from 'pptx-angular-viewer';
```

`translationsEn` est un `Record<string, string>` plat de toutes les cles `pptx.*` (plus de 1 600), par exemple `'pptx.statusBar.allSaved': 'All saved'`.

`keyToLabel(key)` derive un libelle lisible depuis le dernier segment d'une cle quand aucune entree du dictionnaire ne correspond.

## Ajouter une langue dans votre application

Construisez un dictionnaire avec les memes cles que `translationsEn` et enregistrez-le comme deuxieme ressource/locale dans votre bibliotheque. Vous n'avez pas besoin de toutes les cles des le premier jour - tout ce que vous n'avez pas traduit revient automatiquement a `keyToLabel`.

Pour attraper les cles manquantes/mal orthographiees au moment de la compilation, typez votre dictionnaire contre l'union `TranslationKey` exportee :

```ts
import type { TranslationKey } from 'pptx-react-viewer/i18n';

export const translationsFr: Record<TranslationKey, string> = {
	'pptx.statusBar.allSaved': 'Tout enregistre',
	// TypeScript indique une erreur si vous manquez une cle ou en ajoutez une inexistante
	...
};
```

## Contribuer une traduction

Pour ajouter une langue de premiere classe a `pptx-viewer-shared` (et donc aux cinq liaisons a la fois) :

1. Ajoutez `packages/shared/src/i18n/translations-<code>.ts` exporter `translations<Code>` type `Record<TranslationKey, string>`.
2. Traduisez chaque valeur en preservant les espaces reserves d'interpolation `{{token}}`.
3. Re-exportez depuis `packages/shared/src/i18n/index.ts`, puis de chaque liaison.
4. Executez `bun run typecheck` et `bun run test` depuis la racine du depot, et ouvrez une PR.

## Lectures connexes

- [Installation](/fr/guide/installation) - dependances, dont `i18next`/`react-i18next`.
