---
title: Grundlegende Konzepte
description: Das mentale Modell hinter pptx-viewer - EMU-Einheiten, das diskriminierte-Union-Elementmodell, die Design-Auflosungskette und wie Folien, Master und Layouts zusammenhangen.
---

# Grundlegende Konzepte

Einige Ideen tauchen uberall in `pptx-viewer` auf. Sie von Anfang an zu verstehen, lasst den Rest der API offensichtlich erscheinen.

## EMU-Einheiten

PowerPoint speichert Positionen und Grossen intern in **English Metric Units (EMU)**, einer hochauflosenden ganzzahligen Einheit, die Gleitkomma-Rundungsfehler vermeidet. Alle EMU-Konvertierungskonstanten befinden sich in `core/constants.ts`:

| Konstante       | Wert     | Bedeutung                           |
| --------------- | -------- | ----------------------------------- |
| `EMU_PER_INCH`  | `914400` | EMU in einem Zoll                   |
| `EMU_PER_POINT` | `12700`  | EMU in einem typografischen Punkt   |
| `EMU_PER_PIXEL` | `9525`   | EMU in einem CSS-Pixel (bei 96 DPI) |

```ts
const EMU_PER_PIXEL = 9525;

// EMU zu Pixel
const px = emuValue / EMU_PER_PIXEL;

// Pixel zu EMU
const emu = px * EMU_PER_PIXEL;
```

::: info Pixel im Datenmodell
Die Felder `x`, `y`, `width` und `height` auf einem analysierten `PptxElement` werden bereits in **naherungsweisen Pixeln** ausgedruckt.
:::

## Das Elementmodell

Alles auf einer Folie ist ein `PptxElement` - eine **diskriminierte Union** konkreter Elementtypen. Der Diskriminant ist das `type`-Zeichenfeld:

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

::: warning Immer einengen vor dem Zugriff
Auf ein variantenspezifisches Feld zuzugreifen, ohne zuerst `element.type` zu prufen, ist ein Typfehler.
:::

## Die Design-Auflosungskette

```
Element → Platzhalter → Layout → Master → Design
```

1. **Element** - ein expliziter Wert gewinnt, wenn vorhanden.
2. **Platzhalter** - sonst vom passenden Platzhalter erben.
3. **Layout** - dann vom Folienlayout, auf dem die Folie basiert.
4. **Master** - dann vom Folienmaster des Layouts.
5. **Design** - schliesslich vom Design (Farbschema, Schriftschema).

## Weiterfuhrend

- [Das PptxData-Modell](/de/guide/data-model) - die vollstandige Typauflistung.
- [Architektur](/de/guide/architecture) - die Lade-/Speicherpipelines.
