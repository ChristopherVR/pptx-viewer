/**
 * Compose authored motion, rotation, and scale behaviours into one CSS
 * keyframe block. OOXML permits those behaviours to share one effect wrapper,
 * while CSS animations that each write `transform` would overwrite each other.
 *
 * @module render/animation-transform-keyframes
 */

import type { PptxNativeAnimation } from 'pptx-viewer-core';

import { createAttributeTransformModel } from './animation-attribute-transform';
import { parseMotionPathPoints } from './animation-motion-path';

export interface TransformKeyframePrefixes {
	motion: string;
	rotationAbsolute: string;
	rotationRelative: string;
	scaleAbsolute: string;
	scaleRelative: string;
	transform: string;
}

function slideOffset(percent: number, axis: 'w' | 'h'): string {
	const fallback = axis === 'w' ? '1280px' : '720px';
	return `calc(var(--pptx-slide-${axis}, ${fallback}) * ${(percent / 100).toFixed(4)})`;
}

function hasRotation(anim: PptxNativeAnimation): boolean {
	return (
		anim.rotationBy !== undefined ||
		anim.rotationFrom !== undefined ||
		anim.rotationTo !== undefined
	);
}

function hasScale(anim: PptxNativeAnimation): boolean {
	return (
		anim.scaleByX !== undefined ||
		anim.scaleByY !== undefined ||
		anim.scaleFromX !== undefined ||
		anim.scaleFromY !== undefined ||
		anim.scaleToX !== undefined ||
		anim.scaleToY !== undefined
	);
}

/** True when the parsed animation contains an authored transform behaviour. */
export function hasAuthoredTransform(anim: PptxNativeAnimation): boolean {
	return (
		Boolean(anim.motionPath) ||
		hasRotation(anim) ||
		hasScale(anim) ||
		createAttributeTransformModel(anim) !== undefined
	);
}

function rotationAt(anim: PptxNativeAnimation, progress: number): number {
	const from = anim.rotationFrom ?? 0;
	const to = anim.rotationTo ?? (anim.rotationBy !== undefined ? from + anim.rotationBy : from);
	return from + (to - from) * progress;
}

function scaleAt(anim: PptxNativeAnimation, axis: 'x' | 'y', progress: number): number {
	const from = axis === 'x' ? (anim.scaleFromX ?? 1) : (anim.scaleFromY ?? 1);
	const authoredTo = axis === 'x' ? anim.scaleToX : anim.scaleToY;
	const by = axis === 'x' ? anim.scaleByX : anim.scaleByY;
	const to = authoredTo ?? (by !== undefined ? from * by : from);
	return from + (to - from) * progress;
}

function opacityAt(anim: PptxNativeAnimation, progress: number): number | undefined {
	if (anim.presetClass === 'entr') {
		return progress;
	}
	if (anim.presetClass === 'exit') {
		return 1 - progress;
	}
	return undefined;
}

function formatNumber(value: number, fractionDigits: number = 4): string {
	return String(Number(value.toFixed(fractionDigits)));
}

function tangentAngle(points: ReadonlyArray<{ x: number; y: number }>, index: number): number {
	const point = points[index];
	const next = index < points.length - 1 ? points[index + 1] : point;
	const previous = index > 0 ? points[index - 1] : point;
	const dx = index < points.length - 1 ? next.x - point.x : point.x - previous.x;
	const dy = index < points.length - 1 ? next.y - point.y : point.y - previous.y;
	return Math.atan2(dy, dx) * (180 / Math.PI);
}

function pointAt(
	points: ReadonlyArray<{ x: number; y: number }>,
	progress: number,
): { x: number; y: number } {
	if (points.length < 2) {
		return { x: 0, y: 0 };
	}
	const position = progress * (points.length - 1);
	const leftIndex = Math.floor(position);
	const rightIndex = Math.min(points.length - 1, leftIndex + 1);
	const ratio = position - leftIndex;
	const left = points[leftIndex];
	const right = points[rightIndex];
	return {
		x: left.x + (right.x - left.x) * ratio,
		y: left.y + (right.y - left.y) * ratio,
	};
}

