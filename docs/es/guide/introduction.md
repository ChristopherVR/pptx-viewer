---
title: Que es pptx-viewer?
description: Una descripcion general del monorepo TypeScript pptx-viewer para analizar, editar, renderizar y convertir archivos PowerPoint con React, Vue 3 y Angular.
---

# Que es pptx-viewer?

`pptx-viewer` es un monorepo TypeScript completo para **analizar, editar, renderizar y convertir** archivos Microsoft PowerPoint (`.pptx`) - en el navegador y en Node.js. Funciona completamente en memoria sobre el archivo ZIP OpenXML sin dependencias nativas.

Mientras que la mayoria de las bibliotecas de PowerPoint hacen una sola cosa - generar diapositivas _o_ renderizarlas _o_ extraer texto - `pptx-viewer` cubre el ciclo completo: cargar un archivo existente, mutar su modelo de datos estructurado, renderizarlo con total fidelidad visual y guardarlo de vuelta en un archivo `.pptx` valido. El mismo motor principal impulsa componentes de visualizacion integrados para **React**, **Vue 3** y **Angular**.

## Lo que hace

El SDK proporciona nueve capacidades principales:

1. **Analizar** archivos `.pptx` desde un `ArrayBuffer` bruto en un modelo [`PptxData`](/guide/data-model) estructurado.
2. **Crear** presentaciones desde cero con una API de construccion fluida.
3. **Renderizar** diapositivas como componentes React, Vue o Angular interactivos con total fidelidad visual.
4. **Editar** presentaciones de forma programatica o mediante el editor WYSIWYG integrado.
5. **Guardar** los cambios de vuelta en un archivo `.pptx` valido (compatible con ida y vuelta).
6. **Convertir** presentaciones a Markdown con extraccion opcional de medios.
7. **Exportar** diapositivas como imagenes (PNG/JPEG), SVG, PDF, GIF o video.
8. **Colaborar** en tiempo real via Yjs CRDT con seguimiento de presencia.
9. **Cifrar/Descifrar** archivos PPTX protegidos por contrasena (AES-128/256).

El motor maneja la especificacion OpenXML completa incluyendo 16 tipos de elementos, 187+ formas predefinidas, 23 tipos de graficos, SmartArt, modelos 3D, animaciones, transiciones (incluyendo morph), temas, mascaras de diapositivas, medios incrustados, metarchivos EMF/WMF, objetos OLE, tinta digital, firmas digitales, cifrado, preservacion de macros VBA y conformidad OOXML Strict.

## Los paquetes

El monorepo publica seis paquetes independientes.

| Paquete                | Nombre npm                   | Proposito                                                                                                  |
| ---------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Core**               | `pptx-viewer-core`           | Analizar, crear, editar, serializar y convertir archivos PPTX. Independiente del framework.                |
| **React**              | `pptx-react-viewer`          | Visualizador, editor y presentador React con barra de herramientas, inspector, colaboracion y exportacion. |
| **Vue 3**              | `pptx-vue-viewer`            | Visualizador/editor Vue 3 construido sobre el mismo motor, con el mismo conjunto de funciones.             |
| **Angular**            | `pptx-angular-viewer`        | Visualizador/editor Angular construido sobre el mismo motor, con el mismo conjunto de funciones.           |
| **Herramientas / MCP** | `pptx-viewer-mcp`            | 25 funciones de herramientas PPTX, un servidor MCP para agentes IA y el codec de colaboracion Y.Doc.       |
| **Instalador**         | `@christophervr/pptx-viewer` | CLI interactivo que integra el paquete de visualizacion correcto en su proyecto.                           |

### Grafo de dependencias

Los tres paquetes de frameworks de interfaz se basan en la capa compartida, que a su vez se basa en Core:

```
pptx-react-viewer   ┐
pptx-vue-viewer     ├── pptx-viewer-shared ── pptx-viewer-core
pptx-angular-viewer ┘                               ├── emf-converter
                                                    └── mtx-decompressor
```

## Para quien esta disenado?

- **Desarrolladores React que crean interfaces de visualizacion/edicion** - use [`pptx-react-viewer`](/react/). Envuelve el motor principal en un componente `PowerPointViewer` que renderiza, edita, presenta y exporta diapositivas listo para usar.
- **Desarrolladores Vue 3** - use `pptx-vue-viewer`. Mismo motor y conjunto de funciones que el enlace React.
- **Desarrolladores Angular** - use `pptx-angular-viewer`. Misma historia: mismo motor, mismo conjunto de funciones.
- **Desarrolladores que automatizan o incrustan PowerPoint sin interfaz** - use [`pptx-viewer-core`](/core/). Sin interfaz, sin dependencia de framework. Funciona en una pestana del navegador, una funcion serverless, un script de construccion Node.js o un Web Worker.
- **Flujos de trabajo de IA / LLM** - use [`pptx-viewer-mcp`](/packages/mcp). El servidor MCP expone las 25 funciones de herramientas a cualquier cliente compatible con MCP (Claude Desktop, Cursor, VS Code Copilot).

## Proximos pasos

- [Instalacion](/es/guide/installation) - instalar los paquetes y configurar el desarrollo local.
- [Inicio rapido](/es/guide/quick-start) - flujos de extremo a extremo para ser productivo rapidamente.
- [Descripcion del paquete Core](/core/) - el motor de analisis, edicion y serializacion.
- [Descripcion del paquete React](/react/) - el componente visualizador/editor.
- [Limitaciones](/guide/limitations) - advertencias importantes a leer antes de adoptar.
