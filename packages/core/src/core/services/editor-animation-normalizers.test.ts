import { describe, it, expect } from "vitest";
import {
	normalizeAnimationPreset,
	normalizeTrigger,
	normalizeTimingCurve,
	normalizeRepeatMode,
	normalizeDirection,
	normalizeSequence,
	normalizeAfterAnimation,
} from "./editor-animation-normalizers";

describe("normalizeAnimationPreset", () => {
	it("returns undefined for empty string", () => {
		expect(normalizeAnimationPreset("")).toBeUndefined();
	});

	it("returns undefined for null", () => {
		expect(normalizeAnimationPreset(null)).toBeUndefined();
	});

	it("returns undefined for undefined", () => {
		expect(normalizeAnimationPreset(undefined)).toBeUndefined();
	});

	it("returns undefined for unrecognized preset", () => {
		expect(normalizeAnimationPreset("somethingInvalid")).toBeUndefined();
	});

	it("normalizes 'fadein' (lowercase) to 'fadeIn'", () => {
		expect(normalizeAnimationPreset("fadein")).toBe("fadeIn");
	});

	it("normalizes 'FADEIN' (uppercase) to 'fadeIn'", () => {
		expect(normalizeAnimationPreset("FADEIN")).toBe("fadeIn");
	});

	it("normalizes 'FadeIn' (mixed case) to 'fadeIn'", () => {
		expect(normalizeAnimationPreset("FadeIn")).toBe("fadeIn");
	});

	it("trims whitespace around the value", () => {
		expect(normalizeAnimationPreset("  fadeIn  ")).toBe("fadeIn");
	});

	it("recognizes entrance presets", () => {
		expect(normalizeAnimationPreset("appear")).toBe("appear");
		expect(normalizeAnimationPreset("flyin")).toBe("flyIn");
		expect(normalizeAnimationPreset("zoomin")).toBe("zoomIn");
		expect(normalizeAnimationPreset("blindsin")).toBe("blindsIn");
		expect(normalizeAnimationPreset("bouncein")).toBe("bounceIn");
	});

	it("recognizes exit presets", () => {
		expect(normalizeAnimationPreset("fadeout")).toBe("fadeOut");
		expect(normalizeAnimationPreset("flyout")).toBe("flyOut");
		expect(normalizeAnimationPreset("zoomout")).toBe("zoomOut");
		expect(normalizeAnimationPreset("disappear")).toBe("disappear");
		expect(normalizeAnimationPreset("bounceout")).toBe("bounceOut");
	});

	it("recognizes emphasis presets", () => {
		expect(normalizeAnimationPreset("spin")).toBe("spin");
		expect(normalizeAnimationPreset("pulse")).toBe("pulse");
		expect(normalizeAnimationPreset("growshrink")).toBe("growShrink");
		expect(normalizeAnimationPreset("teeter")).toBe("teeter");
		expect(normalizeAnimationPreset("boldflash")).toBe("boldFlash");
	});

	it("recognizes 'none'", () => {
		expect(normalizeAnimationPreset("none")).toBe("none");
	});
});

describe("normalizeTrigger", () => {
	it("returns undefined for empty string", () => {
		expect(normalizeTrigger("")).toBeUndefined();
	});

	it("returns undefined for null", () => {
		expect(normalizeTrigger(null)).toBeUndefined();
	});

	it("returns undefined for unrecognized value", () => {
		expect(normalizeTrigger("invalid")).toBeUndefined();
	});

	it("normalizes onClick", () => {
		expect(normalizeTrigger("onClick")).toBe("onClick");
	});

	it("normalizes afterPrevious", () => {
		expect(normalizeTrigger("afterPrevious")).toBe("afterPrevious");
	});

	it("normalizes withPrevious", () => {
		expect(normalizeTrigger("withPrevious")).toBe("withPrevious");
	});

	it("normalizes onHover", () => {
		expect(normalizeTrigger("onHover")).toBe("onHover");
	});

	it("normalizes afterDelay", () => {
		expect(normalizeTrigger("afterDelay")).toBe("afterDelay");
	});

	it("trims whitespace", () => {
		expect(normalizeTrigger("  onClick  ")).toBe("onClick");
	});
});

describe("normalizeTimingCurve", () => {
	it("returns undefined for empty string", () => {
		expect(normalizeTimingCurve("")).toBeUndefined();
	});

	it("returns undefined for null", () => {
		expect(normalizeTimingCurve(null)).toBeUndefined();
	});

	it("returns undefined for invalid curve", () => {
		expect(normalizeTimingCurve("bouncy")).toBeUndefined();
	});

	it("normalizes 'ease'", () => {
		expect(normalizeTimingCurve("ease")).toBe("ease");
	});

	it("normalizes 'ease-in'", () => {
		expect(normalizeTimingCurve("ease-in")).toBe("ease-in");
	});

	it("normalizes 'ease-out'", () => {
		expect(normalizeTimingCurve("ease-out")).toBe("ease-out");
	});

	it("normalizes 'linear'", () => {
		expect(normalizeTimingCurve("linear")).toBe("linear");
	});

	it("trims whitespace", () => {
		expect(normalizeTimingCurve("  linear  ")).toBe("linear");
	});
});

