/**
 * Small XML helpers for the generated PPTX parts.
 *
 * @module ppt/pptx/xml-utils
 */

/** True for control characters that are invalid in XML 1.0 text. */
function isInvalidXmlChar(code: number): boolean {
	return (code >= 0x00 && code <= 0x08) || (code >= 0x0e && code <= 0x1f);
}

/** Escape text content for XML. */
export function esc(value: string): string {
	let cleaned = '';
	for (const ch of value) {
		if (!isInvalidXmlChar(ch.charCodeAt(0))) {
			cleaned += ch;
		}
	}
	return cleaned
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** Uppercase hex color without '#'. */
export function hexColor(rgb: string): string {
	return rgb.replace(/^#/, '').toUpperCase();
}

/** A solid fill element. */
export function solidFill(rgb: string): string {
	return `<a:solidFill><a:srgbClr val="${hexColor(rgb)}"/></a:solidFill>`;
}

/** Clamp and round an EMU value to a safe integer. */
export function emu(value: number): number {
	return Math.round(value);
}
