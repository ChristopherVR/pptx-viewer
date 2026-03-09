import { describe, it, expect } from "vitest";
import type { PptxElement, TextSegment, TextStyle } from "pptx-viewer-core";
import {
	getTextCompensationTransform,
	getTextWarpStyle,
	getTextLayoutStyle,
} from "../../utils";
import { getTextStyleForElement } from "../../utils/text-utils";
import { DEFAULT_TEXT_COLOR } from "../../constants";

// ── Helpers ──────────────────────────────────────────────────────────────

/** Build a minimal shape PptxElement with text properties. */
function makeTextElement(overrides: Partial<{
	id: string;
	type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	text: string;
	textStyle: TextStyle;
	textSegments: TextSegment[];
	paragraphIndents: Array<{ marginLeft?: number; indent?: number }>;
	flipHorizontal: boolean;
	flipVertical: boolean;
	rotation: number;
	promptText: string;
	linkedTxbxId: string;
	locks: Record<string, boolean>;
}> = {}): PptxElement {
	return {
		id: overrides.id ?? "el-1",
		type: overrides.type ?? "shape",
		x: overrides.x ?? 100,
		y: overrides.y ?? 100,
		width: overrides.width ?? 400,
		height: overrides.height ?? 200,
		text: overrides.text ?? "Hello World",
		textStyle: overrides.textStyle ?? {},
		textSegments: overrides.textSegments ?? [],
		paragraphIndents: overrides.paragraphIndents,
		flipHorizontal: overrides.flipHorizontal,
		flipVertical: overrides.flipVertical,
		rotation: overrides.rotation,
		promptText: overrides.promptText,
		linkedTxbxId: overrides.linkedTxbxId,
		locks: overrides.locks,
	} as unknown as PptxElement;
}

/**
 * Replicate the exact style chain the InlineTextEditor uses for its wrapper.
 * This mirrors the logic in InlineTextEditor.tsx so we can test it in isolation
 * without rendering the React component.
 */
function computeEditorWrapperStyle(
	element: PptxElement,
	textStyleRaw?: TextStyle,
): React.CSSProperties {
	const layoutStyle = getTextLayoutStyle(element);
	const textStyle = getTextStyleForElement(element, DEFAULT_TEXT_COLOR);
	const warpStyle = getTextWarpStyle(textStyleRaw);
	const compensationTransform = getTextCompensationTransform(element);
	const warpTransform = warpStyle?.transform;
	const mergedTransform = [compensationTransform, warpTransform]
		.filter(Boolean)
		.join(" ") || undefined;

	return {
		...layoutStyle,
		...textStyle,
		...warpStyle,
		transform: mergedTransform,
		transformOrigin: warpStyle?.transformOrigin || "center",
	};
}

/**
 * Replicate the exact style chain the view-mode text container uses.
 * From ElementBody.tsx lines 134-140.
 */
function computeViewModeStyle(
	element: PptxElement,
	textStyleRaw?: TextStyle,
): React.CSSProperties {
	const layoutStyle = getTextLayoutStyle(element);
	const textStyle = getTextStyleForElement(element, DEFAULT_TEXT_COLOR);
	const warpStyle = getTextWarpStyle(textStyleRaw);
	const compensationTransform = getTextCompensationTransform(element);

	return {
		...layoutStyle,
		...textStyle,
		...warpStyle,
		transform: compensationTransform,
		transformOrigin: "center",
	};
}

// ── View/Edit Style Parity Tests ─────────────────────────────────────────

