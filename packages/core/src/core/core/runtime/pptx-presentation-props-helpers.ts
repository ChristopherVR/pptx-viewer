import { XmlObject } from '../../types';
import type { PptxPresentationProperties } from '../../types';

function parseXmlBoolean(value: unknown, defaultValue: boolean): boolean {
	if (value === true || value === 1) {
		return true;
	}
	if (value === false || value === 0) {
		return false;
	}
	const lexical = String(value ?? '')
		.trim()
		.toLowerCase();
	if (lexical === 'true' || lexical === '1') {
		return true;
	}
	if (lexical === 'false' || lexical === '0') {
		return false;
	}
	return defaultValue;
}

/**
 * Parse show properties (p:showPr) from presentation properties XML.
 * Returns partial presentation properties with show-related settings.
 */
export function parseShowProperties(showPr: XmlObject): Partial<PptxPresentationProperties> {
	const props: Partial<PptxPresentationProperties> = {};

	// Show type
	if (showPr['p:present']) {
		props.showType = 'presented';
	} else if (showPr['p:browse']) {
		props.showType = 'browsed';
	} else if (showPr['p:kiosk']) {
		props.showType = 'kiosk';
		// Parse kiosk restart interval (in ms)
		const kioskNode = showPr['p:kiosk'] as XmlObject;
		const restartRaw = kioskNode?.['@_restart'];
		if (restartRaw !== undefined) {
			const restartMs = Number.parseInt(String(restartRaw), 10);
			if (Number.isFinite(restartMs) && restartMs > 0) {
				props.kioskRestartTime = restartMs;
			}
		}
	}

	props.loopContinuously = parseXmlBoolean(showPr['@_loop'], false);
	props.showWithNarration = parseXmlBoolean(showPr['@_showNarration'], true);
	props.showWithAnimation = parseXmlBoolean(showPr['@_showAnimation'], true);

	// Advance mode
	if (!parseXmlBoolean(showPr['@_useTimings'], true)) {
		props.advanceMode = 'manual';
	} else {
		props.advanceMode = 'useTimings';
	}

	// Pen colour
	const penClr = showPr['p:penClr'] as XmlObject | undefined;
	if (penClr) {
		const srgbClr = penClr['a:srgbClr'] as XmlObject | undefined;
		if (srgbClr) {
			const val = String(srgbClr['@_val'] || '').trim();
			if (val.length > 0) {
				props.penColor = `#${val}`;
			}
		}
	}

	// Show slides range / custom show
	const sldRg = showPr['p:sldRg'] as XmlObject | undefined;
	const custShow = showPr['p:custShow'] as XmlObject | undefined;
	if (sldRg) {
		props.showSlidesMode = 'range';
		const st = Number.parseInt(String(sldRg['@_st'] ?? '1'), 10);
		const end = Number.parseInt(String(sldRg['@_end'] ?? '1'), 10);
		if (Number.isFinite(st)) {
			props.showSlidesFrom = st;
		}
		if (Number.isFinite(end)) {
			props.showSlidesTo = end;
		}
	} else if (custShow) {
		props.showSlidesMode = 'customShow';
		const csId = String(custShow['@_id'] ?? '').trim();
		if (csId.length > 0) {
			props.showSlidesCustomShowId = csId;
		}
	} else {
		props.showSlidesMode = 'all';
	}

	return props;
}
