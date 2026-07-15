import type { PptxCompatibilityWarning, XmlObject } from '../types';
import { isAlternateContentChoiceSupported } from '../utils/alternate-content';

interface AlternateContentWarning {
	code: string;
	message: string;
	severity: PptxCompatibilityWarning['severity'];
	scope: 'presentation' | 'slide';
	slideId?: string;
	xmlPath: string;
}

export function inspectAlternateContentWarnings(
	node: unknown,
	scope: 'presentation' | 'slide',
	slideId: string | undefined,
	path: string,
	report: (warning: AlternateContentWarning) => void,
): void {
	if (!node || typeof node !== 'object') {
		return;
	}
	if (Array.isArray(node)) {
		node.forEach((item, index) =>
			inspectAlternateContentWarnings(item, scope, slideId, `${path}[${index}]`, report),
		);
		return;
	}
	for (const [key, value] of Object.entries(node as XmlObject)) {
		if (key === 'mc:AlternateContent') {
			for (const block of asArray(value)) {
				for (const choice of asArray(block?.['mc:Choice'])) {
					if (isAlternateContentChoiceSupported(choice)) {
						continue;
					}
					const requires = String(choice['@_Requires'] || '(missing)');
					report({
						code: 'UNSUPPORTED_ALTERNATE_CONTENT_CHOICE',
						message: `An mc:Choice requiring "${requires}" is not implemented; its fallback is used when available.`,
						severity: block?.['mc:Fallback'] ? 'info' : 'warning',
						scope,
						slideId,
						xmlPath: `${path}/mc:AlternateContent/mc:Choice`,
					});
				}
			}
		}
		inspectAlternateContentWarnings(value, scope, slideId, `${path}/${key}`, report);
	}
}

function asArray(value: unknown): XmlObject[] {
	if (!value) {
		return [];
	}
	return (Array.isArray(value) ? value : [value]) as XmlObject[];
}
