---
title: Limitaciones
description: Lo que no se admite en el motor principal y los enlaces de visualizacion - lea antes de adoptar la biblioteca.
---

# Limitaciones

::: warning Lea esto antes de adoptar
`pptx-viewer` cubre una gran superficie de la especificacion OpenXML, pero algunas cosas son aproximadas, de solo lectura, o estan limitadas por la plataforma del navegador. Esta pagina solo lista lo que **no puede** hacer, o solo puede hacer parcialmente. Todo lo que no aparece aqui carga, edita, renderiza y guarda sin problemas; vea [Conformidad OpenXML](/architecture/openxml-conformance) para el manifiesto formal de cobertura.
:::

## Motor principal (`pptx-viewer-core`)

- **Hipervinculos, incrustaciones OLE y elementos no compatibles en `.ppt`** - La tinta y SmartArt siguen exportandose como imagen rasterizada: PowerPoint mantiene ambos realmente editables mediante una propiedad de forma no documentada (`OfficeArtTertiaryFOPT` id `0x3A9`) que un intento de reproduccion desde cero no logro replicar. Los graficos tambien se exportan como imagen, lo cual coincide con el limite propio de PowerPoint: incrusta un objeto MS Graph heredado sin especificacion publica, asi que escribir uno nativo no esta previsto; los modelos 3D se degradan a imagen igual que el propio exportador de PowerPoint, por lo que eso no es una carencia. Los hipervinculos, acciones de clic, incrustaciones OLE y audio WAV se conservan sin perdidas; vea [Conformidad OpenXML](/architecture/openxml-conformance#ppt-export-ceiling) para la evidencia de medicion.
- **Diseno de SmartArt** - Cuando el archivo trae el dibujo precomputado de PowerPoint, se usa exactamente ese diseno. En caso contrario, un interprete DiagramML lo reconstruye, igualando el conjunto de formas de PowerPoint en 226 de 227 fixtures de galeria medidas y su geometria dentro del 1 % para las familias ciclo, radial, jerarquia y piramide. Sigue abierto: tamanos de fuente exactos en plantillas de elemento con varios roles, organigramas profundos mas alla de la tercera generacion, el carril de los conectores en zigzag, y un parrafo en blanco del preset Bubble Picture List; vea [Conformidad OpenXML](/architecture/openxml-conformance#smartart-layout-ground-truth) para la evidencia de medicion.

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

- **Formas y escenas 3D (`a:sp3d`/`a:scene3d`)** - Los preajustes de camara, las anulaciones explicitas `a:camera` (de un eje y combinadas), los paneles de extrusion, los rigs de iluminacion, los perfiles de bisel y los materiales estan todos medidos por COM e implementados como tecnicas CSS/SVG exactas (homografias `matrix3d`, paneles laterales `translateZ`, un filtro de iluminacion SVG). Quedan dos carencias: tres perfiles de bisel (`relaxedInset`, `slope`, `hardEdge`) muestran una doble transicion de brillo-luego-oscuro en su seccion transversal que el modelo de altura monotono no puede reproducir del todo, y un fallo de acoplamiento entre la elevacion especular y difusa que aparecio al calibrar por COM la elevacion del rig: `metal` se satura y el error medio de brillo de `matte` sube a unos 47.4 con elevaciones altas. Vea [Fidelidad de efectos visuales](/guide/visual-effects) para la evidencia de medicion completa.
- **Deformaciones de texto WordArt** - La deformacion del contorno por glifo (una deformacion exacta, punto por punto, del contorno vectorial real cuando el archivo de fuente esta disponible) y la envolvente vertical estan medidas y terminadas. Quedan dos aproximaciones: PowerPoint distribuye los glifos de la envolvente borde a borde por el cuadro, y aunque este renderizador ya lo reproduce estirando la linea, los preajustes `can` mantienen cada glifo en su ancho natural (sin estirar), dejando un error residual de ~5.3-18.5 % que ningun modelo horizontal alternativo ha cerrado; y cuando no hay archivo de fuente disponible, un ajuste afin por glifo sustituye a la deformacion exacta del contorno, con una precision de aproximadamente 1-2 % para titulos ordinarios. Vea [Fidelidad de efectos visuales](/guide/visual-effects) para la evidencia de medicion completa.

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
