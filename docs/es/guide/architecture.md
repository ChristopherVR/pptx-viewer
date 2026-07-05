---
title: Arquitectura
description: Como encajan las capas de pptx-viewer - la canalización de carga, la composicion por mixins y el renderizado CSS de los componentes de visualizacion.
---

# Arquitectura

Esta pagina explica como encajan las capas de `pptx-viewer` entre si.

## Descripcion de las capas

```
Framework viewers (React / Vue / Angular)
         │
pptx-viewer-shared      ← logica de renderizado independiente del framework
         │
pptx-viewer-core        ← motor: analisis, edicion, serializacion
    ├── emf-converter   ← metarchivos EMF/WMF → PNG
    └── mtx-decompressor ← fuentes MicroType Express
```

## El paquete Core

El paquete Core (`pptx-viewer-core`) es un motor TypeScript puro que se ejecuta en cualquier entorno JavaScript.

### Canalizacion de carga

1. El llamante pasa un `ArrayBuffer` a `handler.load(buffer)`.
2. JSZip extrae el archivo ZIP OpenXML.
3. fast-xml-parser analiza el XML de las partes.
4. Los modulos de analisis construyen un `PptxData` estructurado.
5. Los temas, mascaras y disenos se resuelven y adjuntan.

### Canalizacion de guardado

1. Las diapositivas modificadas se serializan en XML OpenXML.
2. Las relaciones y tipos de contenido se reconstruyen.
3. JSZip reempaqueta todo en un `Uint8Array`.

## Los paquetes de visualizacion

Cada paquete de visualizacion (React, Vue, Angular) contiene:

- **Componentes de renderizado** - convierten `PptxElement` en HTML/CSS/SVG.
- **Estado reactivo** - gestion de seleccion, zoom, historial de edicion.
- **Hooks/composables** - expone las operaciones del visualizador (React: 67+ hooks personalizados).
- **Barra de herramientas** - la cinta Office en Tailwind CSS.

## El renderizado CSS

Las diapositivas se renderizan en HTML y CSS, no en Canvas. Esto da:

- Texto nitido a cualquier nivel de zoom.
- Accesibilidad nativa (seleccion de texto, lectores de pantalla).
- Interactividad DOM.

La contrapartida esta documentada en las [Limitaciones](/es/guide/limitations).

## Lecturas relacionadas

- [Conceptos fundamentales](/es/guide/concepts)
- [El modelo PptxData](/es/guide/data-model)
