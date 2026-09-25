---
title: Limitaciones
description: Lo que no admiten el motor principal ni los enlaces de visualización - léalo antes de adoptar la biblioteca.
---

# Limitaciones

::: warning Lea esto antes de adoptar la biblioteca
`pptx-viewer` cubre una gran parte de la especificación OpenXML, pero algunas cosas se aproximan, son de solo lectura o están limitadas por la plataforma del navegador. Esta página recoge las limitaciones conocidas; no es una garantía exhaustiva de compatibilidad con cada función de Office o extensión de terceros. Revise `data.warnings` después de cargar una presentación y consulte [Conformidad OpenXML](/architecture/openxml-conformance) para el manifiesto formal de cobertura.
:::

## Motor principal (`pptx-viewer-core`)

| Función              | Estado                         | Notas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exportación a `.ppt` | Parcial                        | La tinta, SmartArt, los gráficos y los modelos 3D ahora se vuelven a abrir en PowerPoint como objetos editables gracias a un paquete OOXML de ida y vuelta incrustado (verificado reabriéndolos en PowerPoint mediante COM); solo PowerPoint 97-2003 ve la representación alternativa. Sigue habiendo pérdidas: las imágenes que no son PNG/JPEG se convierten en un marcador de posición, no se escriben las anulaciones de estilo de texto del patrón propias de la presentación, el vídeo y el audio que no es WAV se degradan a una imagen, y la importación de `.ppt` cifrados solo admite RC4 CryptoAPI. Consulte [Conformidad OpenXML](/architecture/openxml-conformance#ppt-export-ceiling).                                                       |
| Diseño de SmartArt   | Aproximado sin dibujo en caché | Las presentaciones guardadas sin el `dsp:drawing` en caché se maquetan con un motor DiagramML por punto (143 diseños) o con el intérprete por familias más antiguo. Frente a 229 fixtures de la galería creados mediante COM, 228 producen el mismo conjunto de formas que PowerPoint, 143 coinciden con su geometría con un margen del 1 % (181 con un margen del 5 %) y 129 coinciden en todos los tamaños de fuente. Siguen siendo inexactos Name and Title Organization Chart, las jerarquías etiquetadas y de tabla, los organigramas horizontales con asistentes y tres diseños (Arrow Ribbon, Balance, Varying Width List). Consulte [Conformidad OpenXML](/architecture/openxml-conformance#smartart-layout-ground-truth) para ver las mediciones. |

### Creación de animaciones

Un efecto creado en el panel de animación se integra en el árbol `p:timing` existente de la diapositiva; los efectos propios de la presentación se conservan idénticos byte a byte. Carencias conocidas:

- **Algunos efectos guardados todavía se reproducen como un desvanecimiento en PowerPoint.** Los efectos de entrada, salida y énfasis se escriben con el propio árbol de comportamiento de PowerPoint (Desplazar hacia dentro, Flotar, Rebotar, Aumentar y girar, las revelaciones con filtro, Pulso, Balancín, Onda y otros, verificado reabriéndolos en PowerPoint); Arrastrar y Espiral todavía se guardan como un desvanecimiento, y Parpadear es una aproximación.
- **Algunos preajustes se aproximan al reproducirse:** `strips`, `wedge`, la salida de círculo y el filtro `slide` se reproducen como lo hace PowerPoint (ajustados a sus propios fotogramas grabados), y `cover`/`uncover`/`push`/`pull` cortan como lo hace PowerPoint; unos 40 ID de preajustes de PowerPoint todavía reproducen un efecto sustituto (por ejemplo, Giro básico y Flotar hacia fuera se reproducen como un desvanecimiento), y las etiquetas del catálogo de preajustes para los ID 27 en adelante todavía no coinciden todas con los nombres de PowerPoint.
- **Compatibilidad parcial:** no se reproduce la ondulación por letra dentro de una animación por párrafo; un `p14:bounceEnd` del 100 % (sin recorrido restante, algo que el propio PowerPoint representa de forma errática) se limita al 95 %. Los desencadenadores de marcadores multimedia ("Al llegar al marcador"), las transiciones p15 con sus opciones de dirección y la dirección Acercar/Alejar de la transición Zoom se pueden crear en los cinco enlaces, y la curva de asentamiento de "Rebote final" está ajustada a los fotogramas del propio PowerPoint.

### Detectar carencias en tiempo de ejecución

No hace falta adivinar si un archivo se ha topado con una limitación. La canalización de carga informa de muchas construcciones no compatibles o aproximadas (no de todas: los efectos de animación sustitutos, por ejemplo, no generan ninguna advertencia) en `data.warnings`, con el tipo `PptxCompatibilityWarning`:

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

Revise `data.warnings` después de `load()` (y después de `save()`) si su aplicación necesita mostrar avisos de fidelidad a los usuarios o habilitar funciones según el archivo.

Consulte [Entornos de ejecución](/guide/runtime-environments) para saber dónde se ejecuta cada parte de `pptx-viewer` (navegador / Node.js / Web Worker) y qué comportamientos específicos de la plataforma se deben al entorno aislado del navegador y no a una función ausente.

## Visores para frameworks (React, Vue 3, Angular, Svelte 5, Vanilla JS)

::: warning El renderizado basado en CSS sacrifica algunos efectos visuales a cambio de fidelidad en otros aspectos
Las diapositivas se renderizan como HTML/CSS en lugar de Canvas, lo que ofrece texto nítido con cualquier zoom, accesibilidad nativa e interactividad del DOM. La contrapartida es que algunos efectos de PowerPoint no tienen un equivalente exacto en CSS y se aproximan.
:::

### Aproximaciones de efectos visuales

| Efecto                                                                                                      | Estado                                            | Notas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Formas y escenas 3D (`a:sp3d` / `a:scene3d`)                                                                | Error residual en el metal                        | Los materiales metálicos antes se veían desvaídos con esquemas de iluminación de elevación alta; la luz especular tiene ahora su propia elevación limitada, reajustada frente a 134 renderizados de PowerPoint (error absoluto medio de 75,0 a 36,4 en una escala de 0-255), de modo que queda un residuo menor. La corrección de biseles relaxedInset/slope/hardEdge del 2026-09-16 aún no se ha vuelto a verificar frente a un renderizado nuevo de PowerPoint. Consulte [Fidelidad de efectos visuales](/guide/visual-effects) para ver su procedencia.                                                                                                                                                                                                                                                                                                                                                                                                   |
| Deformaciones de envolvente de WordArt (`inflate` / `deflate` / `can` / `slant` / `fade` / `cascade` / ...) | Preajustes can inexactos en algunas profundidades | Los glifos se colocan por longitud de arco a lo largo de las curvas superior e inferior. Medido de nuevo frente a `Slide.Export` de PowerPoint (1920 px de ancho, Noto Sans, Verdana y Arial, 2026-09-25): los preajustes can obtienen un IoU de tinta de 0,94-0,97 con un error de contorno medio de 0,8-1,7 px (percentil 95: 1,5-6 px) en la mayoría de las profundidades, e `inflate` / `deflate` 0,96-0,97. En 9 de 20 valores de `adj` barridos (`textCanUp` 80000-93333, `textCanDown` 3333-23333), PowerPoint termina una o ambas filas de texto aproximadamente un 1,2 % del ancho del cuadro antes e inclina los glifos; esto no está modelado (IoU 0,73-0,86 en esos casos). Las fuentes cuyo archivo no se puede obtener usan un contorno trazado a partir del propio renderizado del navegador, que coincide con el archivo de fuente real con una diferencia de 0,002 de IoU. Consulte [Fidelidad de efectos visuales](/guide/visual-effects). |

Los reflejos, los bordes suaves y los degradados de trazado también son aproximaciones, pero se sostienen bien frente a PowerPoint real; consulte [Fidelidad de efectos visuales](/guide/visual-effects) para conocer la técnica y las mediciones por COM que respaldan cada uno.

### Carencias conocidas de renderizado y edición (auditoría de 2026-09)

Una auditoría de septiembre de 2026 frente a PowerPoint real encontró estas carencias que siguen abiertas:

- **Guardar una diapositiva editada todavía puede alterar detalles menores del marcado.** Las ecuaciones, los saltos de línea, el formato heredado, los estilos de texto del patrón, los fondos del tema, las marcas de tiempo de los comentarios, los rellenos de imagen, las acciones de clic en elementos multimedia, los idiomas y las propiedades de los fragmentos de texto, los fragmentos ruby, los anchos de contorno, los colores de las sombras interiores, las sangrías de los degradados, los colores de viñeta sobre una viñeta heredada, la alineación de tabulación, los metadatos de animación y audio, y los gráficos sin modificar se conservan en el ciclo de ida y vuelta, y `docProps` se actualiza al guardar tal como hace PowerPoint. En una diapositiva reescrita queda un pequeño residuo: un `<a:pPr/>` vacío se elimina, un `<a:p/>` sin ningún contenido adquiere un fragmento vacío, el `endParaRPr` de las notas y `prstTxWarp/avLst` pueden desaparecer, y los recuentos de palabras y párrafos en `docProps/app.xml` no se recalculan. Las diapositivas no editadas se conservan intactas.
- **Texto:** el salto de línea de Asia oriental sigue dentro de cada fragmento la puntuación colgante (`hangingPunct`) y las reglas kinsoku (`eaLnBrk`) de PowerPoint, pero un salto entre dos fragmentos de texto de Asia oriental con formato distinto sigue las reglas del navegador, y un `、` o `。` colgante seguido directamente de un paréntesis de cierre pasa a la línea siguiente con él en lugar de colgar (aún no comparado con PowerPoint).
- **Gráficos:** los cuadros y las llamadas de las etiquetas de datos se dimensionan con una estimación del ancho del texto en lugar de medirlo, y las etiquetas de los gráficos circulares en la posición `bestFit` quedan más cerca del centro de lo que las coloca PowerPoint.
- **Los modelos 3D** ignoran la cámara, la transformación y las luces definidas en PowerPoint.
- **La cobertura del editor** es un subconjunto de la de PowerPoint: varias galerías de la cinta aún no están disponibles. Modificar puntos (con las herramientas de dibujo Forma libre: forma y Curva), Combinar formas, el recorte de imágenes sobre el lienzo (controladores de recorte, Recortar a la relación de aspecto, Rellenar, Ajustar), Pegado especial, los menús contextuales del lienzo vacío y de los elementos, la selección múltiple en el panel de diapositivas, una vista previa real de animaciones en su sitio y los atajos de edición habituales están disponibles en los cinco enlaces.

## Metarchivos EMF/WMF (dependencia `emf-converter`)

::: info No es código de este repositorio
`emf-converter` es un paquete npm independiente con su propio repositorio; `pptx-viewer-core` solo lo consume. La tabla siguiente recoge lo que ese paquete hace hoy, así que, si ambos llegaran a discrepar, sus propias notas de versión son las que cuentan.
:::

::: warning Se requiere la API de Canvas
La conversión de metarchivos necesita `OffscreenCanvas` o `HTMLCanvasElement`. Node.js puro sin un polyfill de canvas no es compatible con imágenes EMF/WMF (el resto del motor principal funciona sin problemas en Node).
:::

| Función                            | Estado                         | Notas                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pinceles de degradado y de textura | Residuo de remuestreo          | Los degradados, los pinceles de trama y los pinceles de textura EMF+ (incluidos los mapas de bits comprimidos, desde 3.3.0) se renderizan con paradas de color y mosaico exactos; el filtrado de patrones del navegador deja una pequeña diferencia de suavizado de bordes respecto a Windows GDI+ (medida en el README del paquete).                                                                                                                        |
| Operaciones ráster                 | Exactas                        | Los 256 códigos ROP3 y todos los modos de pluma ROP2 a nivel de bits, también dentro de trazados `BeginPath`/`EndPath` (desde 3.3.0), se evalúan con exactitud.                                                                                                                                                                                                                                                                                              |
| Texto y transformaciones           | Motor de fuentes del navegador | Las métricas de los glifos pueden diferir de Windows GDI: se respetan las matrices `dx` de `ExtTextOut`, el signo de la altura de `LOGFONT` y el escapement, pero sin una matriz `dx` el espaciado depende de la sustitución de fuentes del navegador. Las transformaciones de mundo con rotación e inclinación se aplican a formas, transferencias de bloques (blits) y texto (desde 3.3.0); el texto bajo una inclinación usa un único ángulo de rotación. |

## Lecturas relacionadas

- [Introducción](/es/guide/introduction) - lo que admite el proyecto en general.
- [Arquitectura](/es/guide/architecture) - por qué existen estas concesiones.
- [Conformidad OpenXML](/architecture/openxml-conformance) - la definición formal de "compatible" que utiliza el manifiesto de cobertura.
- [Fidelidad de efectos visuales](/guide/visual-effects) - aproximaciones de efectos CSS/SVG confirmadas frente a PowerPoint real.
- [Entornos de ejecución](/guide/runtime-environments) - dónde se ejecuta cada parte de `pptx-viewer` y notas de plataforma sobre el entorno aislado del navegador.
