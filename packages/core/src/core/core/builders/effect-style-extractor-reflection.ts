import type { ShapeStyle, XmlObject } from '../../types';

const VALID_ALIGNMENTS = new Set(['tl', 't', 'tr', 'l', 'ctr', 'r', 'bl', 'b', 'br']);

function integer(value: unknown): number | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	const parsed = Number.parseInt(String(value), 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function boolean(value: unknown): boolean | undefined {
	if (value === true || value === '1' || value === 'true') {
		return true;
	}
	if (value === false || value === '0' || value === 'false') {
		return false;
	}
	return undefined;
}

function fixedFraction(value: unknown): number | undefined {
	const parsed = integer(value);
	return parsed !== undefined && parsed >= 0 && parsed <= 100000 ? parsed / 100000 : undefined;
}

export function extractReflectionAttributes(
	node: XmlObject,
	emuPerPx: number,
): Partial<ShapeStyle> {
	const blur = integer(node['@_blurRad']);
	const distance = integer(node['@_dist']);
	const startOpacity = integer(node['@_stA']);
	const endOpacity = integer(node['@_endA']);
	const startPosition = integer(node['@_stPos']);
	const endPosition = integer(node['@_endPos']);
	const direction = integer(node['@_dir']);
	const rotation = integer(node['@_rot']);
	const fadeDirection = integer(node['@_fadeDir']);
	const alignment = String(node['@_algn'] ?? '').trim();
	return {
		reflectionBlurRadius: blur !== undefined && blur >= 0 ? blur / emuPerPx : undefined,
		reflectionStartOpacity: fixedFraction(startOpacity),
		reflectionEndOpacity: fixedFraction(endOpacity),
		reflectionStartPosition: fixedFraction(startPosition),
		reflectionEndPosition: fixedFraction(endPosition),
		reflectionDirection: direction !== undefined ? direction / 60000 : undefined,
		reflectionRotation: rotation !== undefined ? rotation / 60000 : undefined,
		reflectionDistance: distance !== undefined && distance >= 0 ? distance / emuPerPx : undefined,
		reflectionFadeDirection: fadeDirection !== undefined ? fadeDirection / 60000 : undefined,
		reflectionScaleX: integer(node['@_sx']),
		reflectionScaleY: integer(node['@_sy']),
		reflectionSkewX: integer(node['@_kx']),
		reflectionSkewY: integer(node['@_ky']),
		reflectionAlignment: VALID_ALIGNMENTS.has(alignment)
			? (alignment as ShapeStyle['reflectionAlignment'])
			: undefined,
		reflectionRotateWithShape: boolean(node['@_rotWithShape']),
	};
}
