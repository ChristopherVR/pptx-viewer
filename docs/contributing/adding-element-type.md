---
title: Adding an Element Type
description: The seven-step process for adding a new PptxElement type — interface, discriminated union, type guard, parsing, serialization, React renderer, and converter processor.
---

# Adding an Element Type

A `PptxElement` is a discriminated union of all the element kinds a slide can contain (`text`, `shape`, `image`, `table`, `chart`, `connector`, `group`, `smartArt`, `media`, `ink`, `ole`, and more). Adding a new kind touches the full round-trip: it must be **typed**, **parsed** from OpenXML, **serialized** back, **rendered** in React, and **converted** to Markdown.

This page walks through the seven steps end to end. For background on the union and how elements flow through the system, see [Data model](/guide/data-model) and [Concepts](/guide/concepts).

::: info
Throughout this walkthrough, replace `myThing` / `MyThing` / `"myThing"` with your actual element type name. Keep the discriminant string (`"myThing"`) identical everywhere it appears — it is the single value that ties parsing, narrowing, serialization, rendering, and conversion together.
:::

## Step 1 — Define the interface

**File:** `packages/core/src/core/types/elements.ts`

Define an interface that extends `PptxElementBase` (which carries shared geometry such as position, size, and rotation). The `type` field is the literal discriminant.

```ts
export interface PptxMyThingElement extends PptxElementBase {
	type: 'myThing';
	// ...fields specific to your element
	payload: string;
}
```

## Step 2 — Add to the discriminated union

**File:** `packages/core/src/core/types/elements.ts`

Add your interface to the `PptxElement` union so the rest of the codebase knows the new variant exists.

```ts
export type PptxElement =
	| PptxTextElement
	| PptxShapeElement
	| PptxImageElement
	// ...existing members
	| PptxMyThingElement;
```

## Step 3 — Add a type guard

**File:** `packages/core/src/core/types/type-guards.ts`

Add a narrowing helper that checks the `type` discriminant. This keeps narrowing centralized and reusable.

```ts
export function isMyThingElement(el: PptxElement): el is PptxMyThingElement {
	return el.type === 'myThing';
}
```

## Step 4 — Add parsing

**File:** `packages/core/src/core/runtime/` — a `PptxHandlerRuntime*Parsing.ts` mixin

Parsing lives in the runtime mixin layer. Create a new `PptxHandlerRuntime*Parsing.ts` module (or extend an existing one) that reads the relevant OpenXML and produces a `PptxMyThingElement`. Follow the existing mixin pattern — one concern per module — and remember to consume parsed XML through the `XmlObject` alias rather than `any`.

```ts
// PptxHandlerRuntimeMyThingParsing.ts
parseMyThing(node: XmlObject): PptxMyThingElement {
  return {
    type: "myThing",
    ...this.parseBaseGeometry(node),
    payload: getXmlText(node, "a:payload"),
  };
}
```

## Step 5 — Add serialization

**File:** `packages/core/src/core/runtime/*SaveElementWriter.ts`

Handle your new `type` when writing elements back to OpenXML so the save pipeline round-trips it. Narrow on the discriminant and emit the corresponding XML.

```ts
if (element.type === 'myThing') {
	return this.writeMyThing(element);
}
```

## Step 6 — Add a React renderer

**File:** `packages/react/src/viewer/components/elements/`

Add a presentational React component that renders your element. Rendering is CSS/SVG-based, not Canvas. Wire it into the element-dispatch switch so the renderer is selected by `element.type`.

```tsx
export function MyThingElement({ element }: { element: PptxMyThingElement }) {
	return <div className='ppt-mything'>{element.payload}</div>;
}
```

## Step 7 — Add a converter processor

**File:** `packages/core/src/converter/elements/`

Add a processor that emits Markdown (or positioned HTML) for your element. The converter uses a registry pattern that dispatches per element type, so register your processor for `"myThing"`.

```ts
export const myThingProcessor: ElementProcessor<PptxMyThingElement> = {
	type: 'myThing',
	process(element) {
		return element.payload;
	},
};
```

## Checklist

| Step | File                                                           | Adds                                  |
| ---- | -------------------------------------------------------------- | ------------------------------------- |
| 1    | `packages/core/src/core/types/elements.ts`                     | Interface extending `PptxElementBase` |
| 2    | `packages/core/src/core/types/elements.ts`                     | Member in the `PptxElement` union     |
| 3    | `packages/core/src/core/types/type-guards.ts`                  | `el.type === "myThing"` guard         |
| 4    | `packages/core/src/core/runtime/PptxHandlerRuntime*Parsing.ts` | OpenXML → element parsing             |
| 5    | `packages/core/src/core/runtime/*SaveElementWriter.ts`         | Element → OpenXML serialization       |
| 6    | `packages/react/src/viewer/components/elements/`               | React renderer                        |
| 7    | `packages/core/src/converter/elements/`                        | Markdown/HTML converter processor     |

::: tip
Add a colocated `.test.ts` for each new module as you go, and keep the discriminant string consistent across all seven steps. Run `bun run typecheck` after Step 2 — the union change will flag every `switch` and guard that still needs a case for your new type.
:::
