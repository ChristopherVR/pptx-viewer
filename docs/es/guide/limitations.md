---
title: Limitaciones
description: Lo que no se admite en el motor principal y los enlaces de visualizacion - lea antes de adoptar la biblioteca.
---

# Limitaciones

::: warning Lea esto antes de adoptar
`pptx-viewer` cubre una gran superficie de la especificacion OpenXML, pero algunas cosas son aproximadas, de solo lectura, o estan limitadas por la plataforma del navegador. Esta pagina solo lista lo que **no puede** hacer, o solo puede hacer parcialmente. Todo lo que no aparece aqui carga, edita, renderiza y guarda sin problemas; vea [Conformidad OpenXML](/architecture/openxml-conformance) para el manifiesto formal de cobertura.
:::

## Motor principal (`pptx-viewer-core`)

- **Hipervinculos, incrustaciones OLE y elementos no compatibles en `.ppt`** - Tinta, SmartArt, graficos y modelos 3D se exportan todos desde `.ppt` como imagen rasterizada en lugar de como objeto editable, porque el propio camino de edicion real de PowerPoint para tinta y SmartArt depende de una propiedad de forma no documentada, y su respaldo de graficos y 3D coincide con un formato heredado sin especificacion publica. Vea [Conformidad OpenXML](/architecture/openxml-conformance#ppt-export-ceiling) para la evidencia de medicion.
- **Diseno de SmartArt** - Las presentaciones guardadas sin el `dsp:drawing` en cache son dispuestas por el interprete, que reproduce 226 de las 227 fixtures de galeria creadas por COM dentro del 1 %; vea [Conformidad OpenXML](/architecture/openxml-conformance#smartart-layout-ground-truth) para la evidencia de medicion.

### Autoria de animaciones

Un efecto creado en el panel de animacion se reconcilia dentro del arbol `p:timing` existente de la diapositiva; los efectos propios del archivo quedan byte-identicos. Las 27 familias de filtros SMIL (`p:animEffect/@filter`) producen un efecto real que coincide con la reproduccion propia de PowerPoint, incluida `pixelate`, que por defecto muestra exactamente el comportamiento que PowerPoint mismo muestra (salto instantaneo al estado final); vea [Fidelidad de efectos visuales](/guide/visual-effects) para la evidencia. `image`, la familia 27, tampoco es una carencia: vea [Conformidad OpenXML](/architecture/openxml-conformance).

### Detectar carencias en tiempo de ejecucion

El pipeline de carga informa cada construccion no soportada o aproximada en `data.warnings`, tipado como `PptxCompatibilityWarning` (con `code`, `severity`, `scope` y opcionalmente `slideId`/`elementId`/`xmlPath`). Revise `data.warnings` despues de `load()` (y de `save()`) si su aplicacion necesita mostrar avisos de fidelidad o activar funciones segun el archivo.

## Entornos de ejecucion

- **Navegador** - Conjunto completo de funciones: analisis, renderizado, edicion, exportacion, colaboracion.
- **Node.js (y serverless)** - Solo el core: `pptx-viewer-core` (cargar, editar, guardar, conversion a Markdown/SVG, cifrado) no depende del DOM. Los enlaces de UI, la exportacion raster (`html2canvas`) y la conversion EMF/WMF son funciones de navegador.
- **Web Worker** - Mismo alcance que Node.js: el motor no depende del DOM.

## Visualizadores de framework (React, Vue 3, Angular, Svelte 5, Vanilla JS)

::: warning El renderizado basado en CSS cambia algunos efectos visuales por fidelidad en otros lugares
Las diapositivas se renderizan como HTML/CSS en lugar de Canvas, lo que da texto nitido a cualquier zoom, accesibilidad nativa e interactividad DOM. La contrapartida es que algunos efectos de PowerPoint no tienen un equivalente CSS exacto y se aproximan.
:::

### Aproximaciones de efectos visuales

- **Formas y escenas 3D (`a:sp3d`/`a:scene3d`)** - Los biseles relaxedInset, slope y hardEdge muestran una seccion transversal brillante y luego oscura que el modelo de altura unico no puede reproducir, y los materiales `metal` se sobresaturan con rigs de iluminacion de elevacion alta porque el termino especular esta acoplado a la elevacion difusa. Todo lo demas en el modelo 3D esta medido por COM; vea [Fidelidad de efectos visuales](/guide/visual-effects) para la evidencia.
- **Deformaciones de texto WordArt** - Los preajustes `can` mantienen un residuo horizontal del 5-18 % porque el espaciado de glifos de PowerPoint a lo largo del cilindro aun no se ha derivado, y las fuentes cuyo archivo no esta disponible recurren a un ajuste afin por glifo (con una desviacion de aproximadamente 1-2 %) en lugar de la deformacion exacta del contorno; un parrafo muy corto y muy estirado aun puede cruzar ligeramente la fila vecina. Vea [Fidelidad de efectos visuales](/guide/visual-effects) para la evidencia.
- **Exportacion raster de transformaciones CSS 3D grandes** - Una diapositiva con una transformacion de perspectiva CSS explicita y grande se rasteriza algo peor por la ruta de exportacion foreignObject predeterminada que por el fallback html2canvas (diferencia media de canal unas 11 unidades mayor en la diapositiva de prueba), porque Chromium decodifica el subarbol transformado desde una imagen SVG con menor calidad; las formas 3D propias del deck no se ven afectadas y se exportan mejor por foreignObject.

## Metarchivos EMF/WMF (dependencia `emf-converter`)

::: info No es codigo de este repositorio
`emf-converter` es un paquete npm independiente con su propio repositorio; `pptx-viewer-core` solo lo consume. La tabla siguiente refleja lo que hace ese paquete hoy; si alguna vez difieren, sus propias notas de version son la fuente autorizada.
:::

::: warning Se requiere API Canvas
La conversion de metarchivos necesita `OffscreenCanvas` o `HTMLCanvasElement`. Node.js puro sin un polyfill de canvas no esta soportado para imagenes EMF/WMF (el resto del motor principal funciona bien en Node).
:::

- **Pinceles de degradado** - Los degradados lineales y radiales de GDI+ ya se renderizan de forma exacta, incluidas las paradas de color, los preajustes, los factores de mezcla y las transformaciones. La proxima version anade mosaico WrapMode para degradados lineales alineados a los ejes; los degradados envueltos en angulo y los degradados de ruta envueltos se siguen limitando (clamp) en vez de repetirse en mosaico.
- **Operaciones raster** - Los modos GDI ROP2 de pluma y pincel ya se renderizan de forma exacta. La proxima version anade operaciones ROP3 exactas por pixel para `BitBlt`/`StretchBlt`/`StretchDIBits`: `SRCCOPY`, `SRCPAINT`, `SRCAND`, `SRCINVERT`, `SRCERASE`, `NOTSRCCOPY`, `NOTSRCERASE`, `MERGEPAINT`, `PATCOPY`, `DSTINVERT`, `BLACKNESS`, `WHITENESS`. `MERGECOPY`, `PATPAINT` y `PATINVERT` se siguen reduciendo a una copia.
- **Texto** - Usa el motor de fuentes del navegador; las metricas de los glifos pueden diferir de GDI de Windows. La proxima version respeta con exactitud los arrays `dx` de `ExtTextOut`, conserva el signo de la altura de `LOGFONT`, rota el texto segun escapement/orientation y corrige un error de desplazamiento en el nombre de fuente; sin un array `dx`, el espaciado de glifos sigue dependiendo de la sustitucion de fuentes del navegador.

## Lecturas relacionadas

- [Introduccion](/es/guide/introduction) - lo que el proyecto soporta en general.
- [Arquitectura](/es/guide/architecture) - por que existen estos compromisos.
- [Conformidad OpenXML](/architecture/openxml-conformance) - la definicion formal de "soportado" que usa el manifiesto de cobertura.
