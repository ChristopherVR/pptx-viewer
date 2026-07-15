import {
	allNamespaceDeclarations,
	directChildren,
	ECMA_NAMESPACES,
} from './pptx-validator-conformance-xml';
import type { ValidationIssue } from './pptx-validator-types';

const EFFECTS = new Set([
	'blinds',
	'checker',
	'circle',
	'dissolve',
	'comb',
	'cover',
	'cut',
	'diamond',
	'fade',
	'newsflash',
	'plus',
	'pull',
	'push',
	'random',
	'randomBar',
	'split',
	'strips',
	'uncover',
	'wedge',
	'wheel',
	'wipe',
	'zoom',
]);
const P_NAMESPACES: ReadonlySet<string> = new Set([
	ECMA_NAMESPACES.strictP,
	ECMA_NAMESPACES.transitionalP,
]);
const R_NAMESPACES: ReadonlySet<string> = new Set([
	ECMA_NAMESPACES.strictR,
	ECMA_NAMESPACES.transitionalR,
]);

interface ElementMatch {
	prefix: string;
	attributes: string;
	body: string;
}

export function validateSlideTransitions(
	xml: string,
	path: string,
	issues: ValidationIssue[],
): void {
	const namespaces = allNamespaceDeclarations(xml);
	for (const transition of matchingElements(xml, 'transition')) {
		if (!P_NAMESPACES.has(namespaces.get(transition.prefix) ?? '')) {
			continue;
		}
		validateAttributes(transition.attributes, path, issues);
		const children = directChildren(`<root>${transition.body}</root>`);
		const effects = children.filter((child) => EFFECTS.has(child));
		if (effects.length > 1) {
			add(issues, path, 'TRANSITION_INVALID_CHOICE', 'A slide transition may contain one effect');
		}
		const soundActions = matchingElements(transition.body, 'sndAc');
		if (soundActions.length > 1) {
			add(
				issues,
				path,
				'TRANSITION_INVALID_SOUND',
				'A slide transition may contain one sound action',
			);
		}
		for (const soundAction of soundActions) {
			if (P_NAMESPACES.has(namespaces.get(soundAction.prefix) ?? '')) {
				validateSoundAction(soundAction.body, namespaces, path, issues);
			}
		}
	}
}

function validateAttributes(attributes: string, path: string, issues: ValidationIssue[]): void {
	const speed = attribute(attributes, 'spd');
	if (speed !== undefined && !['slow', 'med', 'fast'].includes(speed)) {
		add(
			issues,
			path,
			'TRANSITION_INVALID_SPEED',
			`Transition speed "${speed}" is not slow, med, or fast`,
		);
	}
	const click = attribute(attributes, 'advClick');
	if (click !== undefined && !['0', '1', 'false', 'true'].includes(click)) {
		add(
			issues,
			path,
			'TRANSITION_INVALID_BOOLEAN',
			`Transition advClick "${click}" is not an XML boolean`,
		);
	}
	const advance = attribute(attributes, 'advTm');
	if (advance !== undefined && !unsignedInteger(advance)) {
		add(
			issues,
			path,
			'TRANSITION_INVALID_TIME',
			`Transition advTm "${advance}" is not an unsigned integer`,
		);
	}
}

function validateSoundAction(
	body: string,
	namespaces: Map<string, string>,
	path: string,
	issues: ValidationIssue[],
): void {
	const starts = matchingElements(body, 'stSnd').filter((item) =>
		P_NAMESPACES.has(namespaces.get(item.prefix) ?? ''),
	);
	const ends = matchingElements(body, 'endSnd').filter((item) =>
		P_NAMESPACES.has(namespaces.get(item.prefix) ?? ''),
	);
	if (starts.length + ends.length !== 1) {
		add(
			issues,
			path,
			'TRANSITION_INVALID_SOUND',
			'Sound action must contain exactly one stSnd or endSnd',
		);
		return;
	}
	if (starts.length === 0) {
		return;
	}
	const loop = attribute(starts[0].attributes, 'loop');
	if (loop !== undefined && !['0', '1', 'false', 'true'].includes(loop)) {
		add(
			issues,
			path,
			'TRANSITION_INVALID_BOOLEAN',
			`Transition sound loop "${loop}" is not an XML boolean`,
		);
	}
	const sounds = matchingElements(starts[0].body, 'snd');
	if (sounds.length !== 1) {
		add(
			issues,
			path,
			'TRANSITION_INVALID_SOUND',
			'stSnd must contain exactly one embedded WAV snd element',
		);
		return;
	}
	const embedPrefix = sounds[0].attributes.match(
		/(?:^|\s)([\w.-]+):embed\s*=\s*["'][^"']+["']/,
	)?.[1];
	if (!embedPrefix || !R_NAMESPACES.has(namespaces.get(embedPrefix) ?? '')) {
		add(
			issues,
			path,
			'TRANSITION_MISSING_SOUND_RELATIONSHIP',
			'Embedded WAV snd requires an r:embed relationship ID',
		);
	}
}

function matchingElements(xml: string, localName: string): ElementMatch[] {
	const escaped = localName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const paired = new RegExp(
		`<(?:([\\w.-]+):)?${escaped}\\b([^>]*)>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${escaped}\\s*>`,
		'g',
	);
	const empty = new RegExp(`<(?:([\\w.-]+):)?${escaped}\\b([^>]*)\\/>`, 'g');
	return [
		...[...xml.matchAll(paired)].map((match) => ({
			prefix: match[1] ?? '',
			attributes: match[2],
			body: match[3],
		})),
		...[...xml.matchAll(empty)].map((match) => ({
			prefix: match[1] ?? '',
			attributes: match[2],
			body: '',
		})),
	];
}

function attribute(attributes: string, name: string): string | undefined {
	return attributes.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`))?.[1];
}

function unsignedInteger(value: string): boolean {
	return /^\d+$/.test(value) && Number(value) <= 4_294_967_295;
}

function add(issues: ValidationIssue[], path: string, code: string, message: string): void {
	issues.push({ severity: 'error', code, message, path });
}