describe("InlineTextEditor: view/edit style parity", () => {
	it("should produce matching padding for a basic text element", () => {
		const el = makeTextElement({
			textStyle: {
				bodyInsetTop: 10,
				bodyInsetBottom: 12,
				bodyInsetLeft: 8,
				bodyInsetRight: 8,
			},
		});
		const editStyle = computeEditorWrapperStyle(el, el.textStyle);
		const viewStyle = computeViewModeStyle(el, el.textStyle);

		expect(editStyle.paddingTop).toBe(viewStyle.paddingTop);
		expect(editStyle.paddingBottom).toBe(viewStyle.paddingBottom);
		expect(editStyle.paddingLeft).toBe(viewStyle.paddingLeft);
		expect(editStyle.paddingRight).toBe(viewStyle.paddingRight);
	});

	it("should preserve body inset left/right padding", () => {
		const el = makeTextElement({
			textStyle: {
				bodyInsetLeft: 15,
				bodyInsetRight: 20,
			},
		});
		const style = computeEditorWrapperStyle(el, el.textStyle);

		// bodyInsetLeft + paragraphMarginLeft (0) = 15
		expect(style.paddingLeft).toBe(15);
		// bodyInsetRight + paragraphMarginRight (0) = 20
		expect(style.paddingRight).toBe(20);
	});

	it("should include paragraph margin in left/right padding", () => {
		const el = makeTextElement({
			textStyle: {
				bodyInsetLeft: 10,
				bodyInsetRight: 10,
				paragraphMarginLeft: 5,
				paragraphMarginRight: 3,
			},
		});
		const style = computeEditorWrapperStyle(el, el.textStyle);

		expect(style.paddingLeft).toBe(15); // 10 + 5
		expect(style.paddingRight).toBe(13); // 10 + 3
	});

	it("should use default body insets when not specified", () => {
		const el = makeTextElement({ textStyle: {} });
		const style = computeEditorWrapperStyle(el, el.textStyle);

		// DEFAULT_BODY_INSET_LR_PX ≈ 9.6 (91440 / 9525)
		const defaultLR = 91440 / 9525;
		expect(style.paddingLeft).toBeCloseTo(defaultLR, 1);
		expect(style.paddingRight).toBeCloseTo(defaultLR, 1);
	});

	it("should match font properties between view and edit modes", () => {
		const el = makeTextElement({
			textStyle: {
				fontFamily: "Arial",
				fontSize: 18,
				bold: true,
				italic: true,
			},
		});
		const editStyle = computeEditorWrapperStyle(el, el.textStyle);
		const viewStyle = computeViewModeStyle(el, el.textStyle);

		expect(editStyle.fontFamily).toBe(viewStyle.fontFamily);
		expect(editStyle.fontSize).toBe(viewStyle.fontSize);
		expect(editStyle.fontWeight).toBe(viewStyle.fontWeight);
		expect(editStyle.fontStyle).toBe(viewStyle.fontStyle);
	});

	it("should match color between view and edit modes", () => {
		const el = makeTextElement({
			textStyle: { color: "#FF0000" },
		});
		const editStyle = computeEditorWrapperStyle(el, el.textStyle);
		const viewStyle = computeViewModeStyle(el, el.textStyle);

		expect(editStyle.color).toBe(viewStyle.color);
	});

	it("should match text alignment between view and edit modes", () => {
		for (const align of ["left", "center", "right", "justify"] as const) {
			const el = makeTextElement({ textStyle: { align } });
			const editStyle = computeEditorWrapperStyle(el, el.textStyle);
			const viewStyle = computeViewModeStyle(el, el.textStyle);
			expect(editStyle.textAlign).toBe(viewStyle.textAlign);
		}
	});

	it("should match RTL direction between view and edit modes", () => {
		const el = makeTextElement({ textStyle: { rtl: true } });
		const editStyle = computeEditorWrapperStyle(el, el.textStyle);
		const viewStyle = computeViewModeStyle(el, el.textStyle);

		expect(editStyle.direction).toBe(viewStyle.direction);
		expect(editStyle.direction).toBe("rtl");
		expect(editStyle.unicodeBidi).toBe(viewStyle.unicodeBidi);
	});

	it("should match line height between view and edit modes", () => {
		const el = makeTextElement({
			textStyle: { lineSpacing: 1.5 },
		});
		const editStyle = computeEditorWrapperStyle(el, el.textStyle);
		const viewStyle = computeViewModeStyle(el, el.textStyle);

		expect(editStyle.lineHeight).toBe(viewStyle.lineHeight);
	});

	it("should match exact point line height between modes", () => {
		const el = makeTextElement({
			textStyle: { lineSpacingExactPt: 18 },
		});
		const editStyle = computeEditorWrapperStyle(el, el.textStyle);
		const viewStyle = computeViewModeStyle(el, el.textStyle);

		expect(editStyle.lineHeight).toBe(viewStyle.lineHeight);
		expect(editStyle.lineHeight).toBe("18pt");
	});

	it("should match vertical alignment between view and edit modes", () => {
		for (const vAlign of ["top", "middle", "bottom"] as const) {
			const el = makeTextElement({ textStyle: { vAlign } });
			const editStyle = computeEditorWrapperStyle(el, el.textStyle);
			const viewStyle = computeViewModeStyle(el, el.textStyle);
			expect(editStyle.justifyContent).toBe(viewStyle.justifyContent);
		}
	});

	it("should match writing mode between view and edit modes", () => {
		const el = makeTextElement({
			textStyle: { textDirection: "vertical" },
		});
		const editStyle = computeEditorWrapperStyle(el, el.textStyle);
		const viewStyle = computeViewModeStyle(el, el.textStyle);

		expect(editStyle.writingMode).toBe(viewStyle.writingMode);
		expect(editStyle.writingMode).toBe("vertical-rl");
	});

	it("should match text decoration between view and edit modes", () => {
		const el = makeTextElement({
			textStyle: { underline: true, strikethrough: true },
		});
		const editStyle = computeEditorWrapperStyle(el, el.textStyle);
		const viewStyle = computeViewModeStyle(el, el.textStyle);

		expect(editStyle.textDecorationLine).toBe(viewStyle.textDecorationLine);
	});

	it("should match autofit font scaling between view and edit modes", () => {
		const el = makeTextElement({
			textStyle: {
				autoFit: true,
				autoFitMode: "normal",
				autoFitFontScale: 0.75,
				fontSize: 24,
			},
		});
		const editStyle = computeEditorWrapperStyle(el, el.textStyle);
		const viewStyle = computeViewModeStyle(el, el.textStyle);

		expect(editStyle.fontSize).toBe(viewStyle.fontSize);
		expect(editStyle.fontSize).toBe(18); // 24 * 0.75
	});

	it("should match autofit line spacing reduction between modes", () => {
		const el = makeTextElement({
			textStyle: {
				autoFit: true,
				autoFitMode: "normal",
				autoFitLineSpacingReduction: 0.2,
			},
		});
		const editStyle = computeEditorWrapperStyle(el, el.textStyle);
		const viewStyle = computeViewModeStyle(el, el.textStyle);

		expect(editStyle.lineHeight).toBe(viewStyle.lineHeight);
	});
});

