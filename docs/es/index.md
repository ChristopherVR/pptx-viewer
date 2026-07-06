---
layout: home
title: pptx-viewer
hero:
  name: 'pptx-viewer'
  text: 'SDK de PowerPoint para TypeScript'
  tagline: Analice, cree, edite, renderice y convierta archivos .pptx en el navegador y Node.js. Compatible con React, Vue 3 y Angular. Sin dependencias nativas.
  actions:
    - theme: brand
      text: Empezar
      link: /es/guide/introduction
    - theme: brand
      text: Probar la demo
      link: https://christophervr.github.io/pptx-viewer/demo/
    - theme: alt
      text: Guia de usuario
      link: /user/
    - theme: alt
      text: Ver en GitHub
      link: https://github.com/ChristopherVR/pptx-viewer

features:
  - icon: "\U0001F4C2"
    title: Analisis y ciclo completo
    details: Cargue archivos .pptx en un modelo PptxData completamente tipado y serialice las ediciones de vuelta a un archivo valido. Maneja 16 tipos de elementos, temas, mascaras y conformidad OOXML Strict.
    link: /core/loading
    linkText: Carga y analisis
  - icon: "\U0001F3D7\uFE0F"
    title: Construccion desde cero
    details: Una API de construccion fluida para crear presentaciones por codigo - texto, formas, imagenes, tablas, graficos y mas, sin tocar XML crudo.
    link: /core/builder
    linkText: La API Builder
  - icon: "\u269B\uFE0F"
    title: React, Vue y Angular
    details: Componentes de visualizacion integrados para los tres principales frameworks. El mismo motor de renderizado impulsa todos los enlaces - diapositivas HTML/CSS, fidelidad visual completa, sin Canvas.
    link: /es/guide/installation
    linkText: Elegir un framework
  - icon: "\U0001F4DD"
    title: Conversion a Markdown
    details: Convierta presentaciones a Markdown limpio (o HTML posicionado) con extraccion opcional de medios, notas del presentador y metadatos.
    link: /core/converter
    linkText: Conversor de Markdown
  - icon: "\U0001F3A8"
    title: Renderizado fiel
    details: 187+ formas predefinidas, 23 tipos de graficos, SmartArt, animaciones, transiciones morph, metarchivos EMF/WMF, fuentes incrustadas y modelos 3D.
    link: /guide/data-model
    linkText: El modelo PptxData
  - icon: "\U0001F916"
    title: Herramientas MCP e IA
    details: 25 funciones de herramientas puras, esquemas Zod y un servidor MCP para que los agentes de IA puedan leer, escribir y transformar archivos PPTX.
    link: /packages/mcp
    linkText: MCP y herramientas
  - icon: "\U0001F91D"
    title: Colaboracion y cifrado
    details: Coedicion en tiempo real mediante Yjs CRDT con seguimiento de presencia. Cifrado AES-128/256 para archivos protegidos por contrasena.
    link: /react/collaboration
    linkText: Colaboracion
  - icon: "\U0001F680"
    title: Exportar todo
    details: Exportacion PNG, JPEG, SVG, PDF, GIF y video desde el navegador. La exportacion SVG tambien funciona en modo headless en Node.js.
    link: /react/export
    linkText: Opciones de exportacion
---

<div style="max-width: 1152px; margin: 3rem auto 0; padding: 0 24px;">

## Elegir su entorno

Los paquetes de interfaz **incluyen el motor principal**, por lo que solo instala un paquete:

| Estoy construyendo...           | Instalar                    | Lo que obtiene                                                             |
| ------------------------------- | --------------------------- | -------------------------------------------------------------------------- |
| **Aplicacion React**            | `npm i pptx-react-viewer`   | Visualizador + editor WYSIWYG, modo presentador, exportacion, colaboracion |
| **Aplicacion Vue 3**            | `npm i pptx-vue-viewer`     | El mismo conjunto de funciones, basado en el mismo motor                   |
| **Aplicacion Angular**          | `npm i pptx-angular-viewer` | El mismo conjunto de funciones, basado en el mismo motor                   |
| **Headless (Node / navegador)** | `npm i pptx-viewer-core`    | Analizar, crear, editar, convertir, cifrar - sin interfaz ni dependencia   |
| **Herramientas IA / MCP**       | `npm i pptx-viewer-mcp`     | 25 herramientas MCP, CLI, codec de colaboracion Y.Doc                      |

?No sabe cual elegir? `npx @christophervr/pptx-viewer` le guia interactivamente.

</div>
