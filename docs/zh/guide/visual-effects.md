---
title: 视觉效果还原
description: 具体 PowerPoint 视觉效果在 CSS/SVG 中的实现方式，以及每项效果对应的 COM 实测依据。
---

# 视觉效果还原 {#visual-effect-fidelity}

幻灯片渲染为 HTML/CSS/SVG，而非 Canvas，以便在任意缩放下保持文字清晰，支持原生无障碍和 DOM 交互。因此，少数没有精确 CSS/SVG 对应实现的 PowerPoint 效果，会采用经过选择的专门技术重现。本页记录已对照真实 PowerPoint 输出验证、效果可靠的实现；尚未解决的差距请参见[已知限制](/zh/guide/limitations)。

## 倒影（`a:effectLst/a:reflection`） {#reflections-a-effectlst-a-reflection}

倒影渲染为镜像的同级节点，反映元素完整的渲染内容：对于形状或图片，包含填充、轮廓和自身文本；对于组合，递归包含每个子元素及其填充、轮廓和文本。五种绑定均支持 `@sx` / `@sy` / `@kx` / `@ky` / `@rot` / `@fadeDir` / `@algn`。

即使组合没有自己的填充，也会渲染组合自身的倒影，以及阴影、发光和柔化边缘。这些效果通过 CSS `filter` 应用到组合的合成栅格结果上，不使用 `box-shadow`，因为后者会给组合的边界矩形而非实际内容添加阴影。如果带倒影的组合内部，某个子元素也有自己的倒影，就会发生双重镜像，与 PowerPoint 的合成方式一致：组合倒影基于已经完整渲染的组合内容，其中包含子元素自身的倒影。

## 柔化边缘（`a:softEdge`） {#soft-edges-a-softedge}

使用 SVG 滤镜，仅羽化形状的 alpha 边缘：先腐蚀，再模糊，最后与原始填充合成。内部填充和文字保持清晰，不会模糊整个元素。

**根据 COM 实测修正（2026-09-10）。** 原实现将文档中的 `@rad` 直接作为单次 `feGaussianBlur(stdDeviation = rad)` 的参数，再通过 `in` 与源图形合成。这样得到的过渡形状和宽度都不正确：硬边经过高斯模糊后，在原始边界处恰好为 50% 不透明度，向内约 3 倍半径才达到完全不透明。对真实 PowerPoint 2016 进行测量：使用 `Slide.Export` 导出 PNG，幻灯片尺寸为 1280×720，一个矩形设置 `a:softEdge rad="190500"`，即 20px，第二个样例设置 `rad="381000"`，即 40px；沿穿过形状边缘的水平扫描线采样，结果如下：

| 设置的半径 | 边界处不透明度 | 约 50% 不透明度               | 约 100%（饱和）              |
| ---------- | -------------- | ----------------------------- | ---------------------------- |
| 20px       | 约 0%          | 向内约 18px（半径的 0.9 倍）  | 向内约 34px（半径的 1.7 倍） |
| 40px       | 约 0%          | 向内约 35px（半径的 0.88 倍） | 向内约 72px（半径的 1.8 倍） |

两种半径都证实，PowerPoint 的羽化效果在原始边界处接近透明，而非 50%，在向内约 1.75 至 1.8 倍设置半径处达到完全不透明，而非原始高斯模糊所产生的约 3 倍；该关系随设置半径线性变化。现在渲染器先将 alpha 向内腐蚀 `0.9 x radius`，再使用更窄的模糊（`0.3 x radius`，其自身的三倍标准差扩散范围约为半径的 0.85 倍）羽化，与两条实测曲线的偏差都约为一个像素。实现统一位于 `packages/shared/src/render/visual-effects.ts` 的 `getSoftEdgeSvgFilter`，五种绑定以相同方式使用。

## 路径渐变（`a:gradFill/a:path`） {#path-gradients-a-gradfill-a-path}