// ── Text Warp Style Tests ────────────────────────────────────────────────

describe("InlineTextEditor: text warp style application", () => {
	it("should apply text warp transform in edit mode", () => {
		const textStyle: TextStyle = { textWarpPreset: "textArchUp" };
		const el = makeTextElement({ textStyle });
		const style = computeEditorWrapperStyle(el, textStyle);

		expect(style.transform).toContain("perspective(400px)");
		expect(style.transform).toContain("rotateX(-12deg)");
	});

	it("should not apply warp for textNoShape", () => {
		const textStyle: TextStyle = { textWarpPreset: "textNoShape" };
		const el = makeTextElement({ textStyle });
		const style = computeEditorWrapperStyle(el, textStyle);

		expect(style.transform).toBeUndefined();
	});

	it("should not apply warp for textPlain", () => {
		const textStyle: TextStyle = { textWarpPreset: "textPlain" };
		const el = makeTextElement({ textStyle });
		const style = computeEditorWrapperStyle(el, textStyle);

		expect(style.transform).toBeUndefined();
	});

	it("should not apply warp when textStyleRaw is undefined", () => {
		const el = makeTextElement();
		const style = computeEditorWrapperStyle(el, undefined);

		expect(style.transformOrigin).toBe("center");
	});

	it("should apply warp transformOrigin from warp preset", () => {
		const textStyle: TextStyle = { textWarpPreset: "textArchUp" };
		const el = makeTextElement({ textStyle });
		const style = computeEditorWrapperStyle(el, textStyle);

		expect(style.transformOrigin).toBe("center bottom");
	});

	it("should apply wave warp transforms", () => {
		const textStyle: TextStyle = { textWarpPreset: "textWave1" };
		const el = makeTextElement({ textStyle });
		const style = computeEditorWrapperStyle(el, textStyle);

		expect(style.transform).toContain("skewX(3deg)");
	});

	it("should apply inflate/deflate warp transforms", () => {
		const textStyle: TextStyle = { textWarpPreset: "textInflate" };
		const el = makeTextElement({ textStyle });
		const style = computeEditorWrapperStyle(el, textStyle);

		expect(style.transform).toContain("scaleY(1.15)");
		expect(style.transform).toContain("scaleX(1.05)");
	});

	it("should apply circle warp with borderRadius", () => {
		const textStyle: TextStyle = { textWarpPreset: "textCircle" };
		const warpStyle = getTextWarpStyle(textStyle);

		expect(warpStyle?.borderRadius).toBe("50%");
		expect(warpStyle?.transform).toContain("rotateX(-5deg)");
	});

	it("should apply slant transforms", () => {
		const textStyleUp: TextStyle = { textWarpPreset: "textSlantUp" };
		const textStyleDown: TextStyle = { textWarpPreset: "textSlantDown" };

		const warpUp = getTextWarpStyle(textStyleUp);
		const warpDown = getTextWarpStyle(textStyleDown);

		expect(warpUp?.transform).toContain("rotateY(8deg)");
		expect(warpUp?.transform).toContain("skewY(-4deg)");
		expect(warpDown?.transform).toContain("rotateY(-8deg)");
		expect(warpDown?.transform).toContain("skewY(4deg)");
	});

	it("should apply fade transforms in all directions", () => {
		const presets = [
			{ preset: "textFadeUp", expected: "rotateX(-10deg)" },
			{ preset: "textFadeDown", expected: "rotateX(10deg)" },
			{ preset: "textFadeLeft", expected: "rotateY(10deg)" },
			{ preset: "textFadeRight", expected: "rotateY(-10deg)" },
		] as const;

		for (const { preset, expected } of presets) {
			const warp = getTextWarpStyle({ textWarpPreset: preset } as TextStyle);
			expect(warp?.transform).toContain(expected);
		}
	});

	it("should apply cascade transforms", () => {
		const cascadeUp = getTextWarpStyle({ textWarpPreset: "textCascadeUp" } as TextStyle);
		const cascadeDown = getTextWarpStyle({ textWarpPreset: "textCascadeDown" } as TextStyle);

		expect(cascadeUp?.transform).toBe("skewY(-8deg)");
		expect(cascadeDown?.transform).toBe("skewY(8deg)");
	});

	it("should return undefined for unknown warp presets", () => {
		const warp = getTextWarpStyle({ textWarpPreset: "textUnknown" } as TextStyle);
		expect(warp).toBeUndefined();
	});
});

