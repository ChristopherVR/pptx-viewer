/**
 * Headless chart drawing-overlay (`c:userShapes`) mutation operations for
 * the PPTX SDK.
 *
 * Like every other function in `./chart-operations`, these mutate
 * {@link ChartPptxElement}'s `chartData` in place; no XML/ZIP work happens
 * here. The save pipeline (`PptxHandlerRuntimeChartUserShapes.syncChartUserShapesToXml`)
 * detects that `chartData.userShapes` no longer matches what is on disk and
 * (re)writes the drawing part automatically.
 *
 * `listChartUserShapes`/`addChartUserShape`/`updateChartUserShape`/
 * `removeChartUserShape` address a shape by its top-level index and cannot
 * reach inside a `grpSp` entry's `children`. The `*AtPath` operations below
 * address ANY shape, top-level or nested arbitrarily deep inside groups, by
 * a {@link ChartUserShapePath}: `[topIndex]` for a top-level shape,
 * `[topIndex, childIndex, ...]` descending through `children` for a nested
 * one. Editing a shape at a path clears `rawXml` on every `grpSp` ancestor
 * along that path (see `chart-user-shapes-serializer.ts`'s module doc),
 * since an ancestor's cached verbatim XML would otherwise mask the edit on
 * save.
 *
 * @module sdk/chart-user-shape-operations
 */

import type { PptxChartUserShape, PptxChartUserShapeGroupChild } from '../../types/chart';
import type { ChartPptxElement } from '../../types/elements';

/**
 * A path to one overlay shape, top-level or nested inside `grpSp` groups:
 * `[topIndex]` addresses `chartData.userShapes[topIndex]`; `[topIndex,
 * childIndex, ...]` descends through `.children` from there.
 */
export type ChartUserShapePath = readonly number[];

/** Either a top-level overlay shape or a shape grouped inside one, addressed by a {@link ChartUserShapePath}. */
type ChartUserShapeNode = PptxChartUserShape | PptxChartUserShapeGroupChild;

function ensureChartData(
	element: ChartPptxElement,
): asserts element is ChartPptxElement & { chartData: NonNullable<ChartPptxElement['chartData']> } {
	if (!element.chartData) {
		throw new Error(
			'Chart element has no chartData. Cannot perform chart operations on an uninitialised chart.',
		);
	}
}

function pathLabel(path: ChartUserShapePath): string {
	return `[${path.join(', ')}]`;
}

/**
 * Rebuild `nodes` with `apply` run on the node at `path`, returning a new
 * array (siblings are structurally shared, unchanged). `apply` returning
 * `undefined` removes the node. Every `grpSp` ancestor walked along the way
 * has its own `rawXml` cleared, since its cached verbatim XML would
 * otherwise re-emit the group unchanged and mask the edit; see this
 * module's doc.
 */
function withNodeAtPath<T extends ChartUserShapeNode>(
	nodes: readonly T[],
	path: ChartUserShapePath,
	apply: (node: T) => T | undefined,
): T[] {
	if (path.length === 0) {
		throw new RangeError('An overlay-shape path must have at least one index.');
	}
	const [head, ...rest] = path;
	if (head === undefined || head < 0 || head >= nodes.length) {
		throw new RangeError(
			`Overlay-shape path ${pathLabel(path)} is out of range at index ${String(head)} (${nodes.length} shape(s) there).`,
		);
	}
	const result: T[] = [];
	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i];
		if (i !== head) {
			result.push(node);
			continue;
		}
		if (rest.length === 0) {
			const applied = apply(node);
			if (applied !== undefined) {
				result.push(applied);
			}
			continue;
		}
		if (node.kind !== 'grpSp' || !node.children) {
			throw new RangeError(
				`Overlay-shape path ${pathLabel(path)} does not resolve through a group at index ${head}.`,
			);
		}
		const newChildren = withNodeAtPath(
			node.children,
			rest,
			apply as (n: PptxChartUserShapeGroupChild) => PptxChartUserShapeGroupChild | undefined,
		);
		// The group's own subtree changed: its cached verbatim XML is stale.
		const { rawXml: _staleRawXml, ...withoutRawXml } = node;
		result.push({ ...withoutRawXml, children: newChildren } as T);
	}
	return result;
}

/** Resolve the node at `path` without mutating anything, for validation/reads. */
function resolveNodeAtPath(
	nodes: readonly ChartUserShapeNode[],
	path: ChartUserShapePath,
): ChartUserShapeNode | undefined {
	if (path.length === 0) {
		return undefined;
	}
	const [head, ...rest] = path;
	const node = nodes[head!];
	if (!node) {
		return undefined;
	}
	if (rest.length === 0) {
		return node;
	}
	if (node.kind !== 'grpSp' || !node.children) {
		return undefined;
	}
	return resolveNodeAtPath(node.children, rest);
}

function validateShapeIndex(element: ChartPptxElement, index: number): void {
	ensureChartData(element);
	const count = element.chartData.userShapes?.length ?? 0;
	if (index < 0 || index >= count) {
		throw new RangeError(
			`Overlay-shape index ${index} is out of range. Chart has ${count} overlay shape(s) (indices 0-${count - 1}).`,
		);
	}
}

/**
 * List a chart's drawing-overlay shapes (`c:userShapes`), in document order.
 *
 * @param element - The chart element to read.
 * @returns The overlay shapes, or an empty array when the chart has none.
 */
