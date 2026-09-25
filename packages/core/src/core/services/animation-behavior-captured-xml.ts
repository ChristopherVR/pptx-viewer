/**
 * Turn a captured PowerPoint behaviour tree (`animation-behavior-captured.ts`)
 * into the tagged `XmlObject` nodes `animation-write-node-effect.ts`
 * assembles into an effect's `p:childTnLst`, scaled to the requested
 * duration and retargeted at the requested shape.
 *
 * Every attribute PowerPoint wrote is re-emitted verbatim (formulas,
 * `tmFilter` curves, `autoRev`, `additive`, motion paths...); only the node
 * ids, the target `spid` and the fractional timings are filled in.
 *
 * @module services/animation-behavior-captured-xml
 */
import type { XmlObject } from '../types';
import type {
	CapturedBehaviorNode,
	CapturedTav,
	CapturedValue,
} from './animation-behavior-captured';

function prefixed(attrs: Record<string, string> | undefined): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(attrs ?? {})) {
		out[`@_${key}`] = value;
	}
	return out;
}

/** A typed OOXML value element (the child of `p:to` / `p:val` / `p:progress`). */
export function capturedValueXml(value: CapturedValue): XmlObject {
	switch (value.t) {
		case 'flt':
			return { 'p:fltVal': { '@_val': value.v } };
		case 'int':
			return { 'p:intVal': { '@_val': value.v } };
		case 'bool':
			return { 'p:boolVal': { '@_val': value.v } };
		case 'clr': {
			const clr: XmlObject = {};
			clr[`a:${value.kind ?? 'schemeClr'}`] = { '@_val': value.v };
			return { 'p:clrVal': clr };
		}
		case 'str':
		default:
			return { 'p:strVal': { '@_val': value.v } };
	}
}

function tavXml(tav: CapturedTav): XmlObject {
	const node: XmlObject = { '@_tm': tav.tm };
	if (tav.fmla !== undefined) {
		node['@_fmla'] = tav.fmla;
	}
	if (tav.val) {
		node['p:val'] = capturedValueXml(tav.val);
	}
	return node;
}

function attrNameLst(names: string[]): XmlObject {
	if (names.length === 1) {
		return { 'p:attrName': names[0] };
	}
	return { 'p:attrName': names.map((name) => ({ '#text': name })) };
}

/** Resolve a captured node's fractional timing against `durationMs`. */
export function capturedNodeTiming(
	node: CapturedBehaviorNode,
	durationMs: number,
): { durMs: number; delayMs: number } {
	const durMs =
		node.absDurMs !== undefined ? node.absDurMs : Math.round((node.dur ?? 1) * durationMs);
	const delayMs =
		node.delayFromEndMs !== undefined
			? durationMs - node.delayFromEndMs
			: node.delay !== undefined
				? Math.round(node.delay * durationMs)
				: 0;
	return { durMs: Math.max(0, durMs), delayMs: Math.max(0, delayMs) };
}

/** Build one captured behaviour as a tagged `XmlObject` (`_type` names its childTnLst group). */
export function buildCapturedBehaviorNode(
	node: CapturedBehaviorNode,
	shapeId: string,
	durationMs: number,
	allocateId: () => number,
): XmlObject {
	const { durMs, delayMs } = capturedNodeTiming(node, durationMs);
	const cTn: XmlObject = {
		'@_id': String(allocateId()),
		'@_dur': String(durMs),
		...prefixed(node.ctn),
	};
	if (delayMs > 0) {
		cTn['p:stCondLst'] = { 'p:cond': { '@_delay': String(delayMs) } };
	}
	const cBhvr: XmlObject = {
		...prefixed(node.bhvr),
		'p:cTn': cTn,
		'p:tgtEl': { 'p:spTgt': { '@_spid': shapeId } },
	};
	if (node.names) {
		cBhvr['p:attrNameLst'] = attrNameLst(node.names);
	}
	const xml: XmlObject = { _type: node.tag, ...prefixed(node.attrs), 'p:cBhvr': cBhvr };
	if (node.tav) {
		const tavs = node.tav.map(tavXml);
		xml['p:tavLst'] = { 'p:tav': tavs.length === 1 ? tavs[0] : tavs };
	}
	for (const key of ['by', 'from', 'to'] as const) {
		const point = node.scale?.[key];
		if (point) {
			xml[`p:${key}`] = { '@_x': point[0], '@_y': point[1] };
		}
	}
	if (node.setTo) {
		xml['p:to'] = capturedValueXml(node.setTo);
	}
	if (node.progress) {
		xml['p:progress'] = capturedValueXml(node.progress);
	}
	return xml;
}

/** Build every node of a captured tree, in PowerPoint's order. */
export function buildCapturedBehaviorNodes(
	nodes: ReadonlyArray<CapturedBehaviorNode>,
	shapeId: string,
	durationMs: number,
	allocateId: () => number,
): XmlObject[] {
	return nodes.map((node) => buildCapturedBehaviorNode(node, shapeId, durationMs, allocateId));
}
