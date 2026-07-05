---
title: Concepts fondamentaux
description: Le modele mental derriere pptx-viewer - unites EMU, le modele d'elements a union discriminee, la chaine de resolution de theme, et comment les diapositives, masques et mises en page se rapportent.
---

# Concepts fondamentaux

Quelques idees apparaissent partout dans `pptx-viewer`. Les comprendre a l'avance rend le reste de l'API evidente.

## Unites EMU

PowerPoint stocke les positions et tailles en interne en **English Metric Units (EMU)**, une unite entiere haute resolution qui evite les arrondis en virgule flottante. Toutes les constantes de conversion EMU se trouvent dans `core/constants.ts` :

| Constante       | Valeur   | Signification                    |
| --------------- | -------- | -------------------------------- |
| `EMU_PER_INCH`  | `914400` | EMU dans un pouce                |
| `EMU_PER_POINT` | `12700`  | EMU dans un point typographique  |
| `EMU_PER_PIXEL` | `9525`   | EMU dans un pixel CSS (a 96 DPI) |

```ts
const EMU_PER_PIXEL = 9525;

// EMU en pixels
const px = emuValue / EMU_PER_PIXEL;

// pixels en EMU
const emu = px * EMU_PER_PIXEL;
```

::: info Pixels dans le modele de donnees
Les champs `x`, `y`, `width` et `height` des elements sur un `PptxElement` analyse sont deja exprimes en **pixels approximatifs** pour la commodite.
:::

## Le modele d'elements

Tout sur une diapositive est un `PptxElement` - une **union discriminee** de types d'elements concrets. Le discriminant est le champ de chaine `type`. L'affinage sur `type` deverrouille les proprietes specifiques au variant avec une securite de type complete :

```ts
for (const element of slide.elements) {
	switch (element.type) {
		case 'text':
			console.log(element.text);
			break;
		case 'image':
			console.log(element.imagePath);
			break;
		case 'table':
			console.log(element.tableData?.rows.length);
			break;
	}
}
```

::: warning Affinez toujours avant d'acceder
L'acces a un champ specifique au variant sans verifier d'abord `element.type` est une erreur de type. Utilisez `switch (element.type)` ou `if (element.type === '...')`.
:::

## La chaine de resolution de theme

Une propriete visuelle unique est rarement definie directement sur un element. PowerPoint la resout via une chaine d'heritage en couches, et `pptx-viewer` reflete cet ordre exact :

```
Element  →  Espace reserv  →  Mise en page  →  Master  →  Theme
```

1. **Element** - une valeur explicite sur l'element gagne si presente.
2. **Espace reserve** - sinon herite de l'espace reserve correspondant.
3. **Mise en page** - puis de la mise en page sur laquelle la diapositive est basee.
4. **Master** - puis du master de diapositive de la mise en page.
5. **Theme** - enfin du theme (schema de couleurs, schema de polices).

## Diapositives, masters et mises en page

- **Master de diapositive** (`PptxSlideMaster`) - le modele de niveau superieur.
- **Mise en page de diapositive** (`PptxSlideLayout`) - un arrangement nomme d'espaces reserves (ex. _Diapositive de titre_).
- **Diapositive** (`PptxSlide`) - le contenu reel avec des elements.

## Lectures connexes

- [Le modele PptxData](/fr/guide/data-model) - la liste complete des types pour `PptxData` et chaque type d'element.
- [Architecture](/fr/guide/architecture) - les pipelines de chargement/sauvegarde.
