import type { PptxAnimationTarget, PptxGraphicBuild, XmlObject } from '../types';

function ensureArray(value: unknown): XmlObject[] {
	if (value === undefined || value === null) {
		return [];
	}
	const values = Array.isArray(value) ? value : [value];
	return values.filter(
		(item): item is XmlObject => typeof item === 'object' && item !== null && !Array.isArray(item),
	);
}

/** Parse the schema choice inside `p:tgtEl`. */
export function parseTimeTargetElement(
	tgtEl: XmlObject | undefined,
): PptxAnimationTarget | undefined {
	if (!tgtEl) {
		return undefined;
	}

	const rawXml = tgtEl;
	const shape = tgtEl['p:spTgt'] as XmlObject | undefined;
	if (shape?.['@_spid'] !== undefined) {
		return { type: 'shape', shapeId: String(shape['@_spid']), rawXml };
	}
	if (tgtEl['p:sldTgt'] !== undefined) {
		return { type: 'slide', rawXml };
	}

	const sound = tgtEl['p:sndTgt'] as XmlObject | undefined;
	const relationshipId = sound?.['@_r:embed'] ?? sound?.['@_embed'];
	if (relationshipId !== undefined) {
		return {
			type: 'sound',
			relationshipId: String(relationshipId),
			name: sound?.['@_name'] !== undefined ? String(sound['@_name']) : undefined,
			rawXml,
		};
	}

	const ink = tgtEl['p:inkTgt'] as XmlObject | undefined;
	if (ink?.['@_spid'] !== undefined) {
		return { type: 'ink', shapeId: String(ink['@_spid']), rawXml };
	}

	return { type: 'unknown', rawXml };
}

/** Serialize a timing target while retaining unmodelled target XML. */
export function serializeTimeTargetElement(target: PptxAnimationTarget): XmlObject {
	const result: XmlObject = { ...(target.rawXml ?? {}) };
	switch (target.type) {
		case 'shape':
			result['p:spTgt'] = {
				...((result['p:spTgt'] as XmlObject | undefined) ?? {}),
				'@_spid': target.shapeId,
			};
			break;
		case 'slide':
			result['p:sldTgt'] ??= {};
			break;
		case 'sound':
			result['p:sndTgt'] = {
				...((result['p:sndTgt'] as XmlObject | undefined) ?? {}),
				'@_r:embed': target.relationshipId,
				...(target.name !== undefined ? { '@_name': target.name } : {}),
			};
			break;
		case 'ink':
			result['p:inkTgt'] = {
				...((result['p:inkTgt'] as XmlObject | undefined) ?? {}),
				'@_spid': target.shapeId,
			};
			break;
		case 'unknown':
			break;
	}
	return result;
}

/** Find the first behavior target in a common timing node. */
export function extractAnimationTarget(cTn: XmlObject): PptxAnimationTarget | undefined {
	const childTnList = cTn['p:childTnLst'] as XmlObject | undefined;
	if (!childTnList) {
		return undefined;
	}

	for (const tag of [
		'p:animEffect',
		'p:anim',
		'p:animMotion',
		'p:animRot',
		'p:animScale',
		'p:animClr',
		'p:cmd',
		'p:set',
	] as const) {
		for (const node of ensureArray(childTnList[tag])) {
			const behavior = node['p:cBhvr'] as XmlObject | undefined;
			const target = parseTimeTargetElement(behavior?.['p:tgtEl'] as XmlObject | undefined);
			if (target) {
				return target;
			}
		}
	}

	for (const tag of ['p:par', 'p:seq', 'p:excl'] as const) {
		for (const node of ensureArray(childTnList[tag])) {
			const nested = node['p:cTn'] as XmlObject | undefined;
			const target = nested ? extractAnimationTarget(nested) : undefined;
			if (target) {
				return target;
			}
		}
	}
	return undefined;
}

export interface PptxGraphicBuildEntry {
	shapeId: string;
	groupId: string;
	uiExpand?: boolean;
	build: PptxGraphicBuild;
	rawXml?: XmlObject;
}