export function listChartUserShapes(element: ChartPptxElement): PptxChartUserShape[] {
	return element.chartData?.userShapes ?? [];
}

/**
 * Append a new drawing-overlay shape to a chart.
 *
 * @param element - The chart element to modify.
 * @param shape - The complete overlay shape to add (see
 *   `pptx-viewer-shared`'s `createDefaultChartUserShape` for a ready-made
 *   text-box default).
 *
 * @example
 * ```ts
 * addChartUserShape(chartEl, {
 *   kind: "sp",
 *   anchor: "rel",
 *   from: { x: 0.1, y: 0.1 },
 *   to: { x: 0.4, y: 0.25 },
 *   fill: "#FFFF00",
 *   paragraphs: [{ text: "Note" }],
 * });
 * ```
 */
export function addChartUserShape(element: ChartPptxElement, shape: PptxChartUserShape): void {
	ensureChartData(element);
	const existing = element.chartData.userShapes ?? [];
	element.chartData.userShapes = [...existing, shape];
}

/**
 * Patch one drawing-overlay shape's anchor and/or visual properties.
 *
 * @param element - The chart element to modify.
 * @param index - Index of the overlay shape in `listChartUserShapes` order.
 * @param patch - Fields to overwrite; anything omitted is left as-is.
 */
export function updateChartUserShape(
	element: ChartPptxElement,
	index: number,
	patch: Partial<PptxChartUserShape>,
): void {
	validateShapeIndex(element, index);
	const shapes = element.chartData!.userShapes!;
	element.chartData!.userShapes = shapes.map((shape, i) =>
		i === index ? { ...shape, ...patch } : shape,
	);
}

/**
 * Remove a drawing-overlay shape from a chart by index.
 *
 * @param element - The chart element to modify.
 * @param index - Index of the overlay shape to remove.
 */
export function removeChartUserShape(element: ChartPptxElement, index: number): void {
	validateShapeIndex(element, index);
	const shapes = element.chartData!.userShapes!;
	element.chartData!.userShapes = shapes.filter((_, i) => i !== index);
}

/**
 * Read one overlay shape (top-level or nested inside groups) by path,
 * without modifying anything.
 *
 * @param element - The chart element to read.
 * @param path - See {@link ChartUserShapePath}.
 * @returns The shape at that path, or `undefined` when the path does not resolve.
 */
export function getChartUserShapeAtPath(
	element: ChartPptxElement,
	path: ChartUserShapePath,
): ChartUserShapeNode | undefined {
	const shapes = element.chartData?.userShapes ?? [];
	return resolveNodeAtPath(shapes, path);
}

/**
 * Patch one overlay shape's fields (anchor/position for a top-level shape,
 * `off`/`ext` for a shape grouped inside a `grpSp`) by path, reaching
 * arbitrarily deep into nested groups. Every `grpSp` ancestor along the path
 * has its own cached `rawXml` cleared, so the save pipeline regenerates it
 * from the updated typed model instead of re-emitting the group unchanged.
 *
 * @param element - The chart element to modify.
 * @param path - See {@link ChartUserShapePath}.
 * @param patch - Fields to overwrite; anything omitted is left as-is.
 *
 * @example
 * ```ts
 * // Move the second child of the first overlay shape (a grpSp).
 * updateChartUserShapeAtPath(chartEl, [0, 1], { off: { x: 914400, y: 0 } });
 * ```
 */
export function updateChartUserShapeAtPath(
	element: ChartPptxElement,
	path: ChartUserShapePath,
	patch: Partial<PptxChartUserShape> & Partial<PptxChartUserShapeGroupChild>,
): void {
	ensureChartData(element);
	const shapes = element.chartData.userShapes ?? [];
	element.chartData.userShapes = withNodeAtPath(shapes, path, (node) => ({ ...node, ...patch }));
}

/**
 * Remove one overlay shape (top-level or nested inside groups) by path.
 *
 * @param element - The chart element to modify.
 * @param path - See {@link ChartUserShapePath}.
 */
export function removeChartUserShapeAtPath(
	element: ChartPptxElement,
	path: ChartUserShapePath,
): void {
	ensureChartData(element);
	const shapes = element.chartData.userShapes ?? [];
	element.chartData.userShapes = withNodeAtPath(shapes, path, () => undefined);
}

/**
 * Append a new child to an existing `grpSp` overlay shape.
 *
 * @param element - The chart element to modify.
 * @param groupPath - Path to the `grpSp` shape/child to append into.
 * @param child - The complete grouped child to add.
 */
export function addChartUserShapeGroupChild(
	element: ChartPptxElement,
	groupPath: ChartUserShapePath,
	child: PptxChartUserShapeGroupChild,
): void {
	ensureChartData(element);
	const shapes = element.chartData.userShapes ?? [];
	element.chartData.userShapes = withNodeAtPath(shapes, groupPath, (node) => {
		if (node.kind !== 'grpSp') {
			throw new RangeError(
				`Overlay-shape path ${pathLabel(groupPath)} does not resolve to a grpSp shape.`,
			);
		}
		// The group's own subtree changed: drop its cached verbatim XML (same
		// reasoning as the ancestor-stripping in `withNodeAtPath`) so the
		// serializer regenerates it with the new child included.
		const { rawXml: _staleRawXml, ...withoutRawXml } = node;
		return { ...withoutRawXml, children: [...(node.children ?? []), child] };
	});
}
