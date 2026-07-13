import type { XmlObject } from 'pptx-viewer-core';

/**
 * Read the first explicit DrawingML run colour nested inside an OMML tree.
 * Office Math stores formatting in `a:rPr`, not in `m:rPr`, so this colour
 * must travel with the generated MathML rather than the text shape's default
 * paragraph style.
 */
export function getOmmlMathColor(node: XmlObject | undefined): string | undefined {
	if (!node || typeof node !== 'object') {
		return undefined;
	}

	const drawingRunProperties = node['a:rPr'];
	if (drawingRunProperties && typeof drawingRunProperties === 'object') {
		const solidFill = (drawingRunProperties as XmlObject)['a:solidFill'];
		const srgbColor =
			solidFill && typeof solidFill === 'object'
				? ((solidFill as XmlObject)['a:srgbClr'] as XmlObject | undefined)
				: undefined;
		const value = srgbColor?.['@_val'];
		if (typeof value === 'string' && /^[0-9a-f]{6}$/iu.test(value)) {
			return `#${value.toUpperCase()}`;
		}
	}

	for (const value of Object.values(node)) {
		if (Array.isArray(value)) {
			for (const child of value) {
				if (child && typeof child === 'object') {
					const color = getOmmlMathColor(child as XmlObject);
					if (color) {
						return color;
					}
				}
			}
		} else if (value && typeof value === 'object') {
			const color = getOmmlMathColor(value as XmlObject);
			if (color) {
				return color;
			}
		}
	}

	return undefined;
}

/** Read the first explicit DrawingML run size, stored in hundredths of a point. */
export function getOmmlMathFontSize(node: XmlObject | undefined): number | undefined {
	if (!node || typeof node !== 'object') {
		return undefined;
	}

	const drawingRunProperties = node['a:rPr'];
	if (drawingRunProperties && typeof drawingRunProperties === 'object') {
		const size = Number((drawingRunProperties as XmlObject)['@_sz']);
		if (Number.isFinite(size) && size > 0) {
			return size / 100;
		}
	}

	for (const value of Object.values(node)) {
		if (Array.isArray(value)) {
			for (const child of value) {
				if (child && typeof child === 'object') {
					const size = getOmmlMathFontSize(child as XmlObject);
					if (size) {
						return size;
					}
				}
			}
		} else if (value && typeof value === 'object') {
			const size = getOmmlMathFontSize(value as XmlObject);
			if (size) {
				return size;
			}
		}
	}

	return undefined;
}