// ── Transform Merging Tests ──────────────────────────────────────────────

describe("InlineTextEditor: transform merging", () => {
	it("should merge compensation transform with warp transform", () => {
		const el = makeTextElement({
			flipHorizontal: true,
			textStyle: { textWarpPreset: "textArchUp" },
		});
		const style = computeEditorWrapperStyle(el, el.textStyle);

		// Should contain both scaleX(-1) from flip compensation and perspective from warp
		expect(style.transform).toContain("scaleX(-1)");
		expect(style.transform).toContain("perspective(400px)");
	});

	it("should use only compensation transform when no warp", () => {
		const el = makeTextElement({
			flipHorizontal: true,
			textStyle: {},
		});
		const style = computeEditorWrapperStyle(el, el.textStyle);

		expect(style.transform).toBe("scaleX(-1)");
	});

	it("should use only warp transform when no flip", () => {
		const textStyle: TextStyle = { textWarpPreset: "textArchDown" };
		const el = makeTextElement({ textStyle });
		const style = computeEditorWrapperStyle(el, textStyle);

		expect(style.transform).toBe("perspective(400px) rotateX(12deg)");
	});

	it("should be undefined when neither flip nor warp exists", () => {
		const el = makeTextElement({ textStyle: {} });
		const style = computeEditorWrapperStyle(el, el.textStyle);

		expect(style.transform).toBeUndefined();
	});

	it("should combine both flips with warp transform", () => {
		const textStyle: TextStyle = { textWarpPreset: "textInflate" };
		const el = makeTextElement({
			flipHorizontal: true,
			flipVertical: true,
			textStyle,
		});
		const style = computeEditorWrapperStyle(el, textStyle);

		expect(style.transform).toContain("scaleX(-1)");
		expect(style.transform).toContain("scaleY(-1)");
		expect(style.transform).toContain("scaleY(1.15)");
	});
});

// ── Padding Bug Regression Tests ─────────────────────────────────────────

describe("InlineTextEditor: padding regression (left/right body insets)", () => {
	it("should NOT lose left/right padding when editing", () => {
		const el = makeTextElement({
			textStyle: {
				bodyInsetLeft: 20,
				bodyInsetRight: 25,
				bodyInsetTop: 5,
				bodyInsetBottom: 5,
			},
		});
		const style = computeEditorWrapperStyle(el, el.textStyle);

		// The old bug caused paddingLeft/Right to become undefined because
		// layoutStyle (getTextLayoutStyle) doesn't set them, and they were
		// re-asserted from layoutStyle, overwriting textStyle's values.
		expect(style.paddingLeft).toBe(20);
		expect(style.paddingRight).toBe(25);
	});

	it("should preserve left/right padding with paragraph margins", () => {
		const el = makeTextElement({
			textStyle: {
				bodyInsetLeft: 10,
				bodyInsetRight: 10,
				paragraphMarginLeft: 15,
				paragraphMarginRight: 8,
			},
		});
		const style = computeEditorWrapperStyle(el, el.textStyle);

		expect(style.paddingLeft).toBe(25); // 10 + 15
		expect(style.paddingRight).toBe(18); // 10 + 8
	});

	it("should use default body insets (≈9.6px) when none specified", () => {
		const el = makeTextElement({ textStyle: {} });
		const style = computeEditorWrapperStyle(el, el.textStyle);

		const defaultLR = 91440 / 9525; // ≈ 9.6
		expect(style.paddingLeft).toBeCloseTo(defaultLR, 1);
		expect(style.paddingRight).toBeCloseTo(defaultLR, 1);
	});

	it("should have top/bottom padding from textStyle (not layoutStyle)", () => {
		const el = makeTextElement({
			textStyle: {
				bodyInsetTop: 12,
				bodyInsetBottom: 14,
			},
		});
		const style = computeEditorWrapperStyle(el, el.textStyle);

		// From getTextStyleForElement: bodyInset + italic adjustment
		// textStyle padding should win over layoutStyle padding
		expect(style.paddingTop).toBe(12);
		expect(style.paddingBottom).toBe(14);
	});

	it("should add italic adjustment to top/bottom padding when italic runs exist", () => {
		const el = makeTextElement({
			textStyle: {
				bodyInsetTop: 10,
				bodyInsetBottom: 10,
				italic: true,
			},
		});
		const style = computeEditorWrapperStyle(el, el.textStyle);

		// getTextStyleForElement adds 1px for italic
		expect(style.paddingTop).toBe(11);
		expect(style.paddingBottom).toBe(11);
	});
});

// ── Text Layout Style Tests ──────────────────────────────────────────────

