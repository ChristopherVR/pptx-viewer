import type { XmlObject } from '../types';

const COLOR_CHOICE_KEYS = [
	'a:scrgbClr',
	'a:srgbClr',
	'a:hslClr',
	'a:sysClr',
	'a:schemeClr',
	'a:prstClr',
] as const;

/** Preserve the verbatim colour choice from a DrawingML style reference. */
export function extractStyleReferenceColorXml(
	refNode: XmlObject | undefined,
): XmlObject | undefined {
	if (!refNode) {
		return undefined;
	}
	for (const key of COLOR_CHOICE_KEYS) {
		const child = refNode[key];
		if (child !== undefined) {
			return { [key]: child } as XmlObject;
		}
	}
	return undefined;
}

/** Run an operation with the style reference colour temporarily bound to `phClr`. */
export function withThemePlaceholderColor<T>(
	themeColorMap: Record<string, string>,
	placeholderColor: string,
	operation: () => T,
): T {
	const previous = themeColorMap.phclr;
	themeColorMap.phclr = placeholderColor;
	try {
		return operation();
	} finally {
		if (previous === undefined) {
			delete themeColorMap.phclr;
		} else {
			themeColorMap.phclr = previous;
		}
	}
}
