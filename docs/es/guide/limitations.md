---
title: Limitaciones
description: Lo que no se admite en el motor principal y los enlaces de visualizacion - lea antes de adoptar la biblioteca.
---

# Limitaciones

::: warning Lea esto antes de adoptar
`pptx-viewer` cubre una gran superficie de la especificacion OpenXML, pero algunas cosas son aproximadas o de solo lectura. Esta pagina solo lista lo que **no puede** hacer.
:::

## Motor principal (`pptx-viewer-core`)

- **Los objetos OLE son de solo lectura.** El contenido incrustado de Excel/Word se muestra como su imagen de vista previa y puede descargarse, pero no editarse en el lugar.
- **El diseno de SmartArt puede ser aproximado.** Los diagramas se descomponen en formas posicionadas. Cuando un archivo contiene los datos de dibujo precomputados de PowerPoint, se usa ese diseno exacto; de lo contrario, un motor de diseno algoritmico lo aproxima.

Todo lo demas hace el ciclo completo: texto y ediciones estructurales de SmartArt, datos y formato de graficos, y archivos OOXML Strict sobreviven a la carga, edicion y guardado.

## Visualizadores de framework (React, Vue 3, Angular, Svelte 5, Vanilla JS)

::: warning El renderizado CSS intercambia algunos efectos visuales por fidelidad en otros lugares
Las diapositivas se renderizan como HTML/CSS en lugar de Canvas, lo que da texto nitido a cualquier zoom. La contrapartida: `backdrop-filter` se convierte en un fondo semitransparente, `mix-blend-mode` se mapea a alternativas de opacidad, las transformaciones CSS 3D se aplanan a 2D, y los degradados de ruta se aproximan como radiales elipticos.
:::

- **Fuentes** - el texto usa fuentes disponibles en el navegador; las fuentes faltantes recurren a los valores predeterminados del sistema.
- **Codecs de medios** - la reproduccion de audio/video depende del soporte de codecs del navegador.
- **Transiciones morph** - los elementos sin contraparte en la siguiente diapositiva se difuminan en lugar de hacer morph.
- **La manipulacion directa de graficos depende del tipo de grafico** - las barras y los puntos de graficos de lineas, dispersion y burbujas se pueden arrastrar en el lienzo para cambiar sus valores (un clic selecciona una marca, doble clic en el titulo lo renombra); las marcas circulares, radiales y apiladas se seleccionan con clic y sus valores se editan en el panel inspector; los graficos de mapas y superficies 3D se renderizan como SVG estatico.
- **Fidelidad de exportacion raster** - la exportacion PNG/JPEG/PDF usa `html2canvas`, que no puede reproducir `backdrop-filter`, propiedades CSS personalizadas o transformaciones CSS 3D.
- **Pantallas pequenas** - la interfaz se adapta hasta telefonos de unos 360 px, pero los paneles mas densos en datos son mejores en una tableta o pantalla mas grande.
- **Los modelos 3D necesitan `three`** - los elementos GLB/GLTF requieren la dependencia opcional `three`; sin ella, recurren a una imagen de poster.
- **Colaboracion** - las ediciones concurrentes a la _misma_ serie de texto se resuelven por ultimo escritor gana.

## Metarchivos EMF/WMF (`emf-converter`)

::: warning API Canvas requerida
La conversion de metarchivos necesita `OffscreenCanvas` o `HTMLCanvasElement`. Node.js puro sin un polyfill de canvas no esta soportado.
:::

- **Los degradados se simplifican** - los degradados lineales y de ruta GDI+ se renderizan solo con su color principal.
- **Sin operaciones raster** - los modos de combinacion GDI ROP no se aplican.
- **Recorte limitado** - solo recorte de ruta unica.

## Lecturas relacionadas

- [Introduccion](/es/guide/introduction) - lo que el proyecto soporta en general.
- [Arquitectura](/es/guide/architecture) - por que existen estos compromisos.
