---
title: Viewport Fitting
description: Configure slide fitting inside a custom host without changing authored slide dimensions or user zoom.
---

# Viewport fitting

All five UI bindings accept optional `fitPadding` and `maxFitScale` host options.
Use `fitPadding: 0` and `maxFitScale: null` when the host already supplies its own
gutters and the slide should be allowed to grow beyond its original pixel size.
Omitting these options preserves the existing fit policy.

## Options and defaults

`fitPadding` is an unscaled CSS-pixel allowance **on each side**: `8` reserves
16 pixels in each axis; `{ horizontal: 4, vertical: 16 }` reserves 8 pixels
horizontally and 32 vertically. `maxFitScale` is a positive fit-factor ceiling;
`null` means unlimited. Invalid values fall back to the binding's defaults.

| Binding | Per-side horizontal / vertical padding | Maximum fit scale |
| ------- | -------------------------------------- | ----------------- |
| React   | 4 / 16 px                              | 1                 |
| Vue     | 8 / 16 px                              | 1                 |
| Angular | 8 / 16 px                              | 1                 |
| Svelte  | 24 / 24 px                             | Unlimited         |
| Vanilla | 16 / 16 px                             | Unlimited         |

Each UI package exports the `ViewportFitOptions` and `ViewportFitPadding` types.
These options affect ordinary viewer fitting, not authored slide dimensions,
saved content, thumbnails, export, presentation mode, or the separate user zoom
setting. Vanilla preserves its existing mobile CSS padding when `fitPadding`
is omitted.

## Configure your viewer

Give the host a real width and height. A flex child may also need `min-height: 0`
so it can fit within the available space. Zero fit padding cannot recover space
used by toolbars, side panels, or other host chrome.

### React

```tsx
<PowerPointViewer content={content} fitPadding={0} maxFitScale={null} />
```

The same options can be passed to `useViewerBuildingBlocks` when composing
`Toolbar` and `SlideCanvas` into a custom shell. For example:

```tsx
const { canvasProps, toolbarProps } = useViewerBuildingBlocks({
	content,
	canEdit: true,
	fitPadding: 0,
	maxFitScale: null,
});
```

Render the returned props as usual; fitting uses the measured canvas viewport,
not the entire host including its toolbar. Existing ruler offsets remain in
effect. Set `showRulers={false}` on a custom `SlideCanvas` when it must align
directly with the viewport edges.

### Vue

```vue
<PowerPointViewer :content="content" :fit-padding="0" :max-fit-scale="null" />
```

The same props are available on `SlideCanvas`.

### Angular

```html
<pptx-viewer [content]="content()" [fitPadding]="0" [maxFitScale]="null" />
```

### Svelte

```svelte
<PowerPointViewer {source} fitPadding={0} maxFitScale={null} />
```

### Vanilla JS

```ts
const viewer = createPptxViewer(container, {
	source,
	fitPadding: 0,
	maxFitScale: null,
});
```

Existing ruler layout is preserved in each binding. Disable rulers when the
host needs edge-aligned fitting; changing `fitPadding` does not remove ruler
space or change the viewer's other layout controls.
