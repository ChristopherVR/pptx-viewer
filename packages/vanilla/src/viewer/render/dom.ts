import type { CssStyleMap } from 'pptx-viewer-shared';

/**
 * Small DOM helpers shared by the render + UI layers. All creation goes
 * through an explicit `Document` so rendering works against detached
 * documents (tests, export pipelines).
 */

/** camelCase (incl. `WebkitMaskImage`) to kebab-case CSS property name. */
function toCssPropertyName(key: string): string {
	return key.replace(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`);
}

/**
 * Apply a shared `CssStyleMap` to an element. The shared builders emit a mix
 * of camelCase (`backgroundColor`) and kebab-case (`background-color`) keys;
 * both are normalised to `style.setProperty` calls.
 */
export function applyStyleMap(el: HTMLElement | SVGElement, style: CssStyleMap): void {
	for (const [key, value] of Object.entries(style)) {
		if (value === undefined || value === null) {
			continue;
		}
		const property = key.startsWith('--') || key.includes('-') ? key : toCssPropertyName(key);
		el.style.setProperty(property, String(value));
	}
}

/** Create an element with an optional class and style map. */
export function createEl<K extends keyof HTMLElementTagNameMap>(
	doc: Document,
	tag: K,
	className?: string,
	style?: CssStyleMap,
): HTMLElementTagNameMap[K] {
	const el = doc.createElement(tag);
	if (className) {
		el.className = className;
	}
	if (style) {
		applyStyleMap(el, style);
	}
	return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Create a namespaced SVG element with optional attributes. */
export function createSvgEl<K extends keyof SVGElementTagNameMap>(
	doc: Document,
	tag: K,
	attrs?: Record<string, string | number | undefined>,
): SVGElementTagNameMap[K] {
	const el = doc.createElementNS(SVG_NS, tag);
	if (attrs) {
		setSvgAttrs(el, attrs);
	}
	return el;
}

/** Set attributes on an SVG element, skipping undefined values. */
export function setSvgAttrs(
	el: SVGElement,
	attrs: Record<string, string | number | undefined>,
): void {
	for (const [name, value] of Object.entries(attrs)) {
		if (value !== undefined) {
			el.setAttribute(name, String(value));
		}
	}
}

/**
 * Compose two transform strings (either may be empty/undefined). Used to merge
 * the container's rotation/flip transform with style-layer transforms (3D).
 */
export function composeTransforms(
	first: string | number | undefined,
	second: string | number | undefined,
): string | undefined {
	const a = first === undefined ? '' : String(first);
	const b = second === undefined ? '' : String(second);
	if (a && b) {
		return `${a} ${b}`;
	}
	return a || b || undefined;
}
