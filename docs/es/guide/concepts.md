---
title: Conceptos fundamentales
description: El modelo mental detras de pptx-viewer - unidades EMU, el modelo de elementos de union discriminada, la cadena de resolucion de tema, y como se relacionan las diapositivas, mascaras y disenos.
---

# Conceptos fundamentales

Algunas ideas aparecen en todas partes en `pptx-viewer`. Entenderlas de antemano hace que el resto de la API se sienta obvia.

## Unidades EMU

PowerPoint almacena posiciones y tamanos internamente en **English Metric Units (EMU)**, una unidad entera de alta resolucion que evita el redondeo en coma flotante. Todas las constantes de conversion EMU se encuentran en `core/constants.ts`:

| Constante       | Valor    | Significado                    |
| --------------- | -------- | ------------------------------ |
| `EMU_PER_INCH`  | `914400` | EMU en una pulgada             |
| `EMU_PER_POINT` | `12700`  | EMU en un punto tipografico    |
| `EMU_PER_PIXEL` | `9525`   | EMU en un pixel CSS (a 96 DPI) |

```ts
const EMU_PER_PIXEL = 9525;

// EMU a pixeles
const px = emuValue / EMU_PER_PIXEL;

// pixeles a EMU
const emu = px * EMU_PER_PIXEL;
```

::: info Pixeles en el modelo de datos
Los campos `x`, `y`, `width` y `height` de los elementos en un `PptxElement` analizado ya se expresan en **pixeles aproximados** por conveniencia.
:::

## El modelo de elementos

Todo en una diapositiva es un `PptxElement` - una **union discriminada** de tipos de elementos concretos. El discriminante es el campo de cadena `type`:

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

::: warning Estreche siempre antes de acceder
Acceder a un campo especifico del variante sin comprobar primero `element.type` es un error de tipo.
:::

## La cadena de resolucion de tema

```
Elemento → Marcador → Diseno → Maestra → Tema
```

1. **Elemento** - un valor explicito en el elemento gana si esta presente.
2. **Marcador** - de lo contrario, hereda del marcador coincidente.
3. **Diseno** - luego del diseno de diapositiva en el que se basa la diapositiva.
4. **Maestra** - luego de la maestra de diapositivas del diseno.
5. **Tema** - finalmente del tema (esquema de colores, esquema de fuentes).

## Lecturas relacionadas

- [El modelo PptxData](/es/guide/data-model) - la lista completa de tipos.
- [Arquitectura](/es/guide/architecture) - las canalizaciones de carga/guardado.