describe("getTextLayoutStyle", () => {
	it("should return empty object for non-text elements", () => {
		const el = { id: "1", type: "picture", x: 0, y: 0, width: 100, height: 100 } as PptxElement;
		expect(getTextLayoutStyle(el)).toEqual({});
	});

	it("should use flex column layout for single-column text", () => {
		const el = makeTextElement({ textStyle: {} });
		const style = getTextLayoutStyle(el);

		expect(style.display).toBe("flex");
		expect(style.flexDirection).toBe("column");
	});

	it("should use block layout for multi-column text", () => {
		const el = makeTextElement({ textStyle: { columnCount: 2 } });
		const style = getTextLayoutStyle(el);

		expect(style.display).toBe("block");
		expect(style.columnCount).toBe(2);
	});

	it("should clamp columnCount to [1, 16]", () => {
		const elLow = makeTextElement({ textStyle: { columnCount: 0 } });
		const elHigh = makeTextElement({ textStyle: { columnCount: 20 } });

		expect(getTextLayoutStyle(elLow).display).toBe("flex"); // columnCount=1 → single column
		expect(getTextLayoutStyle(elHigh).columnCount).toBe(16);
	});

	it("should map vAlign to justifyContent", () => {
		const top = makeTextElement({ textStyle: { vAlign: "top" } });
		const mid = makeTextElement({ textStyle: { vAlign: "middle" } });
		const bot = makeTextElement({ textStyle: { vAlign: "bottom" } });

		expect(getTextLayoutStyle(top).justifyContent).toBe("flex-start");
		expect(getTextLayoutStyle(mid).justifyContent).toBe("center");
		expect(getTextLayoutStyle(bot).justifyContent).toBe("flex-end");
	});

	it("should include paragraph spacing in vertical padding", () => {
		const el = makeTextElement({
			textStyle: {
				bodyInsetTop: 5,
				bodyInsetBottom: 5,
				paragraphSpacingBefore: 3,
				paragraphSpacingAfter: 4,
			},
		});
		const style = getTextLayoutStyle(el);

		expect(style.paddingTop).toBe(8); // 5 + 3
		expect(style.paddingBottom).toBe(9); // 5 + 4
	});

	it("should set writingMode for vertical text", () => {
		const el = makeTextElement({ textStyle: { textDirection: "vertical" } });
		const style = getTextLayoutStyle(el);

		expect(style.writingMode).toBe("vertical-rl");
	});

	it("should set writingMode for vertical270 text", () => {
		const el = makeTextElement({ textStyle: { textDirection: "vertical270" } });
		const style = getTextLayoutStyle(el);

		expect(style.writingMode).toBe("vertical-lr");
	});

	it("should apply whiteSpace nowrap when textWrap is none", () => {
		const el = makeTextElement({ textStyle: { textWrap: "none" } });
		const style = getTextLayoutStyle(el);

		expect(style.whiteSpace).toBe("nowrap");
		expect(style.overflow).toBe("visible");
	});

	it("should include global paragraph indents when no per-paragraph indents", () => {
		const el = makeTextElement({
			textStyle: {
				paragraphMarginLeft: 10,
				paragraphIndent: -5,
			},
		});
		const style = getTextLayoutStyle(el);

		expect(style.marginLeft).toBe(10);
		expect(style.textIndent).toBe(-5);
	});

	it("should omit global paragraph indents when per-paragraph indents exist", () => {
		const el = makeTextElement({
			textStyle: {
				paragraphMarginLeft: 10,
				paragraphIndent: -5,
			},
			paragraphIndents: [{ marginLeft: 15, indent: -8 }],
		});
		const style = getTextLayoutStyle(el);

		expect(style.marginLeft).toBeUndefined();
		expect(style.textIndent).toBeUndefined();
	});
});

// ── getTextStyleForElement Tests ─────────────────────────────────────────

