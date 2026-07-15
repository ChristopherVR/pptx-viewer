import {
	allNamespaceDeclarations,
	directChildren,
	ECMA_NAMESPACES,
} from './pptx-validator-conformance-xml';
import type { ValidationIssue } from './pptx-validator-types';

function add(issues: ValidationIssue[], path: string, code: string, message: string): void {
	issues.push({ severity: 'error', code, message, path });
}

function escaped(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkPrefixes(
	value: string,
	label: string,
	ns: Map<string, string>,
	path: string,
	issues: ValidationIssue[],
): void {
	for (const token of value.trim().split(/\s+/).filter(Boolean)) {
		const prefix = token.includes(':') ? token.split(':')[0] : token;
		if (!ns.has(prefix)) {
			add(
				issues,
				path,
				'MCE_UNDECLARED_PREFIX',
				`${label} references undeclared prefix "${prefix}"`,
			);
		}
	}
}

function checkAlternate(
	xml: string,
	qualifier: string,
	ns: Map<string, string>,
	path: string,
	issues: ValidationIssue[],
): void {
	for (const match of xml.matchAll(new RegExp(`<${qualifier}Choice\\b([^>]*)>`, 'g'))) {
		const requires = match[1].match(/\bRequires\s*=\s*["']([^"']*)["']/)?.[1].trim();
		if (!requires) {
			add(
				issues,
				path,
				'MCE_MISSING_REQUIRES',
				'An MCE Choice must have a non-empty Requires attribute',
			);
			continue;
		}
		for (const prefix of requires.split(/\s+/)) {
			if (!/^[A-Za-z_][\w.-]*$/.test(prefix)) {
				add(
					issues,
					path,
					'MCE_INVALID_REQUIRES',
					`MCE Choice Requires token "${prefix}" is not an NCName`,
				);
			} else if (!ns.has(prefix)) {
				add(
					issues,
					path,
					'MCE_UNDECLARED_PREFIX',
					`MCE Choice Requires references undeclared prefix "${prefix}"`,
				);
			}
		}
	}
	const pattern = new RegExp(
		`<${qualifier}AlternateContent\\b[^>]*>([\\s\\S]*?)<\\/${qualifier}AlternateContent>`,
		'g',
	);
	for (const match of xml.matchAll(pattern)) {
		const children = directChildren(`<root>${match[1]}</root>`);
		const fallback = children.indexOf('Fallback');
		if (!children.includes('Choice')) {
			add(
				issues,
				path,
				'MCE_INVALID_ALTERNATE_CONTENT',
				'MCE AlternateContent must contain at least one Choice',
			);
		}
		if (
			children.some((name) => name !== 'Choice' && name !== 'Fallback') ||
			children.filter((name) => name === 'Fallback').length > 1 ||
			(fallback >= 0 && fallback !== children.length - 1)
		) {
			add(
				issues,
				path,
				'MCE_INVALID_ALTERNATE_CONTENT',
				'MCE AlternateContent must contain Choices followed by at most one Fallback',
			);
		}
	}
}

export function validateMce(xml: string, path: string, issues: ValidationIssue[]): void {
	const ns = allNamespaceDeclarations(xml);
	const prefixes = [...ns]
		.filter(([, uri]) => uri === ECMA_NAMESPACES.mce)
		.map(([prefix]) => prefix);
	if (/\bmc:|<mc:/.test(xml) && ns.get('mc') !== ECMA_NAMESPACES.mce) {
		add(
			issues,
			path,
			'UNDECLARED_MCE_NAMESPACE',
			'Markup Compatibility markup uses mc without declaring the MCE namespace',
		);
	}
	for (const prefix of prefixes) {
		const qualifier = prefix ? `${escaped(prefix)}:` : '';
		const directives = new RegExp(
			`\\b${qualifier}(Ignorable|ProcessContent|PreserveElements|PreserveAttributes)\\s*=\\s*["']([^"']*)["']`,
			'g',
		);
		for (const match of xml.matchAll(directives)) {
			checkPrefixes(match[2], `MCE ${match[1]}`, ns, path, issues);
		}
		checkAlternate(xml, qualifier, ns, path, issues);
	}
}
