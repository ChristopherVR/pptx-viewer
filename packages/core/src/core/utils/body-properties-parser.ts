import type { XmlObject, TextStyle } from '../types';

/**
 * Parse additional boolean body properties from a:bodyPr attributes.
 *
 * Handles the boolean / numeric attributes defined on
 * CT_TextBodyProperties that aren't mapped elsewhere in the runtime:
 *   `compatLnSpc`, `forceAA`, `upright`, `fromWordArt`,
 *   `spcFirstLastPara`, `anchorCtr`, `rtlCol`, and `rot` (degrees).
 */
export function parseBodyPrBooleanAttrs(bodyPr: XmlObject, textStyle: TextStyle): void {
	const parseBoolAttr = (attr: string): boolean | undefined => {
		const raw = bodyPr[attr];
		if (raw === undefined) {
			return undefined;
		}
		const val = String(raw).trim().toLowerCase();
		return val === '1' || val === 'true';
	};

	const compatLnSpc = parseBoolAttr('@_compatLnSpc');
	if (compatLnSpc !== undefined) {
		textStyle.compatibleLineSpacing = compatLnSpc;
	}

	const forceAA = parseBoolAttr('@_forceAA');
	if (forceAA !== undefined) {
		textStyle.forceAntiAlias = forceAA;
	}

	const upright = parseBoolAttr('@_upright');
	if (upright !== undefined) {
		textStyle.upright = upright;
	}

	const fromWordArt = parseBoolAttr('@_fromWordArt');
	if (fromWordArt !== undefined) {
		textStyle.fromWordArt = fromWordArt;
	}

	const spcFirstLastPara = parseBoolAttr('@_spcFirstLastPara');
	if (spcFirstLastPara !== undefined) {
		textStyle.spaceFirstLastParagraph = spcFirstLastPara;
	}

	const anchorCtr = parseBoolAttr('@_anchorCtr');
	if (anchorCtr !== undefined) {
		textStyle.anchorCenter = anchorCtr;
	}

	const rtlCol = parseBoolAttr('@_rtlCol');
	if (rtlCol !== undefined) {
		textStyle.rtlColumns = rtlCol;
	}

	// Body rotation is stored as 60000ths of a degree per ECMA-376.
	const rotRaw = bodyPr['@_rot'];
	if (rotRaw !== undefined) {
		const rotEmu = Number.parseInt(String(rotRaw), 10);
		if (Number.isFinite(rotEmu)) {
			textStyle.textBodyRotation = rotEmu / 60000;
		}
	}
}

/**
 * Write body property boolean attributes to bodyPr XML object.
 *
 * Mirrors {@link parseBodyPrBooleanAttrs} — only emits attributes that the
 * caller explicitly authored. `rtlCol` is intentionally not defaulted here
 * so callers can preserve the loaded value when the model is undefined.
 */
export function writeBodyPrBooleanAttrs(bodyPr: XmlObject, textStyle: TextStyle | undefined): void {
	if (!textStyle) {
		return;
	}
	if (textStyle.compatibleLineSpacing !== undefined) {
		bodyPr['@_compatLnSpc'] = textStyle.compatibleLineSpacing ? '1' : '0';
	}
	if (textStyle.forceAntiAlias !== undefined) {
		bodyPr['@_forceAA'] = textStyle.forceAntiAlias ? '1' : '0';
	}
	if (textStyle.upright !== undefined) {
		bodyPr['@_upright'] = textStyle.upright ? '1' : '0';
	}
	if (textStyle.fromWordArt !== undefined) {
		bodyPr['@_fromWordArt'] = textStyle.fromWordArt ? '1' : '0';
	}
	if (textStyle.spaceFirstLastParagraph !== undefined) {
		bodyPr['@_spcFirstLastPara'] = textStyle.spaceFirstLastParagraph ? '1' : '0';
	}
	if (textStyle.anchorCenter !== undefined) {
		bodyPr['@_anchorCtr'] = textStyle.anchorCenter ? '1' : '0';
	}
	if (textStyle.rtlColumns !== undefined) {
		bodyPr['@_rtlCol'] = textStyle.rtlColumns ? '1' : '0';
	}
	if (textStyle.textBodyRotation !== undefined && Number.isFinite(textStyle.textBodyRotation)) {
		bodyPr['@_rot'] = String(Math.round(textStyle.textBodyRotation * 60000));
	}
}
