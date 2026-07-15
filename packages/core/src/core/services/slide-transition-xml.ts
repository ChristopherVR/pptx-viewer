import type {
	PptxSlideTransition,
	PptxSplitOrientation,
	PptxTransitionSpeed,
	PptxTransitionType,
	XmlObject,
} from '../types';
import type { IPptxXmlLookupService } from './PptxXmlLookupService';

export const STANDARD_TRANSITION_TYPES = new Set<string>([
	'fade',
	'push',
	'wipe',
	'split',
	'randomBar',
	'cut',
	'blinds',
	'checker',
	'circle',
	'comb',
	'cover',
	'diamond',
	'dissolve',
	'plus',
	'pull',
	'random',
	'strips',
	'uncover',
	'wedge',
	'wheel',
	'zoom',
	'newsflash',
]);

const SPEEDS = new Set<PptxTransitionSpeed>(['slow', 'med', 'fast']);
const UINT_MAX = 4_294_967_295;

export interface ParsedTransitionDetails {
	type: PptxTransitionType;
	direction?: string;
	orient?: PptxSplitOrientation;
	spokes?: number;
	pattern?: string;
	thruBlk?: boolean;
	rawSoundAction?: XmlObject;
	rawExtLst?: XmlObject;
}

export function parseTransitionDetails(
	node: XmlObject,
	localName: (key: string) => string,
): ParsedTransitionDetails {
	const result: ParsedTransitionDetails = { type: 'cut' };
	for (const [key, value] of Object.entries(node)) {
		if (key.startsWith('@_')) {
			continue;
		}
		const name = localName(key);
		if (name === 'sndAc') {
			result.rawSoundAction = value as XmlObject;
			continue;
		}
		if (name === 'extLst') {
			result.rawExtLst = value as XmlObject;
			continue;
		}
		if (STANDARD_TRANSITION_TYPES.has(name)) {
			result.type = name as PptxTransitionType;
		}
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			continue;
		}
		const detail = value as XmlObject;
		const direction = token(detail['@_dir']);
		if (direction) {
			result.direction = direction;
		}
		const orient = token(detail['@_orient']);
		if (orient === 'horz' || orient === 'vert') {
			result.orient = orient;
		}
		const spokes = unsignedInteger(detail['@_spokes'], 1);
		if (spokes !== undefined) {
			result.spokes = spokes;
		}
		const pattern = token(detail['@_pattern']);
		if (pattern) {
			result.pattern = pattern;
		}
		const thruBlk = optionalBoolean(detail['@_thruBlk']);
		if (thruBlk !== undefined) {
			result.thruBlk = thruBlk;
		}
	}
	return result;
}

export function parseTransitionAttributes(
	node: XmlObject,
): Pick<PptxSlideTransition, 'speed' | 'durationMs' | 'advanceOnClick' | 'advanceAfterMs'> {
	const speedToken = token(node['@_spd']);
	const speed = SPEEDS.has(speedToken as PptxTransitionSpeed)
		? (speedToken as PptxTransitionSpeed)
		: undefined;
	const durationMs = unsignedInteger(node['@_dur'] ?? node['@_p14:dur'], 1);
	const advanceOnClick = optionalBoolean(node['@_advClick']);
	const advanceAfterMs = unsignedInteger(node['@_advTm']);
	return { speed, durationMs, advanceOnClick, advanceAfterMs };
}

export function parseTransitionSound(
	raw: XmlObject | undefined,
	lookup: IPptxXmlLookupService,
	localName: (key: string) => string,
): Pick<PptxSlideTransition, 'soundRId' | 'soundName' | 'soundLoop' | 'stopSound'> {
	if (!raw) {
		return {};
	}
	const start = lookup.getChildByLocalName(raw, 'stSnd');
	if (start) {
		const sound = lookup.getChildByLocalName(start, 'snd');
		return {
			soundRId: sound ? attributeByLocalName(sound, 'embed', localName) : undefined,
			soundName: sound ? attributeByLocalName(sound, 'name', localName) : undefined,
			soundLoop: optionalBoolean(start['@_loop']),
		};
	}
	const stopSound = Object.keys(raw).some(
		(key) => !key.startsWith('@_') && localName(key) === 'endSnd',
	);
	return stopSound ? { stopSound: true } : {};
}

export function createPreservedTransitionNode(
	raw: XmlObject | undefined,
	localName: (key: string) => string,
): XmlObject {
	const node: XmlObject = raw ? { ...raw } : {};
	for (const key of Object.keys(node)) {
		if (!key.startsWith('@_') && STANDARD_TRANSITION_TYPES.has(localName(key))) {
			delete node[key];
		}
		if (!key.startsWith('@_') && ['sndAc', 'extLst'].includes(localName(key))) {
			delete node[key];
		}
	}
	for (const name of ['@_spd', '@_dur', '@_p14:dur', '@_advClick', '@_advTm']) {
		delete node[name];
	}
	return node;
}