/** Parse `p:bldDgm` entries from the slide build list. */
export function extractSmartArtBuilds(
	bldLst: XmlObject | undefined,
): Array<{ spid: string; bld: string }> {
	if (!bldLst) {
		return [];
	}
	return ensureArray(bldLst['p:bldDgm'])
		.filter((entry) => entry['@_spid'] !== undefined)
		.map((entry) => ({
			spid: String(entry['@_spid']),
			bld: String(entry['@_bld'] ?? 'whole'),
		}));
}

/** Parse `p:bldOleChart` entries from the slide build list. */
export function extractOleChartBuilds(
	bldLst: XmlObject | undefined,
): Array<{ spid: string; grpId: string; bld: string; animBg?: boolean }> {
	if (!bldLst) {
		return [];
	}
	return ensureArray(bldLst['p:bldOleChart'])
		.filter((entry) => entry['@_spid'] !== undefined)
		.map((entry) => ({
			spid: String(entry['@_spid']),
			grpId: String(entry['@_grpId'] ?? '0'),
			bld: String(entry['@_bld'] ?? 'allAtOnce'),
			animBg: entry['@_animBg'] === '1' ? true : undefined,
		}));
}

/** Parse schema-accurate `p:bldGraphic` entries. */
export function extractGraphicBuilds(bldLst: XmlObject | undefined): PptxGraphicBuildEntry[] {
	if (!bldLst) {
		return [];
	}

	const result: PptxGraphicBuildEntry[] = [];
	for (const entry of ensureArray(bldLst['p:bldGraphic'])) {
		if (entry['@_spid'] === undefined || entry['@_grpId'] === undefined) {
			continue;
		}
		const common = {
			shapeId: String(entry['@_spid']),
			groupId: String(entry['@_grpId']),
			uiExpand: parseOptionalBoolean(entry['@_uiExpand']),
			rawXml: entry,
		};
		if (entry['p:bldAsOne'] !== undefined) {
			result.push({ ...common, build: { mode: 'asOne', rawXml: entry } });
			continue;
		}
		const sub = entry['p:bldSub'] as XmlObject | undefined;
		const diagram = sub?.['a:bldDgm'] as XmlObject | undefined;
		if (diagram) {
			result.push({
				...common,
				build: {
					mode: 'sub',
					kind: 'diagram',
					build: String(diagram['@_bld'] ?? 'allAtOnce'),
					reverse: parseBoolean(diagram['@_rev'], false),
					rawXml: entry,
				},
			});
			continue;
		}
		const chart = sub?.['a:bldChart'] as XmlObject | undefined;
		if (chart) {
			result.push({
				...common,
				build: {
					mode: 'sub',
					kind: 'chart',
					build: String(chart['@_bld'] ?? 'allAtOnce'),
					animateBackground: parseBoolean(chart['@_animBg'], true),
					rawXml: entry,
				},
			});
		}
	}
	return result;
}

/** Serialize one `p:bldGraphic` entry while preserving unknown XML. */
export function serializeGraphicBuild(entry: PptxGraphicBuildEntry): XmlObject {
	const result: XmlObject = {
		...(entry.rawXml ?? entry.build.rawXml ?? {}),
		'@_spid': entry.shapeId,
		'@_grpId': entry.groupId,
	};
	if (entry.uiExpand !== undefined) {
		result['@_uiExpand'] = entry.uiExpand ? '1' : '0';
	}
	if (entry.build.mode === 'asOne') {
		result['p:bldAsOne'] ??= {};
		return result;
	}

	const rawSub = (result['p:bldSub'] as XmlObject | undefined) ?? {};
	if (entry.build.kind === 'diagram') {
		rawSub['a:bldDgm'] = {
			...((rawSub['a:bldDgm'] as XmlObject | undefined) ?? {}),
			'@_bld': entry.build.build,
			'@_rev': entry.build.reverse ? '1' : '0',
		};
	} else {
		rawSub['a:bldChart'] = {
			...((rawSub['a:bldChart'] as XmlObject | undefined) ?? {}),
			'@_bld': entry.build.build,
			'@_animBg': entry.build.animateBackground ? '1' : '0',
		};
	}
	result['p:bldSub'] = rawSub;
	return result;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
	return value === undefined ? undefined : parseBoolean(value, false);
}

function parseBoolean(value: unknown, defaultValue: boolean): boolean {
	return value === undefined
		? defaultValue
		: value === true || value === 1 || value === '1' || value === 'true';
}