`circle` 和 `shape` 路径类型使用原生的椭圆或圆形 CSS/SVG 径向渐变渲染。PowerPoint 对这两种类型的渲染本身就是椭圆形，因此无需近似处理。

`rect` 路径类型不同：PowerPoint 沿形状自身的边界矩形渐变，等值线是带直角的同心矩形，即切比雪夫距离或 L∞ 距离场。原生 CSS 和 SVG 径向渐变都是椭圆形，无法生成这种效果。`packages/shared/src/render/path-gradient-rect.ts` 通过堆叠 40 层与坐标轴对齐的嵌套 `<rect>` 色带，直接渲染真实矩形距离场，先绘制最大层，最后绘制最小层。

**COM 实测（2026-09-10）。** 在 PowerPoint 2016 中，用 `Slide.Export` 将包含 `a:gradFill path="rect"` 的样例导出为 PNG：渐变色标为红、绿、蓝，`a:fillToRect` 向内缩进 30%。在整个渐变宽度上每隔 5px 采样，颜色变化完全平滑连续，没有可见色带；内侧纯色区域也准确落在 `fillToRect` 指定的位置。PowerPoint 自身的渲染没有需要模仿的离散分层；这里的 40 层离散色带是在不存在原生直角渐变图元时作出的取舍。即使渐变覆盖整个宽度，40 步中每条可见色带也只有几个 CSS 像素，在正常缩放下不可察觉，实测样例的屏幕输出也确认了这一点。底层距离场形状，包括沿两轴的线性变化、对称衰减和矩形等值线，与 PowerPoint 实测颜色值完全一致。

## 像素化切换滤镜（`p:animEffect/@filter="pixelate"`） {#pixelate-transition-filter-p-animeffect-filter-pixelate}

`p:animEffect/@filter` 可以指定的每个 SMIL 滤镜族，都映射为与 PowerPoint 播放一致的显现或隐藏效果。`pixelate` 是其中唯一直接跳到结束状态、而非渐进过渡的滤镜族，因为 PowerPoint 自身就是这样显示的。

**COM 实测（`e2e/fixtures/pixelate-filter.pptx`，PowerPoint 2016，`Presentation.CreateVideo`，并与仅将滤镜替换为 `filter="dissolve"`、其余字节相同的对照文稿逐帧比较）。** `dissolve` 对照文稿会明显溶解：显现中途的早期帧与稍后稳定帧存在逐像素差异。`pixelate` 文稿则没有变化：其点击步骤最早和最晚的帧逐字节相同，目标形状从该步骤的第一帧开始就已经完全绘制，且完全不透明。PowerPoint 对 `filter="pixelate"` 不执行任何动画，处理方式与无法解释的构建效果相同：静默跳到解析后的结束状态。`pixelate` 是模式允许的 `ST_TransitionFilterType` 值（ECMA-376 20.1.8.49），但真实 PowerPoint 没有对应的宿主实现。

因此，渲染器默认将 `pixelate` 解析为与 `p:animEffect/@filter="cut"` 相同的 `cutIn` / `cutOut` 关键帧，即真正的瞬间切换。在线运行也已验证：`e2e/animation-pixelate-filter.spec.ts` 断言进入效果播放 `pptx-cutIn`，而非渐进显现。这样与 PowerPoint 行为保持一致，不额外播放 PowerPoint 从未显示的动画。仍然提供显式、默认关闭的块状马赛克显现选项 `pixelateMosaicAnimation`，位于“文件 > 选项 > 高级 > 幻灯片放映 > 为像素化切换显示马赛克效果”，供希望显示动画的查看器使用。其实现 `packages/shared/src/render/animation-pixelate-filter.ts` 使用自包含 SVG `<filter>` data URI，通过离散 `@keyframes` 停点切换，每个可见块显示元素自身的真实内容。决策统一实现在 `packages/shared/src/render/animation-filter-effects.ts` 的 `resolveFilterEffect` 中，经 `PresentationAnimationController.fromSlide` 的 `pixelateMosaic` 选项传递，五种绑定以相同方式使用。

