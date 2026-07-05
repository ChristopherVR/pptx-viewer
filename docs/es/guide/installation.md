---
title: Instalacion
description: Instale los paquetes pptx-viewer desde npm, configure las dependencias para React, Vue 3 o Angular, y ejecute el monorepo localmente.
---

# Instalacion

Los paquetes `pptx-viewer` se publican independientemente en npm. Instale solo lo que necesite: el [motor principal](/core/) independiente del framework o uno de los paquetes de visualizacion.

::: tip Version de Node
Se requiere Node.js **18 o superior** para la compilacion TypeScript y para ejecutar los paquetes fuera del navegador.
:::

## Elegir su framework

| Framework                   | Paquete               | Notas                                                            |
| --------------------------- | --------------------- | ---------------------------------------------------------------- |
| React                       | `pptx-react-viewer`   | Completo: visualizador, editor, presentador, exportacion, collab |
| Vue 3                       | `pptx-vue-viewer`     | Mismo motor y conjunto de funciones                              |
| Angular                     | `pptx-angular-viewer` | Mismo motor y conjunto de funciones                              |
| Headless (Node / navegador) | `pptx-viewer-core`    | Sin interfaz, sin dependencia de framework                       |
| Herramientas IA / MCP       | `pptx-viewer-mcp`     | 25 herramientas MCP + CLI + codec Y.Doc                          |

## Instalacion desde npm

### Visualizador React

El componente visualizador/editor React completo, publicado como **`pptx-react-viewer`**. El motor principal esta **incluido**, no necesita instalarlo por separado.

::: code-group

```bash [npm]
npm install pptx-react-viewer react react-dom
```

```bash [pnpm]
pnpm add pptx-react-viewer react react-dom
```

```bash [yarn]
yarn add pptx-react-viewer react react-dom
```

```bash [bun]
bun add pptx-react-viewer react react-dom
```

:::

::: tip Otras dependencias
El visualizador tambien requiere `framer-motion`, `lucide-react`, `react-icons`, `jspdf`, `jszip`, `fast-xml-parser` e `i18next`/`react-i18next` - instale los que necesite.
:::

### Visualizador Vue 3

El componente Vue 3, publicado como **`pptx-vue-viewer`**. El motor principal esta incluido.

::: code-group

```bash [npm]
npm install pptx-vue-viewer vue
```

```bash [pnpm]
pnpm add pptx-vue-viewer vue
```

```bash [yarn]
yarn add pptx-vue-viewer vue
```

```bash [bun]
bun add pptx-vue-viewer vue
```

:::

### Visualizador Angular

El componente Angular, publicado como **`pptx-angular-viewer`**. El motor principal esta incluido.

::: code-group

```bash [npm]
npm install pptx-angular-viewer @angular/core @angular/common
```

```bash [pnpm]
pnpm add pptx-angular-viewer @angular/core @angular/common
```

```bash [yarn]
yarn add pptx-angular-viewer @angular/core @angular/common
```

```bash [bun]
bun add pptx-angular-viewer @angular/core @angular/common
```

:::

### Motor principal

El motor independiente del framework para analizar, editar, serializar y convertir archivos PPTX.

::: code-group

```bash [npm]
npm install pptx-viewer-core
```

```bash [pnpm]
pnpm add pptx-viewer-core
```

```bash [yarn]
yarn add pptx-viewer-core
```

```bash [bun]
bun add pptx-viewer-core
```

:::

### Servidor MCP y herramientas

25 funciones de herramientas de manipulacion PPTX, un servidor MCP para agentes IA y el codec de colaboracion Y.Doc.

::: code-group

```bash [npm]
npm install pptx-viewer-mcp
```

```bash [pnpm]
pnpm add pptx-viewer-mcp
```

```bash [yarn]
yarn add pptx-viewer-mcp
```

```bash [bun]
bun add pptx-viewer-mcp
```

:::

## Dependencias opcionales

Algunas funciones del paquete React solo se activan cuando sus dependencias opcionales estan presentes.

| Funcion                         | Dependencias opcionales | Notas                                           |
| ------------------------------- | ----------------------- | ----------------------------------------------- |
| **Modelos 3D** (GLB/GLTF)       | `three`                 | Sin ellas, los elementos 3D muestran su imagen. |
| **Colaboracion en tiempo real** | `yjs`, `y-websocket`    | Yjs CRDT con seguimiento de presencia.          |

## Desarrollo local (clonacion del monorepo)

El monorepo usa **Bun** como gestor de paquetes. Los paquetes se referencian mutuamente mediante el protocolo `workspace:*`.

```bash
# Clonar el repositorio
git clone https://github.com/ChristopherVR/pptx-viewer
cd pptx-viewer

# Instalar todas las dependencias
bun install

# Construir todos los paquetes
bun run build

# Pruebas y verificacion de tipos
bun run test
bun run typecheck
```

::: warning El orden de construccion importa
Los paquetes deben construirse en el orden de dependencias:

```
core -> shared -> react / vue / angular
```

`bun run build` desde la raiz del repositorio gestiona esto automaticamente.
:::

### Comandos comunes

```bash
bun run build        # Construir todos los paquetes en orden
bun run test         # Ejecutar vitest en todos los paquetes
bun run typecheck    # Verificar tipos de todos los paquetes
bun run fmt          # Formatear con oxfmt
bun run lint         # Linting con oxlint
bun run demo         # Iniciar servidor de demo React (puerto 4173)
bun run demo:vue     # Iniciar servidor de demo Vue (puerto 4175)
bun run demo:angular # Iniciar servidor de demo Angular (puerto 4174)
```

## Proximos pasos

- [Inicio rapido](/es/guide/quick-start) - crear, analizar, convertir y renderizar presentaciones.
- [Arquitectura](/es/guide/architecture) - como encajan las capas.
- [Limitaciones](/es/guide/limitations) - advertencias importantes antes de ir a produccion.