describe("getTextStyleForElement", () => {
	it("should return fallback color for non-text elements", () => {
		const el = { id: "1", type: "picture", x: 0, y: 0, width: 100, height: 100 } as PptxElement;
		const style = getTextStyleForElement(el, "#AABBCC");

		expect(style.color).toBe("#AABBCC");
	});

	it("should use element color when specified", () => {
		const el = makeTextElement({ textStyle: { color: "FF0000" } });
		const style = getTextStyleForElement(el, DEFAULT_TEXT_COLOR);

		expect(style.color).toBe("#FF0000");
	});

	it("should use hyperlink color for hyperlinked text", () => {
		const el = makeTextElement({
			textStyle: { hyperlink: "https://example.com" },
		});
		const style = getTextStyleForElement(el, DEFAULT_TEXT_COLOR);

		expect(style.color).toBe("#0563C1");
	});

	it("should use default font size (24) when not specified", () => {
		const el = makeTextElement({ textStyle: {} });
		const style = getTextStyleForElement(el, DEFAULT_TEXT_COLOR);

		expect(style.fontSize).toBe(24);
	});

	it("should use specified font size", () => {
		const el = makeTextElement({ textStyle: { fontSize: 36 } });
		const style = getTextStyleForElement(el, DEFAULT_TEXT_COLOR);

		expect(style.fontSize).toBe(36);
	});

	it("should set bold weight to 700", () => {
		const el = makeTextElement({ textStyle: { bold: true } });
		const style = getTextStyleForElement(el, DEFAULT_TEXT_COLOR);

		expect(style.fontWeight).toBe(700);
	});

	it("should set non-bold weight to 400", () => {
		const el = makeTextElement({ textStyle: {} });
		const style = getTextStyleForElement(el, DEFAULT_TEXT_COLOR);

		expect(style.fontWeight).toBe(400);
	});

	it("should set italic font style", () => {
		const el = makeTextElement({ textStyle: { italic: true } });
		const style = getTextStyleForElement(el, DEFAULT_TEXT_COLOR);

		expect(style.fontStyle).toBe("italic");
	});

	it("should combine underline and strikethrough decorations", () => {
		const el = makeTextElement({
			textStyle: { underline: true, strikethrough: true },
		});
		const style = getTextStyleForElement(el, DEFAULT_TEXT_COLOR);

		expect(style.textDecorationLine).toBe("underline line-through");
	});

	it("should set double strike decoration style", () => {
		const el = makeTextElement({
			textStyle: { strikethrough: true, strikeType: "dblStrike" },
		});
		const style = getTextStyleForElement(el, DEFAULT_TEXT_COLOR);

		expect(style.textDecorationStyle).toBe("double");
	});

	it("should map justify-like alignment values to justify", () => {
		for (const align of ["justLow", "dist", "thaiDist"] as const) {
			const el = makeTextElement({ textStyle: { align } });
			const style = getTextStyleForElement(el, DEFAULT_TEXT_COLOR);
			expect(style.textAlign).toBe("justify");
		}
	});

	it("should default RTL text alignment to right", () => {
		const el = makeTextElement({ textStyle: { rtl: true } });
		const style = getTextStyleForElement(el, DEFAULT_TEXT_COLOR);

		expect(style.textAlign).toBe("right");
		expect(style.direction).toBe("rtl");
	});

	it("should apply text indent", () => {
		const el = makeTextElement({
			textStyle: { paragraphIndent: -12 },
		});
		const style = getTextStyleForElement(el, DEFAULT_TEXT_COLOR);

		expect(style.textIndent).toBe(-12);
	});

	it("should apply autofit font scaling", () => {
		const el = makeTextElement({
			textStyle: {
				autoFit: true,
				autoFitMode: "normal",
				autoFitFontScale: 0.5,
				fontSize: 30,
			},
		});
		const style = getTextStyleForElement(el, DEFAULT_TEXT_COLOR);

		expect(style.fontSize).toBe(15); // 30 * 0.5
	});

	it("should clamp autofit font size to minimum of 6", () => {
		const el = makeTextElement({
			textStyle: {
				autoFit: true,
				autoFitMode: "normal",
				autoFitFontScale: 0.1,
				fontSize: 10,
			},
		});
		const style = getTextStyleForElement(el, DEFAULT_TEXT_COLOR);

		expect(style.fontSize).toBe(6); // max(6, round(10 * 0.1)) = 6
	});

	it("should apply line spacing reduction with autofit", () => {
		const el = makeTextElement({
			textStyle: {
				autoFit: true,
				autoFitMode: "normal",
				autoFitLineSpacingReduction: 0.2,
				lineSpacing: 1.5,
			},
		});
		const style = getTextStyleForElement(el, DEFAULT_TEXT_COLOR);

		// 1.5 * (1 - 0.2) ≈ 1.2 (floating point)
		expect(style.lineHeight).toBeCloseTo(1.2, 10);
	});

	it("should set overflow hidden for autofit text", () => {
		const el = makeTextElement({
			textStyle: { autoFit: true },
		});
		const style = getTextStyleForElement(el, DEFAULT_TEXT_COLOR);

		expect(style.overflow).toBe("hidden");
	});

	it("should apply nowrap for textWrap none", () => {
		const el = makeTextElement({
			textStyle: { textWrap: "none" },
		});
		const style = getTextStyleForElement(el, DEFAULT_TEXT_COLOR);

		expect(style.whiteSpace).toBe("nowrap");
		expect(style.overflow).toBe("visible");
	});
});

// ── getTextWarpStyle Comprehensive Tests ─────────────────────────────────

