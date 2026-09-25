/**
 * Parse every behaviour child of an effect's `p:childTnLst` into the typed
 * {@link PptxAnimationBehavior} list, keeping each behaviour's own timing
 * (`dur`, start delay, `accel`/`decel`, `autoRev`, `repeatCount`,
 * `tmFilter`) and additive mode. The flattened single-value fields on
 * `PptxNativeAnimation` stay as they are; this list is what lets playback
 * follow a composed PowerPoint preset behaviour by behaviour.
 *
 * @module services/native-animation-behaviors
 */
import type {
	PptxAnimationBehavior,
	PptxAnimationBehaviorTiming,
	PptxBehaviorPoint,
	XmlObject,
} from '../types';
import { normalizeCalcMode } from './native-animation-cbhvr-attrs';
import { extractStartConditionDelayMs, readTimingAttr } from './native-animation-extended-helpers';
import {
	decodeKeyframeValue,
	ensureArray,
	extractKeyframes,
	parseTimingPercentFraction,
} from './native-animation-helpers';

/** Behaviour tags in the order they are collected (parallel, so order is cosmetic). */
const BEHAVIOR_TAGS = [
	'p:set',
	'p:anim',
	'p:animEffect',
	'p:animScale',
	'p:animRot',
	'p:animMotion',
] as const;

function attrText(raw: unknown): string | undefined {
	if (raw === undefined || raw === null) {
		return undefined;
	}
	const text = (
		typeof raw === 'object' ? String((raw as XmlObject)['#text'] ?? '') : String(raw)
	).trim();
	return text !== '' ? text.toLowerCase() : undefined;
}

function readAttrNames(cBhvr: XmlObject | undefined): string[] {
	const list = cBhvr?.['p:attrNameLst'] as XmlObject | undefined;
	const raw = list?.['p:attrName'];
	const entries = Array.isArray(raw) ? raw : raw !== undefined ? [raw] : [];
	return entries.map(attrText).filter((name): name is string => name !== undefined);
}

function readTiming(cTn: XmlObject | undefined): PptxAnimationBehaviorTiming {
	if (!cTn) {
		return {};
	}
	const timing: PptxAnimationBehaviorTiming = {};
	const durationMs = readTimingAttr(cTn['@_dur']);
	if (durationMs !== undefined) {
		timing.durationMs = durationMs;
	}
	const delayMs = extractStartConditionDelayMs(cTn);
	if (delayMs !== undefined) {
		timing.delayMs = delayMs;
	}
	const accel = parseTimingPercentFraction(cTn['@_accel']);
	if (accel !== undefined) {
		timing.accel = accel;
	}
	const decel = parseTimingPercentFraction(cTn['@_decel']);
	if (decel !== undefined) {
		timing.decel = decel;
	}
	const autoRev = cTn['@_autoRev'];
	if (autoRev === '1' || autoRev === 'true') {
		timing.autoReverse = true;
	}
	const repeat = cTn['@_repeatCount'];
	if (repeat !== undefined && repeat !== 'indefinite') {
		const parsed = Number.parseInt(String(repeat), 10);
		if (Number.isFinite(parsed) && parsed > 0) {
			timing.repeatCount = parsed / 1000;
		}
	}
	if (typeof cTn['@_tmFilter'] === 'string' && cTn['@_tmFilter'].trim() !== '') {
		timing.tmFilter = cTn['@_tmFilter'];
	}
	return timing;
}

function readPoint(node: unknown, scale: number): PptxBehaviorPoint | undefined {
	if (!node || typeof node !== 'object') {
		return undefined;
	}
	const record = node as XmlObject;
	const x = Number.parseFloat(String(record['@_x'] ?? '0'));
	const y = Number.parseFloat(String(record['@_y'] ?? '0'));
	if (!Number.isFinite(x) || !Number.isFinite(y)) {
		return undefined;
	}
	return { x: x / scale, y: y / scale };
}

function readAngle(raw: unknown): number | undefined {
	if (raw === undefined) {
		return undefined;
	}
	const parsed = Number.parseInt(String(raw), 10);
	return Number.isFinite(parsed) ? parsed / 60000 : undefined;
}

