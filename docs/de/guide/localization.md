---
title: Lokalisierung (i18n)
description: Wie die UI-Strings von pptx-viewer mit React, Vue 3 und Angular funktionieren, wie man eine Sprache in seiner App hinzufugt und wie man eine Ubersetzung beitragt.
---

# Lokalisierung (i18n)

**Der Viewer sucht jedes UI-Label uber einen `pptx.*`-Ubersetzungsschlussel; Ihre App stellt die i18n-Bibliothek und das Worterbuch bereit.** Keine Bindung liefert eine Ubersetzungsbibliothek oder eingebaute Sprachen.

| Framework | Ubersetzungsaufruf, den der Viewer macht                 | Bibliothek, die Sie bereitstellen                            |
| --------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| React     | `react-i18next` `t(key, opts)`                           | [i18next](https://www.i18next.com/) / react-i18next          |
| Vue 3     | `vue-i18n` `useI18n().t(key, opts)`                      | [vue-i18n](https://vue-i18n.intlify.dev/)                    |
| Angular   | `translate()`-Signal / `TranslatePipe` von ngx-translate | [@ngx-translate/core](https://github.com/ngx-translate/core) |

## Das englische Worterbuch

Jedes Paket re-exportiert ein fertiges englisches Ressourcenpaket:

```ts
// React und Vue: Unterpfad-Export
import { translationsEn, keyToLabel } from 'pptx-react-viewer/i18n';
```

```ts
// Angular: vom Paketstamm exportiert
import { translationsEn, keyToLabel } from 'pptx-angular-viewer';
```

`keyToLabel(key)` leitet eine lesbare Bezeichnung aus dem letzten Segment eines Schlussels ab, wenn kein Worterbucheintrag ubereinstimmt.

## Eine Sprache in Ihrer App hinzufugen

Erstellen Sie ein Worterbuch mit denselben Schlusseln wie `translationsEn` und registrieren Sie es als zweite Ressource/Locale in Ihrer Bibliothek. Fur Kompilierzeit-Fehler bei fehlenden Schlusseln verwenden Sie den `TranslationKey`-Typ:

```ts
import type { TranslationKey } from 'pptx-react-viewer/i18n';

export const translationsDe: Record<TranslationKey, string> = {
	'pptx.statusBar.allSaved': 'Alles gespeichert',
	// TypeScript meldet einen Fehler, wenn ein Schlussel fehlt oder ein nicht vorhandener hinzugefugt wird
	...
};
```

## Weiterfuhrend

- [Installation](/de/guide/installation) - Abhangigkeiten, einschliesslich `i18next`/`react-i18next`.