export function buildStandardTransitionChild(transition: PptxSlideTransition): XmlObject {
	const child: XmlObject = {};
	if (transition.direction) {
		child['@_dir'] = transition.direction;
	}
	if (transition.orient) {
		child['@_orient'] = transition.orient;
	}
	if (validUnsignedInteger(transition.spokes, 1)) {
		child['@_spokes'] = String(transition.spokes);
	}
	if (transition.pattern) {
		child['@_pattern'] = transition.pattern;
	}
	if (typeof transition.thruBlk === 'boolean') {
		child['@_thruBlk'] = transition.thruBlk ? '1' : '0';
	}
	return child;
}

export function applyTransitionAttributes(node: XmlObject, transition: PptxSlideTransition): void {
	if (transition.speed && SPEEDS.has(transition.speed)) {
		node['@_spd'] = transition.speed;
	}
	if (validUnsignedInteger(transition.durationMs, 1)) {
		node['@_dur'] = String(transition.durationMs);
	}
	if (typeof transition.advanceOnClick === 'boolean') {
		node['@_advClick'] = transition.advanceOnClick ? '1' : '0';
	}
	if (validUnsignedInteger(transition.advanceAfterMs)) {
		node['@_advTm'] = String(transition.advanceAfterMs);
	}
}

export function buildTransitionSound(
	transition: PptxSlideTransition,
	localName: (key: string) => string,
): XmlObject | undefined {
	if (transition.stopSound) {
		return { 'p:endSnd': {} };
	}
	if (transition.soundRId) {
		const action: XmlObject = transition.rawSoundAction ? { ...transition.rawSoundAction } : {};
		const [startKey, rawStart] = childByLocalName(action, 'stSnd', localName);
		const start: XmlObject = rawStart ? { ...rawStart } : {};
		const [soundKey, rawSound] = childByLocalName(start, 'snd', localName);
		const sound: XmlObject = rawSound ? { ...rawSound } : {};
		setAttributeByLocalName(sound, 'embed', transition.soundRId, '@_r:embed', localName);
		if (transition.soundName !== undefined) {
			setAttributeByLocalName(sound, 'name', transition.soundName, '@_name', localName);
		}
		start[soundKey ?? 'p:snd'] = sound;
		if (typeof transition.soundLoop === 'boolean') {
			start['@_loop'] = transition.soundLoop ? '1' : '0';
		}
		for (const key of Object.keys(action)) {
			if (!key.startsWith('@_') && localName(key) === 'endSnd') {
				delete action[key];
			}
		}
		action[startKey ?? 'p:stSnd'] = start;
		return action;
	}
	return transition.rawSoundAction;
}

function childByLocalName(
	node: XmlObject,
	name: string,
	localName: (key: string) => string,
): [string | undefined, XmlObject | undefined] {
	for (const [key, value] of Object.entries(node)) {
		if (!key.startsWith('@_') && localName(key) === name && value && typeof value === 'object') {
			return [key, value as XmlObject];
		}
	}
	return [undefined, undefined];
}

function setAttributeByLocalName(
	node: XmlObject,
	name: string,
	value: string,
	fallbackKey: string,
	localName: (key: string) => string,
): void {
	const existing = Object.keys(node).find(
		(key) => key.startsWith('@_') && localName(key.slice(2)) === name,
	);
	node[existing ?? fallbackKey] = value;
}

function attributeByLocalName(
	node: XmlObject,
	name: string,
	localName: (key: string) => string,
): string | undefined {
	for (const [key, value] of Object.entries(node)) {
		if (key.startsWith('@_') && localName(key.slice(2)) === name && value !== undefined) {
			return String(value);
		}
	}
	return undefined;
}

function token(value: unknown): string {
	return value === undefined || value === null ? '' : String(value).trim();
}

function optionalBoolean(value: unknown): boolean | undefined {
	const valueToken = token(value).toLowerCase();
	if (!valueToken) {
		return undefined;
	}
	if (['1', 'true'].includes(valueToken)) {
		return true;
	}
	if (['0', 'false'].includes(valueToken)) {
		return false;
	}
	return undefined;
}

function unsignedInteger(value: unknown, min = 0): number | undefined {
	const valueToken = token(value);
	if (!/^\d+$/.test(valueToken)) {
		return undefined;
	}
	const parsed = Number(valueToken);
	return validUnsignedInteger(parsed, min) ? parsed : undefined;
}

function validUnsignedInteger(value: unknown, min = 0): value is number {
	return Number.isInteger(value) && Number(value) >= min && Number(value) <= UINT_MAX;
}
