import type { PptxColorAnimation, PptxNativeAnimation } from '../types';

const HEX_COLOR = /^#?[0-9a-f]{6}$/iu;

function resolveToken(
	value: string | undefined,
	resolveThemeColor: (token: string) => string | undefined,
): string | undefined {
	if (!value || HEX_COLOR.test(value)) {
		return value;
	}
	return resolveThemeColor(value) ?? value;
}

function resolveColorAnimation(
	animation: PptxColorAnimation,
	resolveThemeColor: (token: string) => string | undefined,
): PptxColorAnimation {
	return {
		...animation,
		fromColor: resolveToken(animation.fromColor, resolveThemeColor),
		toColor: resolveToken(animation.toColor, resolveThemeColor),
		byColor: resolveToken(animation.byColor, resolveThemeColor),
		components: animation.components?.map((component) =>
			resolveColorAnimation(component, resolveThemeColor),
		),
	};
}

/** Resolve scheme tokens such as `bg1` while the slide's live theme is active. */
export function resolveNativeAnimationThemeColors(
	animations: readonly PptxNativeAnimation[],
	resolveThemeColor: (token: string) => string | undefined,
): PptxNativeAnimation[] {
	return animations.map((animation) =>
		animation.colorAnimation
			? {
					...animation,
					colorAnimation: resolveColorAnimation(animation.colorAnimation, resolveThemeColor),
				}
			: animation,
	);
}
