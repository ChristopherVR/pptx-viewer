# Element renderers

One file per `PptxElement` type. The stage dispatches every element through an
`ElementRendererRegistry` (see `../types.ts`), so new element types are added
by registering a renderer, WITHOUT touching the stage, the registry, or the
existing renderer files.

## Current status

| Type                                        | Renderer                                            |
| ------------------------------------------- | --------------------------------------------------- |
| `text`, `shape`                             | `text-shape.ts`                                     |
| `image`, `picture`                          | `image.ts`                                          |
| `group`                                     | `group.ts`                                          |
| `connector`                                 | `connector.ts`                                      |
| `table`                                     | `table.ts` (\*)                                     |
| `chart`                                     | `chart.ts` + `chart-svg.ts` (\*)                    |
| `smartArt`                                  | `smartart.ts` + `smartart-{svg,fallback}.ts` (\*\*) |
| `media`                                     | `media.ts` (\*\*)                                   |
| `ink`                                       | `ink.ts` (\*\*)                                     |
| `ole`                                       | `ole.ts` + `ole-icons.ts` (\*\*)                    |
| `contentPart`, `zoom`, `model3d`, `unknown` | `placeholder.ts` (fallback)                         |

(\*) Registered via `registerTableChartRenderers` in `register-table-chart.ts`.
(\*\*) Registered via `registerRichMediaRenderers` in `register-rich-media.ts`.
Both are wired into `createDefaultRegistry()` in `index.ts`.

## Adding a renderer (e.g. `table`)

1. Create `table.ts` in this directory exporting an `ElementRenderer`
   (`import type { ElementRenderer } from '../types';`):

   ```ts
   export const renderTableElement: ElementRenderer = (element, zIndex, context) => {
   	if (element.type !== 'table') {
   		return null;
   	}
   	// build and return an HTMLElement / SVGElement
   };
   ```

2. Follow the renderer contract (documented on `ElementRenderer` in
   `../types.ts`):
   - Apply the shared `getContainerStyle(element, zIndex)` map (import from
     `pptx-viewer-shared`, apply with `applyStyleMap` from `../dom.ts`) so the
     node is absolutely positioned in unscaled canvas px. The stage scales via
     a CSS transform; do not scale yourself.
   - Set `el.dataset.elementId = element.id` on the root node.
   - Create all DOM via `context.document`, never the global `document`.
   - Reuse `pptx-viewer-shared` for ALL pure logic (chart view models, table
     cell styles, ink paths, ...). Grep `packages/vue/src` for the shared
     functions its equivalent component calls and call the same ones. Do not
     reimplement math/style logic here.
   - Never mutate `element` or the context.

3. Register it in `createDefaultRegistry()` (`index.ts` here) and add the
   export. That is the only existing file you touch.

4. Add a colocated `table.test.ts` (see `registry.test.ts` and
   `slide-stage.test.ts` for patterns; happy-dom is the vitest environment).

5. Update the status table above.

Hosts can also inject renderers at runtime without forking the package:

```ts
const viewer = createPptxViewer(container, { ... });
viewer.getRegistry().register('table', myTableRenderer);
```
