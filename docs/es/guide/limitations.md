---
title: Limitaciones
description: Lo que no se admite en el motor principal y los enlaces de visualizacion - lea antes de adoptar la biblioteca.
---

# Limitaciones

::: warning Lea esto antes de adoptar
`pptx-viewer` cubre una gran superficie de la especificacion OpenXML, pero algunas cosas son aproximadas, de solo lectura, o estan limitadas por la plataforma del navegador. Esta pagina solo lista lo que **no puede** hacer, o solo puede hacer parcialmente. Todo lo que no aparece aqui carga, edita, renderiza y guarda sin problemas; vea [Conformidad OpenXML](/architecture/openxml-conformance) para el manifiesto formal de cobertura.
:::

## Motor principal (`pptx-viewer-core`)

- **Hipervinculos y elementos no compatibles en `.ppt`** - `save({ format: 'ppt' })` escribe un flujo de registros MS-PPT/OfficeArt real en un contenedor OLE2, y reproduce sin perdidas, a traves de nuestro propio importador, el numero de diapositivas, la geometria de las formas, el formato de texto/ejecucion, las imagenes, los grupos, las tablas y los fondos, incluso con proteccion por contrasena RC4 CryptoAPI (`pptPassword`); una presentacion generada unicamente mediante el SDK se abre en PowerPoint 16.0 real por COM con el numero de diapositivas/formas y el texto correctos (verificado por COM, `scripts/com-acceptance-ppt.mjs`). Las acciones de clic en hipervinculos aun no se conservan en `.ppt`, y los elementos sin equivalente binario (graficos, SmartArt, multimedia, OLE, tinta, 3D) se escriben como una imagen de vista previa rasterizada o como un marcador de posicion. El esquema anterior de ofuscacion RC4/XOR de Office 95 no esta soportado al importar. Al ser anterior a DrawingML no hay esquema de fuentes de tema (el conversor sintetiza uno a partir de la primera fuente encontrada) y los efectos sin equivalente binario se degradan.
- **Diseno de SmartArt** - Cuando el archivo trae el dibujo precomputado de PowerPoint, se usa ese diseno exacto. En caso contrario, un interprete DiagramML (los diez tipos `dgm:alg`, restricciones, reglas) lo aproxima. Los organigramas coinciden con fixtures reales generados por COM (topologia, sangria de las ramas colgantes, comportamiento de abanico, eleccion de fila vs columna); una agrupacion `chMax` mas profunda no ocurre en archivos genuinos de PowerPoint.
- **Coordenadas de elementos** - Posicion y tamano se mantienen internamente en EMU exactos y se reproducen byte a byte al guardar, incluso en grupos anidados y tras mover/redimensionar (verificado por COM en numerosos casos de rotacion y grupos). Dos casos de edicion combinada en angulos no rectos quedan solo dentro de 1 EMU (1/914400 pulgadas) del valor de referencia COM, por el propio redondeo trigonometrico de PowerPoint en angulos irracionales, no por un error de formula.
- **Tamano de archivo** - Una proteccion contra "zip bombs" limita por defecto a 500 MiB sin comprimir (ajustable via `maxUncompressedBytes`) y 65.536 entradas de archivo; superar cualquiera lanza `ZipBombError`.
- **Duracion de transicion** - `p14:dur` se escribe en el espacio de nombres de Office 2010 con `mc:Ignorable`, porque `CT_SlideTransition` no tiene un atributo `dur` nativo; los lectores anteriores a PowerPoint 2010 recurren a la velocidad `spd`.

### Autoria de animaciones

Un efecto creado en el panel de animacion se reconcilia dentro del arbol `p:timing` existente de la diapositiva; los efectos propios del archivo quedan byte-identicos. Dentro de eso:

- **`p:bldP/p:tmplLst`/`p:tmpl`** - Se analiza de forma tipada y se conserva al guardar, pero no se usa en la reproduccion: PowerPoint solo usa estas plantillas para inicializar un nivel de esquema sin efecto propio, y el nivel visible ya tiene su propio nodo en `p:timing/p:tnLst`.
- **`p:animEffect/@filter` `image`** - 26 de las 27 familias de filtros SMIL producen un efecto real. `pixelate` es un mosaico construido con filtros SVG propios (la comparacion de fotogramas por COM muestra que PowerPoint 2016 no anima nada para este filtro, salta directo al estado final). `image` deberia sustituir por una segunda imagen autorada aparte que la carga OOXML nunca incluye, por lo que no hay nada que sustituir.

