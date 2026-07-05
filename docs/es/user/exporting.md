---
title: Exportar
description: Guarde y exporte su presentacion a PNG, PDF, GIF, video, .pptx y mas.
---

# Exportar

Puede exportar la diapositiva actual o toda la presentacion en varios formatos. Las acciones de exportacion se encuentran en la pestana **Archivo** de la barra de herramientas.

## Formatos disponibles

| Formato                | Lo que obtiene                                         | Alcance            |
| ---------------------- | ------------------------------------------------------ | ------------------ |
| **Imagen PNG**         | Una imagen raster de la diapositiva actual.            | Diapositiva actual |
| **Copiar como imagen** | Copia la diapositiva en el portapapeles.               | Diapositiva actual |
| **PDF**                | Un PDF de varias paginas, una diapositiva por pagina.  | Deck completo      |
| **GIF**                | Un GIF animado que recorre las diapositivas.           | Deck completo      |
| **Video**              | Un video `.webm` que recorre las diapositivas.         | Deck completo      |
| **Guardar como PPTX**  | Un archivo PowerPoint estandar con sus ediciones.      | Deck completo      |
| **Guardar como PPSX**  | Un archivo de presentacion de diapositivas PowerPoint. | Deck completo      |

::: tip Exportacion SVG
Tambien hay disponible una ruta de exportacion vectorial **SVG**. Al ser basado en vectores, evita los limites de rasterizacion.
:::

## Como exportar

1. Abra la pestana **Archivo** de la barra de herramientas.
2. Elija **Exportar** y seleccione un formato.
3. Para formatos de deck completo (PDF, GIF, video), aparece un **dialogo de progreso**.
4. El archivo terminado se descarga automaticamente.

## Notas de fidelidad

::: warning Las exportaciones raster son una aproximacion
PNG, JPEG, PDF, GIF y las exportaciones de video rasterizan el HTML/CSS usando `html2canvas`. Algunas funciones CSS no son totalmente compatibles. Para la salida mas fiel, prefiera la exportacion **SVG**.
:::

## A continuacion

- [Colaboracion](/es/user/collaboration)