function optionalString(raw: unknown): string | undefined {
	return raw !== undefined && raw !== null ? String(raw) : undefined;
}

function parseBehavior(
	tag: (typeof BEHAVIOR_TAGS)[number],
	node: XmlObject,
): PptxAnimationBehavior | undefined {
	const cBhvr = node['p:cBhvr'] as XmlObject | undefined;
	const base = {
		attrNames: readAttrNames(cBhvr),
		timing: readTiming(cBhvr?.['p:cTn'] as XmlObject | undefined),
		...(cBhvr?.['@_additive'] !== undefined ? { additive: String(cBhvr['@_additive']) } : {}),
	};
	switch (tag) {
		case 'p:set': {
			const toNode = node['p:to'] as XmlObject | undefined;
			const decoded = toNode ? decodeKeyframeValue(toNode) : null;
			return decoded ? { kind: 'set', ...base, value: decoded.value } : undefined;
		}
		case 'p:anim': {
			const calcMode = normalizeCalcMode(node['@_calcmode']);
			const valueType = optionalString(node['@_valueType']);
			const from = optionalString(node['@_from']);
			const to = optionalString(node['@_to']);
			const by = optionalString(node['@_by']);
			return {
				kind: 'anim',
				...base,
				keyframes: extractKeyframes(node) ?? [],
				...(calcMode ? { calcMode } : {}),
				...(valueType !== undefined ? { valueType } : {}),
				...(from !== undefined ? { from } : {}),
				...(to !== undefined ? { to } : {}),
				...(by !== undefined ? { by } : {}),
			};
		}
		case 'p:animEffect': {
			const transition = optionalString(node['@_transition']);
			const filter = optionalString(node['@_filter']);
			return {
				kind: 'animEffect',
				...base,
				...(filter !== undefined ? { filter } : {}),
				...(transition === 'in' || transition === 'out' || transition === 'none'
					? { transition }
					: {}),
			};
		}
		case 'p:animScale': {
			const from = readPoint(node['p:from'], 100000);
			const to = readPoint(node['p:to'], 100000);
			const by = readPoint(node['p:by'], 100000);
			const zoom = node['@_zoomContents'];
			return {
				kind: 'animScale',
				...base,
				...(from ? { from } : {}),
				...(to ? { to } : {}),
				...(by ? { by } : {}),
				...(zoom !== undefined ? { zoomContents: zoom === '1' || zoom === 'true' } : {}),
			};
		}
		case 'p:animRot': {
			const from = readAngle(node['@_from']);
			const to = readAngle(node['@_to']);
			const by = readAngle(node['@_by']);
			return {
				kind: 'animRot',
				...base,
				...(from !== undefined ? { from } : {}),
				...(to !== undefined ? { to } : {}),
				...(by !== undefined ? { by } : {}),
			};
		}
		case 'p:animMotion': {
			const path = optionalString(node['@_path']);
			const origin = optionalString(node['@_origin']);
			const from = readPoint(node['p:from'], 1);
			const to = readPoint(node['p:to'], 1);
			const by = readPoint(node['p:by'], 1);
			return {
				kind: 'animMotion',
				...base,
				...(path !== undefined ? { path } : {}),
				...(origin !== undefined ? { origin } : {}),
				...(from ? { from } : {}),
				...(to ? { to } : {}),
				...(by ? { by } : {}),
			};
		}
		default:
			return undefined;
	}
}

/**
 * Every behaviour child of `childTnList`, or `undefined` when it has none.
 * The XML parser groups children by tag, so behaviours come out grouped by
 * kind rather than in document order; they run in parallel, each on its own
 * timing, so playback orders them by start time itself.
 */
export function extractBehaviors(
	childTnList: XmlObject | undefined,
): PptxAnimationBehavior[] | undefined {
	if (!childTnList) {
		return undefined;
	}
	const behaviors: PptxAnimationBehavior[] = [];
	for (const tag of BEHAVIOR_TAGS) {
		for (const node of ensureArray(childTnList[tag])) {
			const parsed = parseBehavior(tag, node);
			if (parsed) {
				behaviors.push(parsed);
			}
		}
	}
	return behaviors.length > 0 ? behaviors : undefined;
}