### Formato de graficos y ChartEx

- **`c:pictureOptions` en barras 3D** - Cuando una cara sin objetivo especifico solo tiene relleno de imagen, PowerPoint toma el color del pixel (0,0) de la imagen y pinta la cara con ese color plano (verificado por COM); este renderizador obtiene ese pixel de forma asincrona y repinta el grafico cuando esta listo. La escena opcional en three.js pinta texturas reales por cara tambien en barras cilindricas, conicas y piramidales, no solo en las de caja.

### Tablas, geometria y edicion de medios

- **`onStopAudio` en exportacion sin interfaz** - El disparador normalmente espera el evento `ended` de un elemento `<audio>`/`<video>` real. Sin ese elemento (exportacion headless, o medio no montado), se usa un temporizador de duracion estimada, exactamente lo que PowerPoint mismo escribe para su propio encadenamiento de audio "Despues del anterior".

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

- **Formas y escenas 3D (`a:sp3d`/`a:scene3d`)** - Los presets de camara `perspective*` e `isometric*` se implementan como una homografia `matrix3d` exacta medida por COM, no una rotacion aproximada. `oblique*`/`legacyOblique*`/`legacyPerspective*`/`orthographicFront` dejan la cara frontal plana (confirmado por COM; solo responden los paneles laterales extruidos). Una anulacion explicita `a:camera/a:rot`/`@fov`/`@zoom` sigue usando el modelo antiguo basado en rotacion. La profundidad de extrusion se renderiza como paneles laterales `translateZ` reales; que lado se muestra fue medido por COM para la mayoria de presets, y varios no muestran ningun panel, igual que en PowerPoint. El bisel y los materiales son capas CSS `box-shadow`/`filter`, no geometria o iluminacion real; la direccion del resalte esta verificada por COM para la mayoria de los perfiles de bisel, sin senal clara en un par de ellos. La sombra del plano de suelo (`a:backdrop`) ya no se sintetiza, porque un plano muy inclinado proyecta una sombra no convexa que ningun `box-shadow` de CSS puede representar. El WordArt/texto bajo `a:bodyPr/a:scene3d` reutiliza la misma funcion de camara que las formas.
- **Reflejos** - Un nodo hermano espejado (respeta `@sx`/`@sy`/`@kx`/`@ky`/`@rot`/`@fadeDir`/`@algn`) que refleja todo el contenido renderizado: relleno, contorno y texto en formas/imagenes, y recursivamente cada hijo en grupos. Un hijo con su propio reflejo dentro de un grupo reflejado queda doblemente espejado, igual que PowerPoint compone el reflejo de un grupo a partir de su contenido ya renderizado.
- **Bordes suaves (`a:softEdge`)** - Filtro SVG de degradado alfa (difumina solo el borde, no todo el elemento).
- **Degradados de ruta** - Tipos `circle`/`shape`: un radial eliptico. Tipo `rect`: bandas rectangulares anidadas alineadas a los ejes, para reproducir el campo de esquinas cuadradas de PowerPoint (ningun radial nativo de CSS/SVG tiene esquinas cuadradas).
- **Deformaciones de texto WordArt** - Cada preset `a:prstTxWarp` se renderiza como texto SVG real. Arco/onda/circulo/anillo/boton/inclinado/desvanecido/cascada siguen una linea base `textPath` curvada; `inflate`/`deflate`/`can` renderizan cada glifo con su propia transformacion afin ajustada a la curva de la envolvente, dividida en hasta 24 sub-bandas para titulos cortos y reducir el error. Frente a PowerPoint real por COM, la matematica de la curva coincide con un error medio de alrededor de 0.2%; los glifos individuales se mantienen dentro de aproximadamente 1-2% para titulos ordinarios.
- **Transiciones 3D cinematicas** - Se animan con keyframes CSS (perspectiva/rotacion/enrollado) sobre capas 2D, no un render volumetrico 3D real. La mayoria de los presets estan verificados por COM (`CreateVideo`) contra PowerPoint 2016. `vortex`, `honeycomb`, `glitter`, `shred`, `fracture`, `curtains` y `airplane` se descomponen en muchos fragmentos o particulas independientes en PowerPoint real, algo que una sola capa CSS no puede reproducir literalmente; mantienen un sustituto de una sola capa con la direccion correcta.

