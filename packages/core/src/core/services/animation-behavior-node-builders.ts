/**
 * Generic OOXML behaviour-node builders that turn a resolved (i.e. already
 * scaled to milliseconds) `AnimBehaviorNodeSpec` into the `XmlObject` shape
 * `animation-write-node-effect.ts` assembles into a `p:childTnLst`. Split out
 * of the preset tables (`animation-behavior-*.ts`) so each stays data-only.
 *
 * @module services/animation-behavior-node-builders
 */
import type { XmlObject } from '../types';
import type {
	AnimBehaviorNodeSpec,
	AnimBehaviorTav,
	AnimBehaviorTiming,
} from './animation-behavior-node-types';

function timingAttrs(t: AnimBehaviorTiming): Record<string, string> {
	const attrs: Record<string, string> = { '@_dur': String(Math.max(0, Math.round(t.durMs))) };
	if (t.accel) {
		attrs['@_accel'] = String(t.accel);
	}
	if (t.decel) {
		attrs['@_decel'] = String(t.decel);
	}
	if (t.autoRev) {
		attrs['@_autoRev'] = '1';
	}
	if (t.fill) {
		attrs['@_fill'] = t.fill;
	}
	if (t.tmFilter) {
		attrs['@_tmFilter'] = t.tmFilter;
	}
	return attrs;
}

function cTnWithDelay(t: AnimBehaviorTiming, id: number): XmlObject {
	const cTn: XmlObject = { '@_id': String(id), ...timingAttrs(t) };
	if (t.delayMs !== undefined) {
		cTn['p:stCondLst'] = { 'p:cond': { '@_delay': String(Math.max(0, Math.round(t.delayMs))) } };
	}
	return cTn;
}

function tgtEl(shapeId: string): XmlObject {
	return { 'p:tgtEl': { 'p:spTgt': { '@_spid': shapeId } } } as XmlObject;
}

function tavValue(tav: AnimBehaviorTav): XmlObject {
	return tav.valType === 'flt'
		? { 'p:fltVal': { '@_val': tav.val } }
		: { 'p:strVal': { '@_val': tav.val } };
}

function buildTavLst(tav: AnimBehaviorTav[]): XmlObject {
	const nodes = tav.map((t) => {
		const node: XmlObject = { '@_tm': String(t.tm) };
		if (t.fmla) {
			node['@_fmla'] = t.fmla;
		}
		node['p:val'] = tavValue(t);
		return node;
	});
	return { 'p:tav': nodes.length === 1 ? nodes[0] : nodes } as XmlObject;
}

/** Build one resolved behaviour node as a tagged `XmlObject` (`_type` names the childTnLst group). */
export function buildBehaviorNode(
	spec: AnimBehaviorNodeSpec,
	shapeId: string,
	allocateId: () => number,
): XmlObject {
	switch (spec.kind) {
		case 'set': {
			const id = allocateId();
			return {
				_type: 'set',
				'p:cBhvr': {
					'p:cTn': cTnWithDelay(spec, id),
					...tgtEl(shapeId),
					'p:attrNameLst': { 'p:attrName': spec.attrName },
				},
				'p:to': { 'p:strVal': { '@_val': spec.to } },
			} as XmlObject;
		}
		case 'animEffect': {
			const id = allocateId();
			const node: XmlObject = {
				_type: 'animEffect',
				'p:cBhvr': { 'p:cTn': cTnWithDelay(spec, id), ...tgtEl(shapeId) },
			};
			if (spec.transition) {
				node['@_transition'] = spec.transition;
			}
			if (spec.filter) {
				node['@_filter'] = spec.filter;
			}
			if (spec.prLst) {
				node['@_prLst'] = spec.prLst;
			}
			return node;
		}
		case 'anim': {
			const id = allocateId();
			const node: XmlObject = {
				_type: 'anim',
				'@_calcmode': 'lin',
				'@_valueType': 'num',
				'p:cBhvr': {
					...(spec.additive ? { '@_additive': spec.additive } : {}),
					'p:cTn': cTnWithDelay(spec, id),
					...tgtEl(shapeId),
					'p:attrNameLst': { 'p:attrName': spec.attrName },
				},
			};
			if (spec.tav && spec.tav.length > 0) {
				node['p:tavLst'] = buildTavLst(spec.tav);
			} else {
				if (spec.from !== undefined) {
					node['@_from'] = spec.from;
				}
				if (spec.to !== undefined) {
					node['@_to'] = spec.to;
				}
				if (spec.by !== undefined) {
					node['@_by'] = spec.by;
				}
			}
			return node;
		}
		case 'animScale': {
			const id = allocateId();
			const node: XmlObject = {
				_type: 'animScale',
				'p:cBhvr': { 'p:cTn': cTnWithDelay(spec, id), ...tgtEl(shapeId) },
			};
			if (spec.mode.form === 'to') {
				node['p:to'] = { '@_x': String(spec.mode.x), '@_y': String(spec.mode.y) };
			} else if (spec.mode.form === 'by') {
				node['p:by'] = { '@_x': String(spec.mode.x), '@_y': String(spec.mode.y) };
			} else {
				node['p:from'] = { '@_x': String(spec.mode.fromX), '@_y': String(spec.mode.fromY) };
				node['p:to'] = { '@_x': String(spec.mode.toX), '@_y': String(spec.mode.toY) };
			}
			return node;
		}
		case 'animRot': {
			const id = allocateId();
			return {
				_type: 'animRot',
				'@_by': String(spec.by),
				'p:cBhvr': {
					'p:cTn': cTnWithDelay(spec, id),
					...tgtEl(shapeId),
					'p:attrNameLst': { 'p:attrName': 'r' },
				},
			} as XmlObject;
		}
		case 'animClr': {
			const id = allocateId();
			const node: XmlObject = {
				_type: 'animClr',
				'@_clrSpc': spec.clrSpc,
				'@_dir': spec.dir ?? 'cw',
				'p:cBhvr': {
					...(spec.overrideChildStyle ? { '@_override': 'childStyle' } : {}),
					'p:cTn': cTnWithDelay(spec, id),
					...tgtEl(shapeId),
					'p:attrNameLst': { 'p:attrName': spec.attrName },
				},
			};
			if (spec.mode.form === 'byHsl') {
				node['p:by'] = {
					'p:hsl': {
						'@_h': String(spec.mode.h),
						'@_s': String(spec.mode.s),
						'@_l': String(spec.mode.l),
					},
				};
			} else {
				node['p:to'] = { 'a:schemeClr': { '@_val': spec.mode.val } };
			}
			return node;
		}
		case 'animMotion': {
			const id = allocateId();
			const node: XmlObject = {
				_type: 'animMotion',
				'@_path': spec.path,
				'p:cBhvr': {
					'p:cTn': cTnWithDelay(spec, id),
					...tgtEl(shapeId),
					'p:attrNameLst': { 'p:attrName': [{ '#text': 'ppt_x' }, { '#text': 'ppt_y' }] },
				},
			};
			if (spec.origin) {
				node['@_origin'] = spec.origin;
			}
			if (spec.pathEditMode) {
				node['@_pathEditMode'] = spec.pathEditMode;
			}
			return node;
		}
	}
}

/** Build every resolved node in a template's `nodes` list, in order. */
export function buildBehaviorNodes(
	specs: ReadonlyArray<AnimBehaviorNodeSpec>,
	shapeId: string,
	allocateId: () => number,
): XmlObject[] {
	return specs.map((spec) => buildBehaviorNode(spec, shapeId, allocateId));
}