function keyframeName(
	anim: PptxNativeAnimation,
	prefixes: TransformKeyframePrefixes,
	uid: number,
	hasAttributeAnimation: boolean,
): string {
	const motion = Boolean(anim.motionPath);
	const rotation = hasRotation(anim);
	const scale = hasScale(anim);
	if (hasAttributeAnimation || Number(motion) + Number(rotation) + Number(scale) > 1) {
		return `${prefixes.transform}-${uid}`;
	}
	if (motion) {
		return `${prefixes.motion}-${uid}`;
	}
	if (rotation) {
		return `${anim.rotationBy === undefined ? prefixes.rotationAbsolute : prefixes.rotationRelative}-${uid}`;
	}
	return `${anim.scaleByX === undefined && anim.scaleByY === undefined ? prefixes.scaleAbsolute : prefixes.scaleRelative}-${uid}`;
}

/**
 * Build one keyframe block so simultaneous transform behaviours remain
 * simultaneous instead of competing for the CSS `transform` property.
 */
export function buildTransformKeyframes(
	anim: PptxNativeAnimation,
	uid: number,
	prefixes: TransformKeyframePrefixes,
): { keyframeName: string; css: string } | undefined {
	const rotation = hasRotation(anim);
	const scale = hasScale(anim);
	const attributeModel = createAttributeTransformModel(anim);
	const parsedPoints = anim.motionPath ? parseMotionPathPoints(anim.motionPath) : [];
	const points = parsedPoints.length >= 2 ? parsedPoints : [];
	if (points.length === 0 && !rotation && !scale && !attributeModel) {
		return undefined;
	}

	const progressSet = new Set<number>(attributeModel?.progresses ?? [0, 1]);
	for (let index = 0; index < points.length; index += 1) {
		progressSet.add(index / (points.length - 1));
	}
	const progresses = [...progressSet].sort((left, right) => left - right);
	const lines = progresses.map((progress) => {
		const point = pointAt(points, progress);
		const attributeState = attributeModel?.stateAt(progress);
		const declarations: string[] = [];
		const opacity = attributeState?.opacity ?? opacityAt(anim, progress);
		if (opacity !== undefined) {
			declarations.push(`opacity: ${formatNumber(opacity)};`);
		}

		const transforms: string[] = [];
		if (points.length > 0) {
			transforms.push(`translate(${slideOffset(point.x, 'w')}, ${slideOffset(point.y, 'h')})`);
		}
		if (attributeState?.translateX !== undefined || attributeState?.translateY !== undefined) {
			transforms.push(
				`translate(${slideOffset(attributeState.translateX ?? 0, 'w')}, ${slideOffset(attributeState.translateY ?? 0, 'h')})`,
			);
		}
		if (
			rotation ||
			(points.length > 0 && anim.motionPathRotateAuto) ||
			attributeState?.rotation !== undefined
		) {
			const pointIndex = Math.round(progress * Math.max(0, points.length - 1));
			const pathRotation = anim.motionPathRotateAuto ? tangentAngle(points, pointIndex) : 0;
			const angle = pathRotation + (attributeState?.rotation ?? rotationAt(anim, progress));
			transforms.push(
				`rotate(${anim.motionPathRotateAuto ? angle.toFixed(2) : formatNumber(angle, 2)}deg)`,
			);
		}
		if (scale || attributeState?.scaleX !== undefined || attributeState?.scaleY !== undefined) {
			transforms.push(
				`scale(${formatNumber(attributeState?.scaleX ?? scaleAt(anim, 'x', progress))}, ${formatNumber(attributeState?.scaleY ?? scaleAt(anim, 'y', progress))})`,
			);
		}
		if (transforms.length > 0) {
			declarations.push(`transform: ${transforms.join(' ')};`);
		}
		return `\t${formatNumber(progress * 100, 2)}% { ${declarations.join(' ')} }`;
	});

	const name = keyframeName(anim, prefixes, uid, attributeModel !== undefined);
	return { keyframeName: name, css: `@keyframes ${name} {\n${lines.join('\n')}\n}` };
}