## 电影式切换（`cube`、`box`、`flip`、`rotate`、`pageCurl`、`origami` 等） {#cinematic-transitions-cube-box-flip-rotate-pagecurl-origami}

这一组效果在二维幻灯片图层上通过 CSS 关键帧实现透视、旋转和卷曲，而非真正的体积三维渲染。这是有意的设计：每种预设都有独立调校的关键帧，重现 PowerPoint 在屏幕上的运动形态，而不是统一使用通用三维场景。

已对照 PowerPoint 2016 的 `CreateVideo` 帧进行 **COM 实测**：

- `cube` / `rotate` 共用贴齐屏幕的铰链旋转方式；`cube` 使用基础 `<p14:prism>`，`rotate` 在同一元素上设置 `isContent="1"`。
- `box` / `orbit` 共用向深处退缩的铰链效果，产生间隙，并在两个轴上形成透视缩短；`box` 设置 `isInverted="1"`，`orbit` 设置 `isContent="1" isInverted="1"`。
- `doors` / `window` 的 `horz` 沿上下方向打开。
- `fallOver` 让离开的幻灯片绕顶部铰链倾倒，而非让进入的幻灯片倾倒。
- `reveal` 在前半段保持真实的暗色间隙，然后进入的幻灯片才淡入。
- `warp` 是径向缩放模糊爆发，而不是倾斜。
- `crush` 向中心揉皱，而不是平面的垂直压缩。
- `flythrough`、`gallery`、`ferris`、`conveyor`、`switch`、`pageCurl`（单页或双页）、`peelOff`、`drape`、`ripple`、`flash`、`zoom` 和 `origami` 同样经过 COM 实测，运动形态与关键帧一致。
- COM 已确认，`vortex`、`honeycomb`、`glitter`、`shred`、`fracture`、`curtains` 和 `airplane` 在真实 PowerPoint 中表现为多个独立碎片、图块或粒子，`airplane` 则是真正的纸飞机轮廓折叠。现在每种效果都基于同一测量结果，渲染数量受限的独立片段，每个片段有自己的 clip-path、变换和透明度动画，而不是单个平面图层。实现位于 `packages/shared/src/render/slide-transition-fragments.ts` 的 `getFragmentedTransitionDescriptor`。

## 三维形状与场景（`a:sp3d` / `a:scene3d`） {#_3-d-shapes-and-scenes-a-sp3d-a-scene3d}

相机预设映射为真实的 CSS 变换（`transform-style: preserve-3d`）。对于 `perspective*` 和 `isometric*` 预设，使用 COM 实测的精确 `matrix3d` 单应变换：对每种预设的投影四边形做凸包拟合，归一化到单位正方形，再按元素渲染尺寸缩放，而不是近似旋转。单轴 `perspectiveAbove` / `Below` / `Left` / `Right` 族是纯缩放加偏移，没有梯形畸变；双轴 `*Facing` / `Contrasting*` / `Heroic*` 族的离轴消失点也得到精确表示。COM 已确认，`oblique*` / `legacyOblique*` / `legacyPerspective*` / `orthographicFront` 会使形状正面保持平面；只有拉伸形状的侧面响应这些旧式拉伸方向相机。

显式的 `a:camera/a:rot` / `@fov` / `@zoom` 覆盖通过通用参数化相机函数（`visual-3d-camera-parametric.ts`），构建与预设表同类的精确单应变换。拉伸深度通过真实的 `translateZ` 侧面渲染；每种预设显示哪一侧（上、下、左、右）都经过 COM 实测，共 44 种预设，使用边缘带像素分析。轮廓按文档指定宽度渲染为真实的实心 CSS outline 环。

