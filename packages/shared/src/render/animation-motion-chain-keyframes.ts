import type { ChainedMotionAnimation } from './animation-motion-path-chain';
import { pacedFractions, pacedPointAt } from './animation-motion-path-paced';
import type { AnimationElementBox } from './animation-render-context';
import { formatNumber, slideOffset } from './animation-transform-keyframes';
import type { TransformKeyframePrefixes } from './animation-transform-keyframes';

/**
 * Build one `@keyframes` block covering a whole chained journey. Waypoints
 * land at their authored TIME positions: each segment keeps its own duration
 * and accel/decel easing, and a gap between segments holds the last reached
 * position via duplicated keyframes. Duplicate progress values (segment
 * joints whose endpoints disagree slightly) resolve by last-wins, matching
 * CSS's own duplicate-keyframe rule.
 */
export function buildChainedMotionKeyframes(
	anim: ChainedMotionAnimation,
	uid: number,
	prefixes: TransformKeyframePrefixes,
	box?: AnimationElementBox,
): { keyframeName: string; css: string } | undefined {
	const chain = anim.motionChain;
	if (!chain || chain.length < 2) {
		return undefined;
	}
	const totalMs = anim.durationMs ?? chain.reduce((sum, segment) => sum + segment.durationMs, 0);
	if (totalMs <= 0) {
		return undefined;
	}

	type Keyframe = { progress: number; transform: string; easing?: string };
	const keyframes: Keyframe[] = [];

	for (const segment of chain) {
		const fractions = pacedFractions(segment.points, box?.slideAspect);
		const segStartPct = (segment.startMs / totalMs) * 100;
		const segSpanPct = (segment.durationMs / totalMs) * 100;

		for (let j = 0; j < segment.points.length; j++) {
			const fraction = fractions[j];
			const point = pacedPointAt(segment.points, fractions, fraction);
			const progress = Number((segStartPct + fraction * segSpanPct).toFixed(4));
			const transform = `transform: translate(${slideOffset(point.x, 'w', anim.motionOrigin)}, ${slideOffset(point.y, 'h', anim.motionOrigin)})`;
			const easing = j === 0 ? segment.easing : undefined;

			const previous = keyframes[keyframes.length - 1];
			if (previous && previous.progress === progress) {
				// Duplicate progress (joint or gap-hold boundary): CSS resolves by
				// last-wins, so the newer transform and easing take over.
				previous.transform = transform;
				previous.easing = easing ?? previous.easing;
				continue;
			}
			keyframes.push({ progress, transform, easing });
		}
	}

	// An authored exit parked this element out of sight before the journey:
	// the 0% frame keeps it invisible through the delay phase (fill:both
	// applies the 0% frame during animation-delay), and the next keyframe pops
	// it back exactly as the first segment begins.
	const hideUntilStart = (anim as ChainedMotionAnimation).motionChainHideUntilStart === true;
	if (hideUntilStart && keyframes.length > 0) {
		keyframes.splice(1, 0, { ...keyframes[0], progress: 0.01 });
	}
	const lines = keyframes.map((keyframe, index) => {
		const easing = keyframe.easing ? `animation-timing-function: ${keyframe.easing}; ` : '';
		const opacity =
			hideUntilStart && index === 0
				? 'opacity: 0; '
				: hideUntilStart && index === 1
					? 'opacity: 1; '
					: '';
		return `\t${formatNumber(keyframe.progress, 2)}% { ${easing}${opacity}${keyframe.transform}; }`;
	});

	const name = `${prefixes.transform}-${uid}${hideUntilStart ? '-visibility' : ''}`;
	return {
		keyframeName: name,
		css: `@keyframes ${name} {\n${lines.join('\n')}\n}`,
	};
}
