/**
 * Serialization helpers for three OOXML chart subtype flags: the bar3D
 * column/bar shape (`c:bar3DChart/c:shape`, plus the legal per-series
 * `c:ser/c:shape` override), the radar chart style
 * (`c:radarChart/c:radarStyle`), and the surface wireframe flag
 * (`c:surfaceChart|surface3DChart/c:wireframe`).
 *
 * Kept separate from `PptxHandlerRuntimeSaveDataSerialization.ts` (already
 * well past the repo's file-size guidance) so the save-pipeline wiring stays
 * a handful of call sites instead of inline node-building.
 *
 * @module utils/chart-subtype-serializer
 */

import type { PptxBar3DShape, PptxChartData, XmlObject } from '../types';
import { orderChartContainerChildren } from './chart-container-schema';

type GetLocalName = (key: string) => string;

function findKey(obj: XmlObject, local: string, getLocalName: GetLocalName): string | undefined {
	return Object.keys(obj).find((k) => getLocalName(k) === local);
}

function upsertValChild(
	parent: XmlObject,
	localName: string,
	value: string | undefined,
	getLocalName: GetLocalName,
): void {
	const existingKey = findKey(parent, localName, getLocalName);
	if (value === undefined) {
		if (existingKey) {
			delete parent[existingKey];
		}
		return;
	}
	if (existingKey) {
		parent[existingKey] = { ...(parent[existingKey] as XmlObject), '@_val': value };
	} else {
		parent[`c:${localName}`] = { '@_val': value };
	}
}

/**
 * Apply `c:bar3DChart/c:shape` (bar3D column/bar geometry) onto the
 * chart-type container and reorder it back into ECMA-376 sequence.
 * `undefined` removes the element.
 */
export function applyBar3DShapeToXml(
	chartTypeContainer: XmlObject,
	containerLocalName: string,
	shape: PptxBar3DShape | undefined,
	getLocalName: GetLocalName,
): void {
	upsertValChild(chartTypeContainer, 'shape', shape, getLocalName);
	orderChartContainerChildren(chartTypeContainer, containerLocalName, getLocalName);
}

/**
 * Apply `c:gapDepth` (bar3D/area3D/line3D depth along the series axis, C1-G7
 * wave-1 skip: parse/type landed, but the typed value was never written back
 * on save) onto the chart-type container and reorder it back into ECMA-376
 * sequence. `undefined` removes the element.
 */
export function applyGapDepthToXml(
	chartTypeContainer: XmlObject,
	containerLocalName: string,
	gapDepth: number | undefined,
	getLocalName: GetLocalName,
): void {
	upsertValChild(
		chartTypeContainer,
		'gapDepth',
		gapDepth === undefined ? undefined : String(gapDepth),
		getLocalName,
	);
	orderChartContainerChildren(chartTypeContainer, containerLocalName, getLocalName);
}

/**
 * Apply `c:radarChart/c:radarStyle` onto the chart-type container and
 * reorder it back into ECMA-376 sequence. `undefined` removes the element
 * (radar's schema treats it as a required leading child, so this should only
 * happen transiently mid-edit).
 */
export function applyRadarStyleToXml(
	chartTypeContainer: XmlObject,
	containerLocalName: string,
	radarStyle: PptxChartData['radarStyle'],
	getLocalName: GetLocalName,
): void {
	upsertValChild(chartTypeContainer, 'radarStyle', radarStyle, getLocalName);
	orderChartContainerChildren(chartTypeContainer, containerLocalName, getLocalName);
}

/**
 * Apply `c:surfaceChart|surface3DChart/c:wireframe` onto the chart-type
 * container and reorder it back into ECMA-376 sequence. `undefined` removes
 * the element (source XML omitted it; the schema default of `true` applies).
 */
export function applySurfaceWireframeToXml(
	chartTypeContainer: XmlObject,
	containerLocalName: string,
	wireframe: boolean | undefined,
	getLocalName: GetLocalName,
): void {
	upsertValChild(
		chartTypeContainer,
		'wireframe',
		wireframe === undefined ? undefined : wireframe ? '1' : '0',
		getLocalName,
	);
	orderChartContainerChildren(chartTypeContainer, containerLocalName, getLocalName);
}

/** CT_BarSer children that follow `c:shape` in schema order. */
const AFTER_SERIES_SHAPE = new Set(['extLst']);

/**
 * Apply a per-series `c:ser/c:shape` override (legal only inside a bar3D
 * container). Inserted in schema order (after `c:val`, before `c:extLst`
 * when present). `undefined` removes the element.
 */
export function applySeriesBar3DShapeToXml(
	seriesNode: XmlObject,
	shape: PptxBar3DShape | undefined,
	getLocalName: GetLocalName,
): void {
	const existingKey = findKey(seriesNode, 'shape', getLocalName);
	if (shape === undefined) {
		if (existingKey) {
			delete seriesNode[existingKey];
		}
		return;
	}
	if (existingKey) {
		seriesNode[existingKey] = { '@_val': shape };
		return;
	}
	const keys = Object.keys(seriesNode);
	const beforeIdx = keys.findIndex((k) => AFTER_SERIES_SHAPE.has(getLocalName(k)));
	const entries = keys.map((k) => [k, seriesNode[k]] as const);
	const at = beforeIdx === -1 ? entries.length : beforeIdx;
	entries.splice(at, 0, ['c:shape', { '@_val': shape }] as const);
	for (const k of keys) {
		delete seriesNode[k];
	}
	for (const [k, v] of entries) {
		seriesNode[k] = v;
	}
}
