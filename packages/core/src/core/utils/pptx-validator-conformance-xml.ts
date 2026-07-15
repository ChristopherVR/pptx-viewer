export const ECMA_NAMESPACES = {
	strictP: 'http://purl.oclc.org/ooxml/presentationml/main',
	strictA: 'http://purl.oclc.org/ooxml/drawingml/main',
	strictR: 'http://purl.oclc.org/ooxml/officeDocument/relationships',
	transitionalP: 'http://schemas.openxmlformats.org/presentationml/2006/main',
	transitionalA: 'http://schemas.openxmlformats.org/drawingml/2006/main',
	transitionalR: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
	mce: 'http://schemas.openxmlformats.org/markup-compatibility/2006',
} as const;

export function rootTag(xml: string): string | undefined {
	return xml.match(/<(?!\?|!)([\w.-]+:[\w.-]+|[\w.-]+)(?:\s|\/?>)/)?.[1];
}

export function rootAttributes(xml: string): string {
	const tag = rootTag(xml);
	if (!tag) {
		return '';
	}
	return xml.match(new RegExp(`<${tag}\\b([^>]*)>`))?.[1] ?? '';
}

export function namespaces(xml: string): Map<string, string> {
	const result = new Map<string, string>();
	for (const match of rootAttributes(xml).matchAll(
		/xmlns(?::([\w.-]+))?\s*=\s*["']([^"']+)["']/g,
	)) {
		result.set(match[1] ?? '', match[2]);
	}
	return result;
}

export function allNamespaceDeclarations(xml: string): Map<string, string> {
	const result = new Map<string, string>();
	for (const match of xml.matchAll(/xmlns(?::([\w.-]+))?\s*=\s*["']([^"']+)["']/g)) {
		result.set(match[1] ?? '', match[2]);
	}
	return result;
}

export function directChildren(xml: string): string[] {
	const children: string[] = [];
	const tags = [...xml.matchAll(/<\/?([\w.-]+:[\w.-]+|[\w.-]+)\b[^>]*>/g)];
	let depth = 0;
	for (const match of tags) {
		const token = match[0];
		if (token.startsWith('</')) {
			depth--;
		} else {
			if (depth === 1) {
				children.push(match[1].split(':').pop()!);
			}
			if (!/\/\s*>$/.test(token)) {
				depth++;
			}
		}
	}
	return children;
}

export function elementXml(xml: string, localName: string): string | undefined {
	return xml.match(new RegExp(`<([\\w.-]+:)?${localName}\\b[\\s\\S]*?</\\1?${localName}>`))?.[0];
}