### Comportamiento limitado por la plataforma

- **Fuentes** - El texto usa las fuentes disponibles en el navegador; las fuentes faltantes recurren a los valores predeterminados del sistema. Las fuentes incrustadas en el PPTX se inyectan cuando existen.
- **Codecs de medios** - La reproduccion de audio/video depende del navegador (WMV y codecs antiguos pueden no reproducirse); los medios protegidos por DRM no se reproducen.
- **Transiciones morph** - Los elementos se emparejan por nombre `!!`, identidad `a16:creationId`/id nativo de forma, o proximidad de mismo tipo. Un nombre de panel de seleccion sin prefijo `!!` no cuenta (confirmado contra PowerPoint real). Un elemento sin contraparte en la siguiente diapositiva se difumina en vez de hacer morph, igual que en PowerPoint.
- **Exportacion raster** - PNG/JPEG/PDF usa `html2canvas`, que no puede reproducir `backdrop-filter`, propiedades personalizadas CSS ni transformaciones CSS 3D; use la exportacion SVG como alternativa vectorial.
- **Resolucion de exportacion** - Las exportaciones a canvas estan limitadas por el tamano maximo de canvas del navegador (normalmente 16.384 o 32.768 pixeles por lado).
- **Atajos de presentacion** - `F5`/`Shift+F5` se mapean a "Desde el principio"/"Desde la diapositiva actual" de PowerPoint cuando el visor tiene el foco y no hay una presentacion en curso, por lo que un `F5` simple deja de recargar la pagina; `Ctrl+F5` y el boton de recarga del navegador no se ven afectados.
- **Acciones de ejecutar programa** - `ppaction://program` se analiza y se conserva al guardar, pero un clic no hace nada durante una presentacion, porque un navegador no puede lanzar un ejecutable local.
- **Pantallas pequenas** - La interfaz se adapta hasta telefonos de unos 360 px, pero los paneles mas densos en datos (por ejemplo el editor completo de graficos) se usan mejor en una tableta o pantalla mayor.

## Metarchivos EMF/WMF (dependencia `emf-converter`)

::: info No es codigo de este repositorio
`emf-converter` es un paquete npm independiente con su propio repositorio; `pptx-viewer-core` solo lo consume. La tabla siguiente refleja lo que hace ese paquete hoy; si alguna vez difieren, sus propias notas de version son la fuente autorizada.
:::

::: warning Se requiere API Canvas
La conversion de metarchivos necesita `OffscreenCanvas` o `HTMLCanvasElement`. Node.js puro sin un polyfill de canvas no esta soportado para imagenes EMF/WMF (el resto del motor principal funciona bien en Node).
:::

- **Pinceles de degradado** - Los degradados lineales y de ruta de GDI+ se renderizan simplificados, solo con su color principal.
- **Operaciones raster** - Los modos de mezcla ROP de GDI (XOR, NOT, AND, ...) se ignoran.
- **Recorte** - Solo se admite una ruta unica; las operaciones de region GDI combinadas (union/interseccion/exclusion) no.
- **Tamano de salida** - Limitado a 4096 x 4096 pixeles.
- **Texto** - Usa el motor de fuentes del navegador; las metricas de los glifos pueden diferir de GDI de Windows.

## Lecturas relacionadas

- [Introduccion](/es/guide/introduction) - lo que el proyecto soporta en general.
- [Arquitectura](/es/guide/architecture) - por que existen estos compromisos.
- [Conformidad OpenXML](/architecture/openxml-conformance) - la definicion formal de "soportado" que usa el manifiesto de cobertura.
