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
import type { AnimationElementBox } from './animation-render-context';

export interface TransformKeyframePrefixes {
	motion: string;
	rotationAbsolute: string;
	rotationRelative: string;
	scaleAbsolute: string;
	scaleRelative: string;
	transform: string;
}

/**
 * `p:animMotion/@_origin` (ST_TLAnimateMotionBehaviorOrigin, ECMA-376
 * S19.5.7): `layout` (the default) scales the path's percentage coordinates
 * against the SLIDE; `parent` scales them against the immediate PARENT
 * GROUP's box when the animated shape sits inside a group. A binding that
 * renders a grouped shape sets `--pptx-parent-w`/`--pptx-parent-h` (in px) on
 * that shape (or an ancestor it inherits from) to the group's own rendered
 * size; until a binding sets it, this falls back to the same default canvas
 * size `--pptx-slide-w`/`-h` uses, matching this module's existing
 * unset-custom-property behaviour rather than silently using the wrong box.
 */
function slideOffset(percent: number, axis: 'w' | 'h', origin: string | undefined): string {
	const fallback = axis === 'w' ? '1280px' : '720px';
	const varName = origin === 'parent' ? `--pptx-parent-${axis}` : `--pptx-slide-${axis}`;
	return `calc(var(${varName}, ${fallback}) * ${(percent / 100).toFixed(4)})`;
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

/**
 * True when the parsed animation contains an authored transform behaviour.
 * `box` is the animated shape's real rendered geometry (slide-fraction
 * units), when the caller has it; see `animation-render-context.ts`.
 */
export function hasAuthoredTransform(
	anim: PptxNativeAnimation,
	box?: AnimationElementBox,
): boolean {
	return (
		Boolean(anim.motionPath) ||
		hasRotation(anim) ||
		hasScale(anim) ||
		createAttributeTransformModel(anim, box) !== undefined
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

function rotateMotionPathPoints(
	points: ReadonlyArray<{ x: number; y: number }>,
	anim: PptxNativeAnimation,
): Array<{ x: number; y: number }> {
	const angle = anim.motionPathRotationAngle ?? 0;
	if (!Number.isFinite(angle) || angle === 0) {
		return [...points];
	}
	const radians = (angle * Math.PI) / 180;
	const cosine = Math.cos(radians);
	const sine = Math.sin(radians);
	const centerX = anim.motionPathRotationCenterX ?? 0;
	const centerY = anim.motionPathRotationCenterY ?? 0;
	return points.map((point) => {
		const x = point.x - centerX;
		const y = point.y - centerY;
		return {
			x: centerX + x * cosine - y * sine,
			y: centerY + x * sine + y * cosine,
		};
	});
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
 * simultaneous instead of competing for the CSS `transform` property. `box`
 * is the animated shape's real rendered geometry (slide-fraction units),
 * when the caller has it; see `animation-render-context.ts`.
 */
export function buildTransformKeyframes(
	anim: PptxNativeAnimation,
	uid: number,
	prefixes: TransformKeyframePrefixes,
	box?: AnimationElementBox,
): { keyframeName: string; css: string } | undefined {
	const rotation = hasRotation(anim);
	const scale = hasScale(anim);
	const attributeModel = createAttributeTransformModel(anim, box);
	const parsedPoints = anim.motionPath
		? rotateMotionPathPoints(parseMotionPathPoints(anim.motionPath), anim)
		: [];
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
			transforms.push(
				`translate(${slideOffset(point.x, 'w', anim.motionOrigin)}, ${slideOffset(point.y, 'h', anim.motionOrigin)})`,
			);
		}
		if (attributeState?.translateX !== undefined || attributeState?.translateY !== undefined) {
			// `p:animMotion/@_origin` only governs a MOTION PATH's coordinates
			// (ECMA-376 S19.5.7); a generic `ppt_x`/`ppt_y` attribute ramp has no
			// such attribute, so it keeps resolving against the slide.
			transforms.push(
				`translate(${slideOffset(attributeState.translateX ?? 0, 'w', undefined)}, ${slideOffset(attributeState.translateY ?? 0, 'h', undefined)})`,
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
