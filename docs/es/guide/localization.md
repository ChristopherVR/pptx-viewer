---
title: Localizacion (i18n)
description: Como funcionan las cadenas de interfaz de pptx-viewer con React, Vue 3 y Angular, como anadir un idioma en su aplicacion y como contribuir una traduccion.
---

# Localizacion (i18n)

**El visualizador busca cada etiqueta de interfaz a traves de una clave de traduccion `pptx.*`; su aplicacion proporciona la biblioteca i18n y el diccionario.** Ningún enlace incluye una biblioteca de traduccion ni idiomas integrados.

| Framework | Llamada de traduccion que hace el visualizador         | Biblioteca que proporciona                                   |
| --------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| React     | `react-i18next` `t(key, opts)`                         | [i18next](https://www.i18next.com/) / react-i18next          |
| Vue 3     | `vue-i18n` `useI18n().t(key, opts)`                    | [vue-i18n](https://vue-i18n.intlify.dev/)                    |
| Angular   | senal `translate()` / `TranslatePipe` de ngx-translate | [@ngx-translate/core](https://github.com/ngx-translate/core) |

## El diccionario en ingles

Cada paquete re-exporta un bundle de recursos en ingles listo para usar:

```ts
// React y Vue: exportacion de subruta
import { translationsEn, keyToLabel } from 'pptx-react-viewer/i18n';
```

```ts
// Angular: exportado desde la raiz del paquete
import { translationsEn, keyToLabel } from 'pptx-angular-viewer';
```

`keyToLabel(key)` deriva una etiqueta legible del ultimo segmento de una clave cuando no hay ninguna entrada del diccionario coincidente.

## Anadir un idioma en su aplicacion

Construya un diccionario con las mismas claves que `translationsEn` y registrelo como un segundo recurso/locale en su biblioteca. Para detectar claves faltantes en tiempo de compilacion, use el tipo `TranslationKey`:

```ts
import type { TranslationKey } from 'pptx-react-viewer/i18n';

export const translationsFr: Record<TranslationKey, string> = {
	'pptx.statusBar.allSaved': 'Tout enregistre',
	// TypeScript indica un error si falta una clave o se agrega una que no existe
	...
};
```

## Lecturas relacionadas

- [Instalacion](/es/guide/installation) - dependencias, incluyendo `i18next`/`react-i18next`.
