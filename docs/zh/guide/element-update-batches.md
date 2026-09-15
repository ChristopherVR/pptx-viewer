---
title: 批量更新元素
description: 通过公开 API 跨幻灯片更新元素，并将整批修改作为一次可撤销的操作。
---

# 批量更新元素 {#batch-element-updates}

当宿主应用的一次操作需要修改多个页面中的元素时，可以使用 `updateElements`。
例如，“调整报告标题”按钮可以同时移动两页的标题，无需离开用户正在编辑的页面。

React、Vue、Angular、Svelte 和原生 JavaScript 的公开组件句柄均提供此方法。
`ElementUpdate` 和 `ElementUpdateOptions` 类型由各框架的组件包直接导出。

```ts
updateElements(
	updates: readonly ElementUpdate[],
	options?: ElementUpdateOptions,
): Promise<void>;

interface ElementUpdate {
	slideId: string;
	elementId: string;
	patch: Partial<PptxElement>;
}

interface ElementUpdateOptions {
	label?: string;
}
```

下面的 `viewer` 表示当前公开组件句柄，示例中的两页各有一个标题元素：

```ts
const [first, second] = viewer.getSlides();

await viewer.updateElements(
	[
		{
			slideId: first.id,
			elementId: first.elements[0].id,
			patch: { x: 84 },
		},
		{
			slideId: second.id,
			elementId: second.elements[0].id,
			patch: { x: 90 },
		},
	],
	{ label: '调整报告标题' },
);

viewer.undo(); // 一次撤销，同时恢复两个标题。
viewer.redo(); // 一次重做，同时重新应用两项修改。
```

## 提交与撤销行为 {#commit-and-history-behavior}

- 每个产生实际变化的批次占用一个撤销步骤，与前后的编辑相互独立。
  即使在同一个 JavaScript 执行轮次中提交两批修改，它们也能分别撤销。
- 应用批次保留当前页面和元素选择，不会跳转到目标页。
  撤销和重做沿用组件原有的快照恢复行为。
- 读取结果或执行依赖此结果的操作前，应等待返回的 Promise 完成。
  React 中应重新读取 `ref.current`，再调用句柄上的读取方法。
- 有效批次会先单独提交尚未结束的行内文字编辑。
  请在拖动、缩放元素等指针交互结束后提交批次；React 会拒绝在指针交互过程中提交批次。
- 空批次和没有最终净变化的批次不会改变历史记录或 dirty 状态。
  被拒绝的批次保留文档以及撤销、重做栈。
- 现有 `updateElement` 方法继续使用当前页的逐次编辑语义。

## 目标、补丁与错误 {#targets-patches-and-errors}

批量更新要求文档已加载、允许编辑，且处于普通幻灯片的编辑模式。
只读、预览、演示、母版和模板编辑状态下，返回的 Promise 会被拒绝。
`slideId` 必须唯一定位一页，`elementId` 必须唯一定位该页中的一个顶层元素。
组合内部的子元素和母版、版式元素不在此接口的处理范围内。

接口会在提交任何更新前检查全部目标和补丁。任何目标缺失或不唯一，都会导致整批失败。
补丁必须是对象，不能替换元素的 `id` 或 `type`；位置、尺寸和旋转值必须是有限数字，
宽高不能为负数。其他字段沿用 `Partial<PptxElement>` 的约束，此接口不提供完整的元素结构校验。

与 `updateElement` 一样，补丁按属性进行浅层替换；修改嵌套属性时，应提供该属性的完整值。
同一元素出现多次时按输入顺序应用。接口会复制输入数据，因此调用后再修改补丁对象不会影响已提交的批次。
