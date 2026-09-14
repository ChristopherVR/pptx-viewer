---
title: 功能限制
description: 了解核心引擎和各框架组件尚不支持或需要近似处理的功能，供选型前参考。
---

# 功能限制 {#limitations}

::: warning 使用前请阅读
`pptx-viewer` 覆盖了 OpenXML 规范的较大范围，但部分功能采用近似实现、仅支持读取，或受浏览器平台限制。本页记录已知限制，不代表对所有 Office 功能和第三方扩展的完整兼容性保证。加载演示文稿后请检查 `data.warnings`；正式的覆盖清单见 [OpenXML 支持情况](/zh/architecture/openxml-conformance)。
:::

## 核心引擎（`pptx-viewer-core`） {#core-engine-pptx-viewer-core}

| 功能                                      | 状态                       | 说明                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.ppt` 超链接、OLE 嵌入对象及不支持的元素 | 降级处理                   | 墨迹、SmartArt、图表和三维模型在导出为 `.ppt` 时会变为位图，无法作为原始对象继续编辑。PowerPoint 自身对墨迹和 SmartArt 的原生编辑路径依赖未公开的形状属性，图表和三维模型的回退方式也涉及没有公开规范的旧格式。测量依据见 [OpenXML 支持情况](/zh/architecture/openxml-conformance#ppt-export-ceiling)。 |
| SmartArt 布局                             | 缺少缓存绘图时采用近似布局 | 未保存缓存 `dsp:drawing` 的演示文稿由解释器计算布局。在 227 个通过 COM 创建的图库测试样例中，有 226 个的复现误差小于 1%。测量依据见 [OpenXML 支持情况](/zh/architecture/openxml-conformance#smartart-layout-ground-truth)。                                                                             |

### 动画编辑 {#animation-authoring}

在动画面板中创建的效果会合并到幻灯片已有的 `p:timing` 树中，演示文稿原有的效果保持字节不变。`p:animEffect/@filter` 的全部 27 个 SMIL 效果族均映射为实际的显示或隐藏效果，并与 PowerPoint 自身的播放行为对应。其中 25 个完全使用原生 CSS；`wipe` 和 `barn` 复用方向遮罩揭示引擎。`pixelate` 默认采用与 PowerPoint 相同的直接跳到最终状态的行为，验证依据及可选的马赛克效果见[视觉效果还原](/zh/guide/visual-effects#pixelate-transition-filter-p-animeffect-filter-pixelate)。`image` 也没有需要列入此处的功能缺口，详见 [OpenXML 支持情况](/zh/architecture/openxml-conformance#extension-namespace-and-schema-edge-attributes)。

### 运行时检测兼容性问题 {#detecting-gaps-at-runtime}

无需猜测某个文件是否触及功能限制。加载流程会将遇到的不支持或近似处理的结构记录在 `data.warnings` 中，其类型为 `PptxCompatibilityWarning`：

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

如果应用需要向用户提示还原度问题，或根据文件情况决定启用哪些功能，请在 `load()` 后检查 `data.warnings`，并在 `save()` 后再次检查。

各部分在浏览器、Node.js 和 Web Worker 中的运行范围，以及由浏览器沙箱带来的平台差异，见[运行环境](/zh/guide/runtime-environments)。

## 各框架组件（React、Vue 3、Angular、Svelte 5、原生 JavaScript） {#framework-viewers-react-vue-3-angular-svelte-5-vanilla-js}

::: warning 基于 CSS 的渲染需要对部分视觉效果作出取舍
幻灯片通过 HTML/CSS 而非 Canvas 显示，可以提供缩放后依然清晰的文本、原生无障碍能力和 DOM 交互。相应的取舍是：少数 PowerPoint 效果没有完全对应的 CSS 表达方式，需要近似处理。
:::

### 近似实现的视觉效果 {#visual-effect-approximations}

| 效果                                                                                 | 状态                                     | 说明                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 三维形状和场景（`a:sp3d` / `a:scene3d`）                                             | 三种棱台轮廓采用近似实现                 | relaxedInset、slope 和 hardEdge 棱台的截面会先亮后暗，单一高度图模型无法复现。高仰角光照下，金属材质还会因高光项与漫反射仰角耦合而过度饱和。三维模型的其他部分均经过 COM 测量，依据见[视觉效果还原](/zh/guide/visual-effects)。                                                                                         |
| 艺术字包络变形（`inflate` / `deflate` / `can` / `slant` / `fade` / `cascade` / ...） | can 预设及无法获取字体文件的情况存在误差 | can 预设仍有 5-18% 的水平残差，因为尚未推导出 PowerPoint 沿圆柱分布字形时的间距规则。无法取得字体文件时，会退回逐字形仿射拟合（约 1-2% 误差），而非精确的轮廓变形。非常短且被大幅拉伸的段落仍可能轻微越过相邻行。依据见[视觉效果还原](/zh/guide/visual-effects)。                                                       |
| 大幅 CSS 三维变换的位图导出                                                          | 略逊于 html2canvas                       | 对包含大幅显式 CSS 透视变换的幻灯片，默认 foreignObject 导出路径的栅格化质量略低于 html2canvas 回退路径，在测试样例中的平均通道差异约高 11 个单位。这是因为 Chromium 从 SVG 图像解码经过变换的子树时质量较低。演示文稿自身的三维形状不受影响，且通过 foreignObject 导出效果更好。回退配置见[导出](/zh/user/exporting)。 |

倒影、柔化边缘和路径渐变也采用近似实现，但与真实 PowerPoint 的测量结果较为接近。各自的实现方法和 COM 测量依据见[视觉效果还原](/zh/guide/visual-effects)。

## EMF/WMF 图元文件（`emf-converter` 依赖） {#emf-wmf-metafiles-emf-converter-dependency}

::: info 实现位于独立项目
`emf-converter` 是拥有独立仓库的 npm 包，`pptx-viewer-core` 只是使用它。下表记录该包当前的行为；如果与它的版本说明不一致，请以该包自身的版本说明为准。
:::

::: warning 需要 Canvas API
图元文件转换需要 `OffscreenCanvas` 或 `HTMLCanvasElement`。未提供 Canvas polyfill 的纯 Node.js 环境无法处理 EMF/WMF 图像，核心引擎的其他功能仍可正常运行。
:::

| 功能     | 状态                   | 说明                                                                                                                                                                                                                                                                                                                                            |
| -------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 渐变画刷 | 色标精确；平铺待发布   | GDI+ 线性和径向渐变已支持精确渲染，包括色标、预设、混合系数和变换。待发布版本将为轴对齐的线性渐变增加 GDI+ `WrapMode` 平铺支持；带角度的重复渐变及重复路径渐变仍使用边缘钳制，而非平铺。                                                                                                                                                        |
| 光栅操作 | ROP2 精确；ROP3 待发布 | GDI ROP2 的画笔和画刷模式已可精确渲染。待发布版本将为 `BitBlt`、`StretchBlt` 和 `StretchDIBits` 增加精确的逐像素 ROP3 运算，包括 `SRCCOPY`、`SRCPAINT`、`SRCAND`、`SRCINVERT`、`SRCERASE`、`NOTSRCCOPY`、`NOTSRCERASE`、`MERGEPAINT`、`PATCOPY`、`DSTINVERT`、`BLACKNESS` 和 `WHITENESS`。`MERGECOPY`、`PATPAINT` 和 `PATINVERT` 仍降级为复制。 |
| 文本     | 使用浏览器字体引擎     | 字形度量可能与 Windows GDI 不同。待发布版本会精确应用 `ExtTextOut` 的 `dx` 数组、保留 `LOGFONT` 高度的正负号、按 escapement/orientation 旋转文本，并修复字体名称偏移问题。没有 `dx` 数组时，字形间距仍依赖浏览器自身的字体替换。                                                                                                                |

## 相关阅读 {#related-reading}

- [项目介绍](/zh/guide/introduction)：了解项目整体支持的功能。
- [架构说明](/zh/guide/architecture)：了解这些取舍背后的原因。
- [OpenXML 支持情况](/zh/architecture/openxml-conformance)：覆盖清单中“支持”的正式定义。
- [视觉效果还原](/zh/guide/visual-effects)：通过真实 PowerPoint 验证的 CSS/SVG 近似效果。
- [运行环境](/zh/guide/runtime-environments)：各部分的运行范围及浏览器沙箱相关说明。
