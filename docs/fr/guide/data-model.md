---
title: Le modele PptxData
description: La forme des presentations analysees - PptxData, PptxSlide et chaque type d'element avec leurs champs cles.
---

# Le modele PptxData

Quand vous appelez `handler.load(buffer)`, vous obtenez un `PptxData` - l'objet racine qui contient toutes les diapositives, themes, masques et metadonnees.

## Structure de haut niveau

```ts
interface PptxData {
	slides: PptxSlide[];
	slideMasters: PptxSlideMaster[];
	theme?: PptxTheme;
	themeColorMap: Record<string, string>;
	widthEmu: number; // largeur de diapositive en EMU
	heightEmu: number; // hauteur de diapositive en EMU
	metadata?: PptxMetadata;
}
```

## PptxSlide

```ts
interface PptxSlide {
	elements: PptxElement[];
	layoutPath?: string;
	background?: PptxBackground;
	notes?: string;
	hidden?: boolean;
	slideNumber?: number;
	name?: string;
}
```

## L'union PptxElement

`PptxElement` est une union discriminee sur le champ `type`. Les 11 types de variantes sont :

| `type`        | Interface              | Description                           |
| ------------- | ---------------------- | ------------------------------------- |
| `'text'`      | `TextPptxElement`      | Zones de texte, titres, corps         |
| `'image'`     | `ImagePptxElement`     | Images raster et metafichiers EMF/WMF |
| `'shape'`     | `ShapePptxElement`     | Formes geometriques et conecteurs     |
| `'table'`     | `TablePptxElement`     | Tableaux avec des lignes/colonnes     |
| `'chart'`     | `ChartPptxElement`     | Graphiques (23 types)                 |
| `'group'`     | `GroupPptxElement`     | Groupes contenant d'autres elements   |
| `'connector'` | `ConnectorPptxElement` | Connecteurs / lignes                  |
| `'smartArt'`  | `SmartArtPptxElement`  | Diagrammes SmartArt                   |
| `'media'`     | `MediaPptxElement`     | Audio / video incorpore               |
| `'ink'`       | `InkPptxElement`       | Encre numerique                       |
| `'ole'`       | `OlePptxElement`       | Objets OLE incorpores                 |

## Champs communs

Tous les types d'elements partagent ces champs de base :

```ts
interface PptxElementBase {
	type: string;
	id: string;
	x: number; // position en pixels approximatifs
	y: number;
	width: number;
	height: number;
	rotation?: number;
	name?: string;
	hidden?: boolean;
}
```

## Travailler avec des elements

Affinez toujours sur `type` avant d'acceder aux champs specifiques au variant :

```ts
for (const element of slide.elements) {
	if (element.type === 'text') {
		// element est maintenant TextPptxElement
		console.log(element.text, element.fontFamily, element.fontSize);
	}
	if (element.type === 'group') {
		// recurse dans les enfants
		processElements(element.children);
	}
}
```

## Lectures connexes

- [Architecture](/fr/guide/architecture) - comment `PptxData` est produit.
