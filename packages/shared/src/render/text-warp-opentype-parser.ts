import type { Font } from 'opentype.js';
import * as opentypeModule from 'opentype.js';

export type OpenTypeFontParser = (buffer: ArrayBuffer) => Font;

type OpenTypeModuleShape = {
	parse?: OpenTypeFontParser;
	default?: { parse?: OpenTypeFontParser };
};

/** Resolve opentype.js as either its ESM namespace or its CommonJS default object. */
export function parseOpenTypeFont(
	buffer: ArrayBuffer,
	module: OpenTypeModuleShape = opentypeModule as unknown as OpenTypeModuleShape,
): Font {
	const parser = module.parse ?? module.default?.parse;
	if (!parser) {
		throw new Error('opentype.js does not expose a font parser');
	}
	return parser(buffer);
}
