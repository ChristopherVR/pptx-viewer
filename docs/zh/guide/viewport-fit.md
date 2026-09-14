---
title: 视口适配
description: 配置幻灯片在自定义容器中的适配方式，不改变原始幻灯片尺寸或用户缩放比例。
---

# 视口适配 {#viewport-fitting}

五个 UI 组件都支持可选的 `fitPadding` 和 `maxFitScale` 宿主配置。如果宿主容器已经提供了边距，并且允许幻灯片超过原始像素尺寸，可以设置 `fitPadding: 0` 和 `maxFitScale: null`。省略这些选项时，组件沿用原有的适配策略。

## 选项和默认值 {#options-and-defaults}

`fitPadding` 表示**每一侧**预留的未缩放 CSS 像素数：`8` 会在水平和垂直方向各预留 16 像素；`{ horizontal: 4, vertical: 16 }` 会在水平方向共预留 8 像素，在垂直方向共预留 32 像素。`maxFitScale` 是适配缩放系数的正数上限；`null` 表示不设上限。无效值会回退到各组件的默认值。

| 组件    | 单侧水平 / 垂直边距 | 最大适配缩放系数 |
| ------- | ------------------- | ---------------- |
| React   | 4 / 16 px           | 1                |
| Vue     | 8 / 16 px           | 1                |
| Angular | 8 / 16 px           | 1                |
| Svelte  | 24 / 24 px          | 不限             |
| Vanilla | 16 / 16 px          | 不限             |

每个 UI 包均导出 `ViewportFitOptions` 和 `ViewportFitPadding` 类型。这些选项只影响普通预览模式下的适配，不会改变原始幻灯片尺寸、保存内容、缩略图、导出、放映模式或独立的用户缩放设置。Vanilla 组件在省略 `fitPadding` 时会保留现有的移动端 CSS 边距。

## 配置组件 {#configure-your-viewer}

为宿主容器设置实际的宽度和高度。作为 flex 子项时，还可能需要设置 `min-height: 0`，使其能够适应可用空间。将适配边距设为零，并不能收回工具栏、侧边面板或宿主界面其他部分占用的空间。

### React {#react}

```tsx
<PowerPointViewer content={content} fitPadding={0} maxFitScale={null} />
```

通过 `useViewerBuildingBlocks` 将 `Toolbar` 和 `SlideCanvas` 组合为自定义界面时，也可以传入相同的选项。例如：

```tsx
const { canvasProps, toolbarProps } = useViewerBuildingBlocks({
	content,
	canEdit: true,
	fitPadding: 0,
	maxFitScale: null,
});
```

按常规方式渲染返回的属性即可。适配使用实际测量的画布视口尺寸，不会将工具栏所在的整个宿主容器算入。已有的标尺偏移仍然生效；如果自定义 `SlideCanvas` 必须与视口边缘直接对齐，请设置 `showRulers={false}`。

### Vue {#vue}

```vue
<PowerPointViewer :content="content" :fit-padding="0" :max-fit-scale="null" />
```

`SlideCanvas` 也提供相同的属性。

### Angular {#angular}

```html
<pptx-viewer [content]="content()" [fitPadding]="0" [maxFitScale]="null" />
```

### Svelte {#svelte}

```svelte
<PowerPointViewer {source} fitPadding={0} maxFitScale={null} />
```

### 原生 JavaScript {#vanilla-js}

```ts
const viewer = createPptxViewer(container, {
	source,
	fitPadding: 0,
	maxFitScale: null,
});
```

各组件会保留现有的标尺布局。如果宿主需要贴边适配，请关闭标尺。修改 `fitPadding` 不会移除标尺占用的空间，也不会改变组件的其他布局控制。