棱台预设通过真实的 SVG 光照 `<filter>`（`visual-3d-bevel-lighting.ts`）渲染：根据形状自身的 alpha 轮廓构建高度图，在 `feDistantLight` 下使用 `feDiffuseLighting` 和 `feSpecularLighting` 照明，不是 CSS `box-shadow` 近似。材质预设（`a:sp3d/@prstMaterial`）参与同一光照计算，而非独立 CSS 滤镜；`a:lightRig/@rig` 的仰角表已针对全部 27 个 `ST_LightRigType` 值进行 COM 校准。场景地平面（`a:backdrop`）有意不渲染自身阴影，与 PowerPoint 一致：未设置阴影效果时没有地平面视觉痕迹；在倾斜背景上存在阴影时，其形状也无法用 CSS 表示。艺术字和文本体的三维相机预设（`a:bodyPr/a:scene3d`）调用与形状级相同的相机函数。

**尚未解决的差距**均经 COM 实测（2026-09），面向使用者的摘要请参见[已知限制](/zh/guide/limitations)。

1. 三种棱台剖面 `relaxedInset`、`slope` 和 `hardEdge`，在横截面渐变途中呈现真实的“亮峰后接暗谷”双重过渡。测量沿边缘向内取 40 个点，同时覆盖 6pt 和 24pt 棱台，滤镜单调的高度图无法完全复现。表中为它们设置了较强腐蚀和已测试的最大起伏因子，作为当前最接近的拟合；彻底修复需要真正非单调的双峰高度图。
2. 重新校准灯光组仰角后，暴露了镜面与漫反射耦合问题：按新测得的 `elevationDeg` 评分，即使 `matte` 的 `specularConstant` 可忽略，平均绝对亮度误差仍从 34.8 升至约 47.4，这是仰角本身对漫反射的影响。`metal` 原有镜面反射常量按过去假定的 `threePt` 45 度仰角调校，而实际测得 `threePt` 为 74 度，`flat` / `contrasting` 族为 90 度，在这些仰角下形状平坦内部会饱和为纯白。尝试过两种修正，但都因回归而放弃：将镜面光源解耦到独立固定低仰角，使 `angle` / `softRound` 在所有测试值下明显变差；将镜面贡献遮罩到弯曲棱台带，则使所有测试剖面变差，例如 `metal` / `circle` 从 39.5 升至 103.5。仍需按材质联合数值拟合仰角、镜面仰角、常量、指数和 surfaceScale；完整重新测量及脚本说明见 `visual-3d-bevel-lighting-routing.ts` 的文档注释。

### 测量来源 {#measurement-provenance}

