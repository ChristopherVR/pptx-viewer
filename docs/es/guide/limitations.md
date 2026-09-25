---
title: Limitaciones
description: Lo que no se admite en el motor principal y los enlaces de visualizacion - lea antes de adoptar la biblioteca.
---

# Limitaciones

::: warning Lea esto antes de adoptar
`pptx-viewer` cubre una gran superficie de la especificacion OpenXML, pero algunas cosas son aproximadas, de solo lectura, o estan limitadas por la plataforma del navegador. Esta pagina recoge limitaciones conocidas; no es una garantia exhaustiva de compatibilidad con todas las funciones de Office o extensiones de terceros. Revise `data.warnings` despues de cargar un archivo y vea [Conformidad OpenXML](/architecture/openxml-conformance) para el manifiesto formal de cobertura.
:::

## Motor principal (`pptx-viewer-core`)

| Funcion            | Estado                         | Notas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exportacion `.ppt` | Parcial                        | Tinta, SmartArt, graficos y modelos 3D ahora se vuelven a abrir en PowerPoint como objetos editables mediante un paquete de ida y vuelta OOXML incrustado (verificado reabriendo en PowerPoint por COM); solo PowerPoint 97-2003 ve el respaldo. Sigue habiendo perdida: las imagenes que no son PNG/JPEG se convierten en un marcador de posicion, las anulaciones de estilo de texto del propio patron de la presentacion no se escriben, el video y el audio que no sea WAV se degradan a una imagen, y la importacion de `.ppt` cifrados solo admite RC4 CryptoAPI. Vea [Conformidad OpenXML](/architecture/openxml-conformance#ppt-export-ceiling).  |
| Diseno de SmartArt | Aproximado sin dibujo en cache | Las presentaciones guardadas sin el `dsp:drawing` en cache son dispuestas por el interprete. De 229 fixtures de galeria creadas por COM, 227 producen el conjunto de formas de PowerPoint, pero solo 39 coinciden con su geometria dentro del 1 %: los diseños de un solo algoritmo principales (proceso/lista basico, ciclo, radial, jerarquia, organigrama, piramide) coinciden de cerca, mientras que los diseños de imagen, cronologia, "Meet the Team", tarjeta de texto y lista/proceso compuestos pueden estar muy lejos. Vea [Conformidad OpenXML](/architecture/openxml-conformance#smartart-layout-ground-truth) para la evidencia de medicion. |

### Autoria de animaciones

Un efecto creado en el panel de animacion se reconcilia dentro del arbol `p:timing` existente de la diapositiva; los efectos propios del archivo quedan byte-identicos. Carencias conocidas:

- **Los efectos de entrada/salida guardados se reproducen como una transicion de desvanecimiento en PowerPoint.** El escritor registra el preajuste correcto, pero solo emite un comportamiento de desvanecimiento, de modo que un "Entrada volando" guardado aqui se reproduce como un desvanecimiento al abrir el archivo en PowerPoint (este visor lo reproduce correctamente). Varios efectos de enfasis (pulso, onda, rebote, onda de color, parpadeo, destello) se escriben como una operacion nula.
- **Algunas familias de filtros y preajustes se aproximan en la reproduccion:** `strips` se reproduce como un barrido de borde, `wedge` como un hexagono creciente, `slide`/`cover`/`uncover`/`push`/`pull` comparten una unica entrada volando, y 45 ID de preajustes de PowerPoint reproducen un efecto sustituto (por ejemplo, "Giro basico" y "Flotar hacia afuera" se reproducen como un desvanecimiento). Persianas, Tablero de ajedrez, Rueda y Barras aleatorias ignoran su subtipo.
- **Aun no soportado:** `p14:bounceEnd`, los disparadores sobre un marcador de un medio (se cargan como al hacer clic), el rizado letra por letra dentro de una construccion por parrafo, y la creacion de las transiciones p15 (se reproducen cuando estan presentes en un archivo, pero sus opciones de direccion se ignoran).

### Detectar carencias en tiempo de ejecucion

No tiene que adivinar si un archivo topo con una limitacion. El pipeline de carga informa muchas construcciones no soportadas o aproximadas (no todas: los sustitutos de animacion, por ejemplo, no generan ningun aviso) en `data.warnings`, tipado como `PptxCompatibilityWarning`:

```ts
interface PptxCompatibilityWarning {
	code: string; // stable machine-readable code
	message: string;
	severity: 'info' | 'warning';
	scope: 'presentation' | 'slide' | 'element' | 'save';
	slideId?: string; // present for slide/element-scoped warnings
	elementId?: string;
	xmlPath?: string; // where in the package the construct lives
}
```

Revise `data.warnings` despues de `load()` (y de `save()`) si su aplicacion necesita mostrar avisos de fidelidad o activar funciones segun el archivo.

Vea [Entornos de ejecucion](/guide/runtime-environments) para saber donde se ejecuta cada parte de `pptx-viewer` (navegador / Node.js / Web Worker) y el comportamiento especifico de la plataforma que se deriva del sandbox del navegador, no de una funcion faltante.

## Visualizadores de framework (React, Vue 3, Angular, Svelte 5, Vanilla JS)

::: warning El renderizado basado en CSS cambia algunos efectos visuales por fidelidad en otros lugares
Las diapositivas se renderizan como HTML/CSS en lugar de Canvas, lo que da texto nitido a cualquier zoom, accesibilidad nativa e interactividad DOM. La contrapartida es que algunos efectos de PowerPoint no tienen un equivalente CSS exacto y se aproximan.
:::

### Aproximaciones de efectos visuales

| Efecto                                                                                              | Estado                                                | Notas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formas y escenas 3D (`a:sp3d`/`a:scene3d`)                                                          | Residuo metalico                                      | Los materiales metalicos solian sobreexponerse bajo rigs de iluminacion de elevacion alta; la luz especular ahora tiene su propia elevacion limitada, reajustada contra 134 renderizados de PowerPoint (error absoluto medio de 75,0 a 36,4 en una escala de 0-255), por lo que queda un residuo menor. La correccion de biseles relaxedInset/slope/hardEdge del 16-09-2026 aun no se ha reverificado contra un renderizado reciente de PowerPoint. Vea [Fidelidad de efectos visuales](/guide/visual-effects) para la procedencia. |
| Deformaciones de texto WordArt (`inflate` / `deflate` / `can` / `slant` / `fade` / `cascade` / ...) | Interior de "can" y fuentes sin archivo sin verificar | Los preajustes `can` ahora colocan los glifos segun la ley de espaciado lineal medida de PowerPoint (derivada por COM, independiente del valor de ajuste de curva). Aun pendiente: volver a medir el error de contorno interior restante de los preajustes `can` contra PowerPoint, y validar contra PowerPoint la ruta de contorno trazado usada para fuentes cuyo archivo no esta disponible. Vea [Fidelidad de efectos visuales](/guide/visual-effects) para la procedencia.                                                     |

Los reflejos, los bordes suaves y los degradados de ruta tambien son aproximaciones, pero se sostienen bien frente al PowerPoint real; vea [Fidelidad de efectos visuales](/guide/visual-effects) para la tecnica y la evidencia medida por COM detras de cada una.

### Carencias conocidas de renderizado y edicion (auditoria 09/2026)

Una auditoria de septiembre de 2026 contra PowerPoint real encontro estas carencias abiertas; las correcciones estan en curso:

- **Guardar una diapositiva editada puede perder detalle.** Una diapositiva se reescribe cuando algo en ella cambia, y la reescritura puede eliminar ecuaciones, convertir saltos de linea suaves en parrafos, fijar el formato heredado (anclajes, margenes internos, autoajuste, vinetas, fuentes del patron) sobre formas no tocadas, aplanar los fondos de tema, y desplazar las marcas de tiempo de los comentarios modernos segun la zona horaria local. Las diapositivas no editadas se convierten de ida y vuelta sin problemas.
- **Texto:** los campos de fecha basados en el marcador de posicion de fecha del patron estandar muestran `datetimeFigureOut`; las fuentes de tema por script (japones, tailandes, devanagari, arabe) no se aplican; los rellenos degradados de un fragmento de texto se reinician en cada palabra; las vinetas de imagen muestran una vineta simple; los modos de texto vertical, las columnas de texto, la alineacion distribuida, los tamanos de fragmento mixtos y algunos efectos de texto (reflejo, sombra interior, borde suave) difieren de PowerPoint.
- **Graficos:** los graficos de cotizaciones, superficie, caja y bigotes, pareto, histograma, embudo, mapa de arbol, sunburst y cascada difieren visiblemente de PowerPoint; los ejes X de dispersion, las ecuaciones de linea de tendencia y el grafico circular de circular son aproximados.
- **Tablas e imagenes:** los estilos de tabla integrados ignoran la transparencia del relleno (el Estilo de tema 2 se renderiza invisible), las filas que crecen automaticamente se recortan por el marco de la tabla, el texto de la tabla ignora el estilo de "otro texto" del patron, y Reconvertir a escala de grises/Lavado no se aplican.
- **Los modelos 3D** ignoran la camara, la transformacion y las luces creadas en PowerPoint.
- **La cobertura del editor** es un subconjunto de la de PowerPoint: Combinar formas, los controladores de recorte en el lienzo, Pegado especial, muchos atajos estandar (alineacion de parrafo, tamano de fuente, copiar/pegar formato) y varias galerias de la cinta aun no estan disponibles. Modificar puntos y las herramientas de dibujo Forma libre: forma y Curva estan disponibles en los cinco bindings.
- **La cobertura del editor** es un subconjunto de la de PowerPoint: Editar puntos, Pegado especial, muchos atajos estandar (alineacion de parrafo, tamano de fuente, copiar/pegar formato) y varias galerias de la cinta aun no estan disponibles.

## Metarchivos EMF/WMF (dependencia `emf-converter`)

::: info No es codigo de este repositorio
`emf-converter` es un paquete npm independiente con su propio repositorio; `pptx-viewer-core` solo lo consume. La tabla siguiente refleja lo que hace ese paquete hoy; si alguna vez difieren, sus propias notas de version son la fuente autorizada.
:::

::: warning Se requiere API Canvas
La conversion de metarchivos necesita `OffscreenCanvas` o `HTMLCanvasElement`. Node.js puro sin un polyfill de canvas no esta soportado para imagenes EMF/WMF (el resto del motor principal funciona bien en Node).
:::

| Funcion               | Estado                         | Notas                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pinceles de degradado | Paradas exactas y mosaico      | Los degradados lineales y radiales de GDI+ renderizan paradas de color, preajustes, factores de mezcla y transformaciones exactos. Desde emf-converter 3.1.0, el mosaico `WrapMode` funciona en cualquier angulo y los degradados de ruta siguen la forma de su limite (con un margen del 1-6 % respecto a Windows GDI+ segun el modo de ajuste). Los pinceles de textura (imagen) todavia se renderizan en negro solido. |
| Operaciones raster    | ROP3 exacto                    | Desde 3.1.0, los 256 codigos ROP3 se evaluan de forma exacta para `BitBlt`/`StretchBlt`/`StretchDIBits`. Los modos de pluma ROP2 bit a bit (AND/OR/XOR) se aproximan.                                                                                                                                                                                                                                                     |
| Texto                 | Motor de fuentes del navegador | Las metricas de los glifos pueden diferir de GDI de Windows. Desde 3.1.0, se respetan los arrays `dx` de `ExtTextOut`, el signo de la altura de `LOGFONT` y el escapement; sin un array `dx`, el espaciado depende de la sustitucion de fuentes del navegador. Las transformaciones de mundo rotadas o sesgadas en metarchivos GDI puros (no GDI+) no se aplican.                                                         |

## Lecturas relacionadas

- [Introduccion](/es/guide/introduction) - lo que el proyecto soporta en general.
- [Arquitectura](/es/guide/architecture) - por que existen estos compromisos.
- [Conformidad OpenXML](/architecture/openxml-conformance) - la definicion formal de "soportado" que usa el manifiesto de cobertura.
- [Fidelidad de efectos visuales](/guide/visual-effects) - aproximaciones de efectos CSS/SVG confirmadas contra PowerPoint real.
- [Entornos de ejecucion](/guide/runtime-environments) - donde se ejecuta cada parte de `pptx-viewer`, y notas de plataforma sobre el sandbox del navegador.