describe("getTextWarpStyle", () => {
	it("should return undefined for undefined textStyle", () => {
		expect(getTextWarpStyle(undefined)).toBeUndefined();
	});

	it("should return undefined for no warp preset", () => {
		expect(getTextWarpStyle({} as TextStyle)).toBeUndefined();
	});

	it("should return undefined for textNoShape", () => {
		expect(getTextWarpStyle({ textWarpPreset: "textNoShape" } as TextStyle)).toBeUndefined();
	});

	it("should return undefined for textPlain", () => {
		expect(getTextWarpStyle({ textWarpPreset: "textPlain" } as TextStyle)).toBeUndefined();
	});

	const archPresets = [
		{ preset: "textArchUp", rotateX: "-12deg", origin: "center bottom" },
		{ preset: "textArchUpPour", rotateX: "-12deg", origin: "center bottom" },
		{ preset: "textArchDown", rotateX: "12deg", origin: "center top" },
		{ preset: "textArchDownPour", rotateX: "12deg", origin: "center top" },
	] as const;

	for (const { preset, rotateX, origin } of archPresets) {
		it(`should handle ${preset}`, () => {
			const style = getTextWarpStyle({ textWarpPreset: preset } as TextStyle);
			expect(style?.transform).toContain(`rotateX(${rotateX})`);
			expect(style?.transformOrigin).toBe(origin);
		});
	}

	it("should handle button presets", () => {
		const style = getTextWarpStyle({ textWarpPreset: "textButton" } as TextStyle);
		expect(style?.transform).toBe("perspective(500px) rotateX(8deg)");
		expect(style?.transformOrigin).toBe("center top");
	});

	it("should handle chevron presets", () => {
		const style = getTextWarpStyle({ textWarpPreset: "textChevron" } as TextStyle);
		expect(style?.transform).toContain("rotateY(6deg)");
	});

	it("should handle deflate variants", () => {
		for (const preset of ["textDeflate", "textDeflateBottom", "textDeflateTop"] as const) {
			const style = getTextWarpStyle({ textWarpPreset: preset } as TextStyle);
			expect(style?.transform).toContain("scaleY(0.88)");
			expect(style?.transform).toContain("scaleX(0.95)");
		}
	});

	it("should handle inflate variants", () => {
		for (const preset of ["textInflate", "textInflateBottom", "textInflateTop"] as const) {
			const style = getTextWarpStyle({ textWarpPreset: preset } as TextStyle);
			expect(style?.transform).toContain("scaleY(1.15)");
			expect(style?.transform).toContain("scaleX(1.05)");
		}
	});

	it("should handle double wave preset", () => {
		const style = getTextWarpStyle({ textWarpPreset: "textDoubleWave1" } as TextStyle);
		expect(style?.transform).toContain("skewX(4deg)");
	});

	it("should handle triangle presets", () => {
		const style = getTextWarpStyle({ textWarpPreset: "textTriangle" } as TextStyle);
		expect(style?.transform).toContain("rotateX(-6deg)");
		expect(style?.transformOrigin).toBe("center bottom");
	});

	it("should handle ring presets", () => {
		const style = getTextWarpStyle({ textWarpPreset: "textRingInside" } as TextStyle);
		expect(style?.transform).toContain("rotateX(-4deg)");
		expect(style?.transform).toContain("rotateY(4deg)");
	});

	it("should handle can presets", () => {
		const style = getTextWarpStyle({ textWarpPreset: "textCanUp" } as TextStyle);
		expect(style?.transform).toContain("rotateX(-6deg)");
	});

	it("should handle compound inflate/deflate", () => {
		const deflateInflate = getTextWarpStyle({ textWarpPreset: "textDeflateInflate" } as TextStyle);
		const deflateInflateDeflate = getTextWarpStyle({ textWarpPreset: "textDeflateInflateDeflate" } as TextStyle);

		expect(deflateInflate?.transform).toContain("scaleY(0.92)");
		expect(deflateInflateDeflate?.transform).toContain("scaleY(0.85)");
	});

	it("should handle stop/octagon", () => {
		const style = getTextWarpStyle({ textWarpPreset: "textStop" } as TextStyle);
		expect(style?.transform).toBe("scaleX(0.9) scaleY(0.9)");
	});

	it("should handle curve presets", () => {
		const curveUp = getTextWarpStyle({ textWarpPreset: "textCurveUp" } as TextStyle);
		const curveDown = getTextWarpStyle({ textWarpPreset: "textCurveDown" } as TextStyle);

		expect(curveUp?.transform).toContain("rotateX(-8deg)");
		expect(curveDown?.transform).toContain("rotateX(8deg)");
	});
});

// ── getTextCompensationTransform Tests ───────────────────────────────────

describe("getTextCompensationTransform (edit mode integration)", () => {
	it("should return undefined when no flips are present", () => {
		const el = makeTextElement({});
		expect(getTextCompensationTransform(el)).toBeUndefined();
	});

	it("should compensate for horizontal flip", () => {
		const el = makeTextElement({ flipHorizontal: true });
		expect(getTextCompensationTransform(el)).toBe("scaleX(-1)");
	});

	it("should compensate for vertical flip", () => {
		const el = makeTextElement({ flipVertical: true });
		expect(getTextCompensationTransform(el)).toBe("scaleY(-1)");
	});

	it("should compensate for both flips", () => {
		const el = makeTextElement({ flipHorizontal: true, flipVertical: true });
		expect(getTextCompensationTransform(el)).toBe("scaleX(-1) scaleY(-1)");
	});

	it("should NOT include rotation in compensation", () => {
		const el = makeTextElement({ flipHorizontal: true, rotation: 45 });
		expect(getTextCompensationTransform(el)).toBe("scaleX(-1)");
	});
});

// ── Full Style Chain Integration ─────────────────────────────────────────