- 相机单应变换：后续的 27 点 `lat` × `lon` × `rev` COM 网格测量（2026-09），将投影中的组合轴项替换为精确的旋转组合交叉项。27 个点的平均角点误差降至 0.61%，最大 2.1%，消除了先前每种情况只测量一次时留下的约 25% 至 29% 残差。`lon` 的符号已由 COM 直接确认；单轴情况无法观察 `lat` 的符号，因为 `cos` 是偶函数，但 27 点网格已联合 `lon` 确认它。`rev` 的符号通过单独的 45 度滚转 COM 样例隔离确认，4 个角点的方向偏差约在 10 度以内。
- 拉伸侧面：针对单应变换覆盖的 44 种预设，使用边缘带像素分析测量。其中 37 种具有可见侧面的预设，其侧面投影形状已通过 COM 验证：后边缘是前边缘沿实测的、随深度线性变化的屏幕空间向量平移得到。PowerPoint 中，`perspectiveFront`、`orthographicFront`、`perspectiveLeft` / `Right`、`obliqueLeft` / `Right` 和 `perspectiveHeroicExtremeLeftFacing` 完全不显示侧面。
- 棱台高光方向：12 种 `a:bevelT` 剖面中，有 9 种经 COM 确认为将 `a:lightRig/@dir` 吸附到上下左右主方向；`softRound` 测得的是相反主方向的边缘；`slope` / `hardEdge` 没有清晰的方向性亮度信号，参见上述差距 1。
- 棱台高度图形状：2026-09 的测量将真实横截面亮度曲线（40 个点、6pt 和 24pt 棱台、全部 12 种剖面）与滤镜已有的 `blurFactor` / `morphologyFactor` / `surfaceScaleFactor` 参数拟合。12 种中有 9 种得到较接近的结果：`circle`、`convex`、`softRound`、`divot`、`angle`、`cross`、`coolSlant`、`riblet`、`artDeco`。完整表格和固定曲线见 `visual-3d-bevel-lighting-tables.ts` 的 `BEVEL_PROFILE_HEIGHT_MAP` 文档注释及其 `.test.ts`。
- 材质：对 `circle` / `angle` / `hardEdge` / `softRound`、4 个主方向、`matte` / `metal` 共 32 种条件进行 COM 测量，在距每条边 0.15 英寸处采样。使用 SVG 滤镜后，`matte` 平均绝对亮度误差从 box-shadow 基线的 56.3 降至 34.8，`metal` 的原始基线为 61.2。`metal` 需要重新校准，提高 `diffuseConstant`、降低 `surfaceScale` 倍率，才能使 `angle` / `hardEdge` / `softRound` 在每个方向上达到或优于基线。只有 `metal` / `circle` 仍难以拟合，因为 COM 测得的阴影侧反射率超过 `feDiffuseLighting` 的 `N.L<=0` 截断机制所能产生的范围。重新拟合 `circle` 自身高度图后，误差才降至 39.5，优于 54.9 基线，并通过新的 COM 测量及实际滤镜的无界面 Chromium 渲染确认。同样重新检查了 `angle` / `hardEdge` / `softRound`，误差为 41.5 / 62.0 / 27.5，对应基线约为 70 / 69.5 / 50。
- 灯光组仰角：测量了全部 27 个 `ST_LightRigType` 值，使用中灰色 `matte` / `circle` 正方形，在距边缘 0.15 英寸处采样；独立的 `dir="t"` / `dir="r"` 测量差异小于 1 个亮度单位。十个灯光组（`harsh`、`balanced`、`twoPt`、各 `legacy{Flat,Normal,Harsh}` 族的 `*4` 变体，以及 5 个天气灯光组）在 `a:lightRig/@dir` 的相反边缘出现高光。4 个带编号的旧式变体不能互换：在该采样偏移处，`*1` / `*3` 没有方向性，`*2` / `*4` 是方向镜像。另一轮测量对中灰色 `circle` 棱台正方形的正中心采样，覆盖 `matte` / `metal` / `plastic` 和 15 个灯光组值，仰角为 54 至 90 度。三种材质在每个灯光组下都逐像素相同，确认在所有仰角下，平坦法线处的材质响应均为零，而不只是在低仰角下如此。
- 轮廓，以及高光和阴影带宽度随棱台深度（6pt 对比 24pt）的缩放关系，均已通过 COM 确认；`extrusionClr` / `contourClr` 颜色得到遵循。背景阴影使用同时带有真实 `a:outerShdw` 和 scene3d backdrop 的形状测量：PowerPoint 在没有阴影效果时不显示地平面痕迹；即使有阴影，水平或近水平背景也与无背景无法区分，而大幅倾斜背景会投影出非凸的剪切形状，无法用 CSS `box-shadow` 表示。
- 艺术字和文本体相机：`perspectiveHeroicLeftFacing` 和 `perspectiveLeft` 已通过 COM 验证，使用填充字形“墨迹”矩形的凸包，结果与形状测量偏差约在 1% 以内；`isometricTopUp` 已视觉确认，但其 45 度滚转使自动角点拟合不够可靠，因此未给出百分比。

## 艺术字包络字形轮廓变形（`a:prstTxWarp` inflate/deflate/can） {#wordart-envelope-glyph-outline-warping-a-prsttxwarp-inflate-deflate-can}