describe("normalizeRepeatMode", () => {
	it("returns undefined for empty string", () => {
		expect(normalizeRepeatMode("")).toBeUndefined();
	});

	it("returns undefined for null", () => {
		expect(normalizeRepeatMode(null)).toBeUndefined();
	});

	it("returns undefined for invalid mode", () => {
		expect(normalizeRepeatMode("forever")).toBeUndefined();
	});

	it("normalizes 'untilNextClick'", () => {
		expect(normalizeRepeatMode("untilNextClick")).toBe("untilNextClick");
	});

	it("normalizes 'untilEndOfSlide'", () => {
		expect(normalizeRepeatMode("untilEndOfSlide")).toBe("untilEndOfSlide");
	});

	it("trims whitespace", () => {
		expect(normalizeRepeatMode("  untilNextClick  ")).toBe("untilNextClick");
	});
});

describe("normalizeDirection", () => {
	it("returns undefined for empty string", () => {
		expect(normalizeDirection("")).toBeUndefined();
	});

	it("returns undefined for null", () => {
		expect(normalizeDirection(null)).toBeUndefined();
	});

	it("returns undefined for invalid direction", () => {
		expect(normalizeDirection("diagonal")).toBeUndefined();
	});

	it("normalizes all eight directions", () => {
		expect(normalizeDirection("fromLeft")).toBe("fromLeft");
		expect(normalizeDirection("fromRight")).toBe("fromRight");
		expect(normalizeDirection("fromTop")).toBe("fromTop");
		expect(normalizeDirection("fromBottom")).toBe("fromBottom");
		expect(normalizeDirection("fromTopLeft")).toBe("fromTopLeft");
		expect(normalizeDirection("fromTopRight")).toBe("fromTopRight");
		expect(normalizeDirection("fromBottomLeft")).toBe("fromBottomLeft");
		expect(normalizeDirection("fromBottomRight")).toBe("fromBottomRight");
	});

	it("trims whitespace", () => {
		expect(normalizeDirection("  fromLeft  ")).toBe("fromLeft");
	});
});

describe("normalizeSequence", () => {
	it("returns undefined for empty string", () => {
		expect(normalizeSequence("")).toBeUndefined();
	});

	it("returns undefined for null", () => {
		expect(normalizeSequence(null)).toBeUndefined();
	});

	it("returns undefined for invalid sequence", () => {
		expect(normalizeSequence("bySentence")).toBeUndefined();
	});

	it("normalizes 'asOne'", () => {
		expect(normalizeSequence("asOne")).toBe("asOne");
	});

	it("normalizes 'byParagraph'", () => {
		expect(normalizeSequence("byParagraph")).toBe("byParagraph");
	});

	it("normalizes 'byWord'", () => {
		expect(normalizeSequence("byWord")).toBe("byWord");
	});

	it("normalizes 'byLetter'", () => {
		expect(normalizeSequence("byLetter")).toBe("byLetter");
	});

	it("trims whitespace", () => {
		expect(normalizeSequence("  byParagraph  ")).toBe("byParagraph");
	});
});

describe("normalizeAfterAnimation", () => {
	it("returns undefined for empty string", () => {
		expect(normalizeAfterAnimation("")).toBeUndefined();
	});

	it("returns undefined for null", () => {
		expect(normalizeAfterAnimation(null)).toBeUndefined();
	});

	it("returns undefined for invalid action", () => {
		expect(normalizeAfterAnimation("explode")).toBeUndefined();
	});

	it("normalizes 'none'", () => {
		expect(normalizeAfterAnimation("none")).toBe("none");
	});

	it("normalizes 'hideOnNextClick'", () => {
		expect(normalizeAfterAnimation("hideOnNextClick")).toBe("hideOnNextClick");
	});

	it("normalizes 'hideAfterAnimation'", () => {
		expect(normalizeAfterAnimation("hideAfterAnimation")).toBe(
			"hideAfterAnimation",
		);
	});

	it("normalizes 'dimToColor'", () => {
		expect(normalizeAfterAnimation("dimToColor")).toBe("dimToColor");
	});

	it("trims whitespace", () => {
		expect(normalizeAfterAnimation("  dimToColor  ")).toBe("dimToColor");
	});
});