describe("InlineTextEditor: full style chain integration", () => {
	it("should produce identical styles to view mode for a fully-styled element", () => {
		const textStyle: TextStyle = {
			fontFamily: "Times New Roman",
			fontSize: 32,
			bold: true,
			italic: true,
			color: "0000FF",
			align: "center",
			vAlign: "middle",
			bodyInsetTop: 8,
			bodyInsetBottom: 8,
			bodyInsetLeft: 12,
			bodyInsetRight: 12,
			lineSpacing: 1.5,
			underline: true,
		};
		const el = makeTextElement({ textStyle });

		const editStyle = computeEditorWrapperStyle(el, textStyle);
		const viewStyle = computeViewModeStyle(el, textStyle);

		// All these properties should match between view and edit modes
		expect(editStyle.fontFamily).toBe(viewStyle.fontFamily);
		expect(editStyle.fontSize).toBe(viewStyle.fontSize);
		expect(editStyle.fontWeight).toBe(viewStyle.fontWeight);
		expect(editStyle.fontStyle).toBe(viewStyle.fontStyle);
		expect(editStyle.color).toBe(viewStyle.color);
		expect(editStyle.textAlign).toBe(viewStyle.textAlign);
		expect(editStyle.justifyContent).toBe(viewStyle.justifyContent);
		expect(editStyle.paddingTop).toBe(viewStyle.paddingTop);
		expect(editStyle.paddingBottom).toBe(viewStyle.paddingBottom);
		expect(editStyle.paddingLeft).toBe(viewStyle.paddingLeft);
		expect(editStyle.paddingRight).toBe(viewStyle.paddingRight);
		expect(editStyle.lineHeight).toBe(viewStyle.lineHeight);
		expect(editStyle.textDecorationLine).toBe(viewStyle.textDecorationLine);
	});

	it("should produce identical styles with RTL + vertical text", () => {
		const textStyle: TextStyle = {
			rtl: true,
			textDirection: "vertical",
			vAlign: "bottom",
		};
		const el = makeTextElement({ textStyle });

		const editStyle = computeEditorWrapperStyle(el, textStyle);
		const viewStyle = computeViewModeStyle(el, textStyle);

		expect(editStyle.direction).toBe(viewStyle.direction);
		expect(editStyle.writingMode).toBe(viewStyle.writingMode);
		expect(editStyle.justifyContent).toBe(viewStyle.justifyContent);
	});

	it("should produce identical styles with autofit enabled", () => {
		const textStyle: TextStyle = {
			autoFit: true,
			autoFitMode: "normal",
			autoFitFontScale: 0.8,
			autoFitLineSpacingReduction: 0.1,
			fontSize: 20,
		};
		const el = makeTextElement({ textStyle });

		const editStyle = computeEditorWrapperStyle(el, textStyle);
		const viewStyle = computeViewModeStyle(el, textStyle);

		expect(editStyle.fontSize).toBe(viewStyle.fontSize);
		expect(editStyle.lineHeight).toBe(viewStyle.lineHeight);
		expect(editStyle.overflow).toBe(viewStyle.overflow);
	});

	it("should include warp transform in edit mode", () => {
		const textStyle: TextStyle = { textWarpPreset: "textWave1" };
		const el = makeTextElement({ textStyle });

		const editStyle = computeEditorWrapperStyle(el, textStyle);

		// Edit mode should include the warp transform
		const warp = getTextWarpStyle(textStyle);
		expect(editStyle.transform).toContain(warp?.transform as string);
	});

	it("should apply warp style properties (borderRadius, transformOrigin) in edit mode", () => {
		const textStyle: TextStyle = { textWarpPreset: "textCircle" };
		const el = makeTextElement({ textStyle });

		const editStyle = computeEditorWrapperStyle(el, textStyle);
		const warp = getTextWarpStyle(textStyle);

		// Circle warp should add borderRadius
		expect(editStyle.borderRadius).toBe(warp?.borderRadius);
		expect(editStyle.borderRadius).toBe("50%");
	});

	it("should handle element with flip + warp + RTL + autofit", () => {
		const textStyle: TextStyle = {
			rtl: true,
			textWarpPreset: "textArchUp",
			autoFit: true,
			autoFitMode: "normal",
			autoFitFontScale: 0.9,
			fontSize: 24,
			bodyInsetLeft: 10,
			bodyInsetRight: 10,
		};
		const el = makeTextElement({
			flipHorizontal: true,
			textStyle,
		});
		const style = computeEditorWrapperStyle(el, textStyle);

		// Transform should have both flip compensation and warp
		expect(style.transform).toContain("scaleX(-1)");
		expect(style.transform).toContain("perspective(400px)");

		// Font should be scaled
		expect(style.fontSize).toBe(22); // round(24 * 0.9)

		// Direction should be RTL
		expect(style.direction).toBe("rtl");

		// Padding should be preserved
		expect(style.paddingLeft).toBe(10);
		expect(style.paddingRight).toBe(10);
	});
});