艺术字预设中的 `inflate` / `deflate` / `can`“包络”族，在独立的上下两条曲线之间弯曲文本，因此字形高度会随水平位置变化，不只是基线变化。根据每个字形可获取的数据，以下两种技术配合完成渲染。

**字形轮廓变形（精确方式）。** 能取得字形实际字体文件时，`packages/shared/src/render/text-warp-glyph-outline.ts` 使用 `opentype.js` 解析文件，并将字形真实矢量轮廓上的每个点，包括曲线上的点和曲线外的贝塞尔控制点，按**该点自身的水平位置**采样包络曲线并映射，而非只采样字形边缘或中心。随后将字形渲染为单个变形后的 SVG `<path>`，不使用 `<text>`。这里的“精确”指的是 PowerPoint 自身模型同样逐点变形轮廓；控制点与曲线一起变形，采用与 PowerPoint 渲染器相同的近似。单元测试 `text-warp-glyph-outline.test.ts` 固定了以下不变量：“直线”包络的上下曲线与字形自身名义带重合时，每个点保持不变；`can` 预设的轮廓在整行中保持相同的垂直比例，因为圆柱上下曲线具有相同半径和扫过角，仅相差固定偏移，这一点可从转录的引导公式直接证明，参见该预设的文档注释。

实际字体字节可从两处取得（`text-warp-outline-font-cache.ts`）：文稿中嵌入的字体，其字节已由加载流程放入内存，同步解析，无需网络；以及已为屏幕文本解析出的 Google Fonts 目录网页字体，由 `text-warp-outline-webfont-fetch.ts` 在 CSS `<link>` 之外尽力单独获取实际 `.woff2` 字节。五种绑定（React、Vue、Angular、Svelte、原生 JavaScript）以相同方式接入两条路径：各自维护模块作用域的 `GlyphOutlineFontCache`，加载时同步注册嵌入字体，网页字体字节获取后再注册并触发重新渲染。

**逐字形仿射拟合（回退方式）。** 无法取得字体文件时，例如读者电脑上的系统字体既没有嵌入副本，也不匹配目录，仍通过对字形左右边缘采样包络曲线拟合仿射变换（`text-warp-glyph-matrix.ts` 的 `glyphEnvelopeMatrix`）来渲染字形。如果某个字形特别宽，单次仿射变换会漏掉过多曲率，则将其拆分为最多 24 个独立拟合并裁剪的子带，实现在 `text-warp-glyph-slicing.ts`。这条路径已经直接进行 COM 实测：所有测试预设和调整值下，包络曲线与 PowerPoint 的平均偏差约为 0.2%，最大约 1.2%；切片后，普通标题的逐字形渲染偏差约在 1% 至 2% 以内。最困难的情况是 `can` 极端调整值下由极宽字形组成的短标题：一行 4 至 8 个字形时，切片将原来的约 6.7% 至 6.9% / 4.1% 至 4.3% 改善到约 4.9% 至 5.1% / 2.9% 至 3.1%。这些数据早于下方水平位置修复，尚未针对新修复重新测量。此处约 1.1% 至 1.2% 的残差下限，来自转录 `arcTo` 曲线模型本身在边界框最外缘的 COM 实测偏差，不来自仿射拟合，也同样影响上面的精确轮廓变形路径，因为两者采样同一曲线函数，只是后者采样每个轮廓点，而非仅字形边缘。因此这不是轮廓变形工作已经解决的差距，若不从头重新推导引导公式模型，也不预期能够消除。最外缘情况是否已针对真实轮廓渲染的 `<path>` 字形，与真实 PowerPoint 独立重新测量，仍未确定；已测量的是底层曲线函数。当前未验证范围请参见[已知限制](/zh/guide/limitations)。

