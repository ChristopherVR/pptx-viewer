import type { EffectDagContainer, EffectDagNode, XmlObject } from '../../types';
import {
	serializeEffectDagAlphaOutset,
	serializeEffectDagBlur,
	serializeEffectDagPresetShadow,
} from './effect-dag-primitives';

export function serializeEffectDagContainerNode(container: EffectDagContainer): XmlObject {
	const xml: XmlObject = { '@_type': container.type };
	if (container.name) {
		xml['@_name'] = container.name;
	}
	for (const child of container.children) {
		appendChild(xml, child);
	}
	return xml;
}

function appendChild(parent: XmlObject, child: EffectDagNode): void {
	if (child.kind === 'cont') {
		push(parent, 'a:cont', serializeEffectDagContainerNode(child));
	} else if (child.kind === 'blend') {
		push(parent, 'a:blend', {
			'@_blend': child.mode,
			'a:cont': serializeEffectDagContainerNode(child.container),
		});
	} else if (child.kind === 'xfrmEffect') {
		push(parent, 'a:xfrmEffect', numericAttributes(child, ['sx', 'sy', 'kx', 'ky', 'tx', 'ty']));
	} else if (child.kind === 'relOff') {
		push(parent, 'a:relOff', numericAttributes(child, ['tx', 'ty']));
	} else if (child.kind === 'blur') {
		push(parent, 'a:blur', serializeEffectDagBlur(child));
	} else if (child.kind === 'alphaOutset') {
		push(parent, 'a:alphaOutset', serializeEffectDagAlphaOutset(child));
	} else if (child.kind === 'prstShdw') {
		push(parent, 'a:prstShdw', serializeEffectDagPresetShadow(child));
	} else {
		push(parent, `a:${localName(child.tag)}`, child.xml as XmlObject);
	}
}

function numericAttributes(source: object, names: string[]): XmlObject {
	const xml: XmlObject = {};
	const record = source as Record<string, unknown>;
	for (const name of names) {
		if (typeof record[name] === 'number' && Number.isSafeInteger(record[name])) {
			xml[`@_${name}`] = String(record[name]);
		}
	}
	return xml;
}

function push(parent: XmlObject, key: string, value: XmlObject): void {
	const previous = parent[key];
	if (previous === undefined) {
		parent[key] = value;
	} else if (Array.isArray(previous)) {
		parent[key] = [...(previous as XmlObject[]), value];
	} else {
		parent[key] = [previous as XmlObject, value];
	}
}

function localName(name: string): string {
	return name.includes(':') ? name.slice(name.indexOf(':') + 1) : name;
}