**字形水平位置。** 2026-09-11 的 COM 实测使用包含 8 个形状的 Arimo Bold 样例：PowerPoint 让包络变形后的字形沿边界框自身宽度从一边排到另一边，而不是按文本行自然、未拉伸的推进宽度居中。现在 `buildGlyphEnvelope`（`text-warp-envelope-layout.ts`）通过统一的 `stretch` 因子（边界框宽度除以自然行宽），将每行字形包络拉伸以填满 `[0, width]`。但字形自身的**形状**是否也按该因子变宽，取决于预设族。同一样例的墨迹列扫描表明：`inflate` / `deflate` 及其 `Top` / `Bottom` / `DeflateInflate...` 变体，也会按 `stretch` 加宽每个字形轮廓，是真正的二维橡皮膜形变；而 `textCanUp` / `textCanDown` 只加宽字形之间的**间隙**，字形本身保持自然宽度，因为测得的字形墨迹宽度与未拉伸自然宽度明显更接近。此修复消除了此前居中且未拉伸布局造成的大部分差距：样例中轮廓路径上下曲线边缘的内部平均误差，从修复前约 20.74% / 21.98% 降至整体约 9.68% / 9.51%。逐预设看，`inflate` / `deflate` 现在的内部平均误差约为 2.6% 至 3.4%，与前述仿射回退对普通标题的精度处于同一范围；`textCanUp` / `textCanDown` 仍为约 5.3% 至 18.5%，取决于标题长度和 `adj`。对 `can` 测试了另外两种水平模型，但都未进一步降低同一样例的误差：沿圆柱曲线按相等**弧长**放置字形，预测间隙位置反而比简单均匀间距更差；像 `inflate` / `deflate` 一样加宽 `can` 字形自身形状，也没有在样例各个 `can` 情况中带来一致改善。`can` 族的水平残差仍未解决。

多段落包络块的行不会再整体颠倒顺序。此前 `edgeBandAt`（`text-warp-glyph-matrix.ts`）先在每个字形自身的水平位置计算曲线变形带，再按行比例切分。因此，即使每行自身的局部切片正确，只要两行字形落在足够不同的位置，例如短且大幅拉伸的段落与较长段落相邻，仍可能计算出重叠的带。现在，相邻两行**之间**的边界锚定到与行无关的固定参考位置所计算的带；每行不与邻行共享的外侧边缘，其相对平直未变形带的弯曲幅度，按 `1/lineCount` 衰减，与其名义源带采用相同比例缩窄对应。这项修复有效，但仍不完整：极短且大幅拉伸段落中的深下伸部或高上伸部，仍可能外推越过固定边界。同一样例的双行 `textInflate` 中，上下带交叉由 58.7px 缩小到 48.8px，尚未归零。这是仍未解决且未经 COM 验证的残差。

### 测量来源 {#measurement-provenance-1}

`textCanUp` / `textCanDown` 的圆柱上下 `arcTo` 曲线平行，半径和中心相同、相差常量偏移，因此每个字形保持相同高度，同时沿弧线剪切，已经 COM 验证；`inflate` / `deflate` 及其变体则确实改变字形高度。`e2e/text-warp-envelope-parity.spec.ts` 中，单段落和 `wide-glyph-can` 切片情况的跨绑定偏差约在 1.5px 以内，但上述多段落带顺序测试尚未通过。此前 `wide-glyph-can` 中原生 JavaScript 与其他绑定的切片数不一致（原生为 4 片，其他为 5 片）已修复：原生 JavaScript 的艺术字渲染器是唯一在测量字形推进宽度前跳过共享 PANOSE 字体替换步骤的绑定，导致字形切片采样不同的曲线位置。这是真实的绑定实现差异，不是测量竞争。

## 相关阅读 {#related-reading}

- [已知限制](/zh/guide/limitations)：仍未解决的差距。
- [OpenXML 符合性](/zh/architecture/openxml-conformance)：包级覆盖清单，不代表视觉还原程度。
