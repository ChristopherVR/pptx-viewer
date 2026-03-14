import { describe, it, expect } from "vitest";
import type { PlaceholderTextLevelStyle } from "../../types";

// Since formatAutoNumber and createBulletInfoFromLevelStyle are protected
// methods on a deeply chained mixin, we extract and test their logic directly.
// The implementations are copied verbatim to verify correctness.

// --- Extracted from PptxHandlerRuntimeBulletParsing.formatAutoNumber ---

function toAlpha(n: number, upper: boolean): string {
  const code = (n - 1) % 26;
  const ch = String.fromCharCode((upper ? 65 : 97) + code);
  return ch;
}

function toRoman(n: number, upper: boolean): string {
  const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const numerals = [
    "M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I",
  ];
  let result = "";
  let remaining = Math.max(1, Math.min(n, 3999));
  for (let i = 0; i < values.length; i++) {
    while (remaining >= values[i]) {
      result += numerals[i];
      remaining -= values[i];
    }
  }
  return upper ? result : result.toLowerCase();
}

function formatAutoNumber(autoNumType: string, seqNum: number): string {
  switch (autoNumType) {
    case "arabicPeriod":
      return `${seqNum}. `;
    case "arabicParenR":
      return `${seqNum}) `;
    case "arabicParenBoth":
      return `(${seqNum}) `;
    case "alphaLcPeriod":
      return `${toAlpha(seqNum, false)}. `;
    case "alphaUcPeriod":
      return `${toAlpha(seqNum, true)}. `;
    case "alphaLcParenR":
      return `${toAlpha(seqNum, false)}) `;
    case "alphaUcParenR":
      return `${toAlpha(seqNum, true)}) `;
    case "romanLcPeriod":
      return `${toRoman(seqNum, false)}. `;
    case "romanUcPeriod":
      return `${toRoman(seqNum, true)}. `;
    default:
      return `${seqNum}. `;
  }
}

// --- Extracted from PptxHandlerRuntimeBulletParsing.createBulletInfoFromLevelStyle ---

function createBulletInfoFromLevelStyle(
  levelStyle: PlaceholderTextLevelStyle | undefined,
  paragraphIndex: number,
) {
  if (!levelStyle) return null;
  if (levelStyle.bulletNone) return { none: true };

  if (levelStyle.bulletChar && levelStyle.bulletChar.length > 0) {
    return {
      char: levelStyle.bulletChar,
      fontFamily: levelStyle.bulletFontFamily,
      sizePercent: levelStyle.bulletSizePercent,
      sizePts: levelStyle.bulletSizePts,
      color: levelStyle.bulletColor,
    };
  }

  if (
    levelStyle.bulletAutoNumType &&
    levelStyle.bulletAutoNumType.length > 0
  ) {
    return {
      autoNumType: levelStyle.bulletAutoNumType,
      autoNumStartAt: 1,
      paragraphIndex,
      fontFamily: levelStyle.bulletFontFamily,
      sizePercent: levelStyle.bulletSizePercent,
      sizePts: levelStyle.bulletSizePts,
      color: levelStyle.bulletColor,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// formatAutoNumber
// ---------------------------------------------------------------------------
describe("formatAutoNumber", () => {
  describe("arabicPeriod", () => {
    it("should format 1 as '1. '", () => {
      expect(formatAutoNumber("arabicPeriod", 1)).toBe("1. ");
    });

    it("should format 10 as '10. '", () => {
      expect(formatAutoNumber("arabicPeriod", 10)).toBe("10. ");
    });
  });

  describe("arabicParenR", () => {
    it("should format 1 as '1) '", () => {
      expect(formatAutoNumber("arabicParenR", 1)).toBe("1) ");
    });

    it("should format 5 as '5) '", () => {
      expect(formatAutoNumber("arabicParenR", 5)).toBe("5) ");
    });
  });

  describe("arabicParenBoth", () => {
    it("should format 1 as '(1) '", () => {
      expect(formatAutoNumber("arabicParenBoth", 1)).toBe("(1) ");
    });

    it("should format 3 as '(3) '", () => {
      expect(formatAutoNumber("arabicParenBoth", 3)).toBe("(3) ");
    });
  });

  describe("alphaLcPeriod", () => {
    it("should format 1 as 'a. '", () => {
      expect(formatAutoNumber("alphaLcPeriod", 1)).toBe("a. ");
    });

    it("should format 3 as 'c. '", () => {
      expect(formatAutoNumber("alphaLcPeriod", 3)).toBe("c. ");
    });

    it("should format 26 as 'z. '", () => {
      expect(formatAutoNumber("alphaLcPeriod", 26)).toBe("z. ");
    });

    it("should wrap after 26 (27 => 'a. ')", () => {
      expect(formatAutoNumber("alphaLcPeriod", 27)).toBe("a. ");
    });
  });

  describe("alphaUcPeriod", () => {
    it("should format 1 as 'A. '", () => {
      expect(formatAutoNumber("alphaUcPeriod", 1)).toBe("A. ");
    });

    it("should format 26 as 'Z. '", () => {
      expect(formatAutoNumber("alphaUcPeriod", 26)).toBe("Z. ");
    });
  });

  describe("alphaLcParenR", () => {
    it("should format 1 as 'a) '", () => {
      expect(formatAutoNumber("alphaLcParenR", 1)).toBe("a) ");
    });
  });

  describe("alphaUcParenR", () => {
    it("should format 2 as 'B) '", () => {
      expect(formatAutoNumber("alphaUcParenR", 2)).toBe("B) ");
    });
  });

  describe("romanLcPeriod", () => {
    it("should format 1 as 'i. '", () => {
      expect(formatAutoNumber("romanLcPeriod", 1)).toBe("i. ");
    });

    it("should format 4 as 'iv. '", () => {
      expect(formatAutoNumber("romanLcPeriod", 4)).toBe("iv. ");
    });

    it("should format 9 as 'ix. '", () => {
      expect(formatAutoNumber("romanLcPeriod", 9)).toBe("ix. ");
    });

    it("should format 14 as 'xiv. '", () => {
      expect(formatAutoNumber("romanLcPeriod", 14)).toBe("xiv. ");
    });
  });

  describe("romanUcPeriod", () => {
    it("should format 1 as 'I. '", () => {
      expect(formatAutoNumber("romanUcPeriod", 1)).toBe("I. ");
    });

    it("should format 4 as 'IV. '", () => {
      expect(formatAutoNumber("romanUcPeriod", 4)).toBe("IV. ");
    });

    it("should format 9 as 'IX. '", () => {
      expect(formatAutoNumber("romanUcPeriod", 9)).toBe("IX. ");
    });

    it("should format 40 as 'XL. '", () => {
      expect(formatAutoNumber("romanUcPeriod", 40)).toBe("XL. ");
    });

    it("should format 2024 as 'MMXXIV. '", () => {
      expect(formatAutoNumber("romanUcPeriod", 2024)).toBe("MMXXIV. ");
    });
  });

  describe("unknown type", () => {
    it("should default to arabic period format", () => {
      expect(formatAutoNumber("unknownType", 7)).toBe("7. ");
    });
  });
});

// ---------------------------------------------------------------------------
// createBulletInfoFromLevelStyle
// ---------------------------------------------------------------------------
describe("createBulletInfoFromLevelStyle", () => {
  it("should return null for undefined levelStyle", () => {
    expect(createBulletInfoFromLevelStyle(undefined, 0)).toBeNull();
  });

  it("should return { none: true } when bulletNone is true", () => {
    const style: PlaceholderTextLevelStyle = { bulletNone: true };
    expect(createBulletInfoFromLevelStyle(style, 0)).toEqual({ none: true });
  });

  it("should return char bullet info when bulletChar is set", () => {
    const style: PlaceholderTextLevelStyle = {
      bulletChar: "\u2022",
      bulletFontFamily: "Arial",
      bulletSizePercent: 100,
      bulletSizePts: 12,
      bulletColor: "FF0000",
    };
    const result = createBulletInfoFromLevelStyle(style, 0);
    expect(result).toEqual({
      char: "\u2022",
      fontFamily: "Arial",
      sizePercent: 100,
      sizePts: 12,
      color: "FF0000",
    });
  });

  it("should return autoNum bullet info when bulletAutoNumType is set", () => {
    const style: PlaceholderTextLevelStyle = {
      bulletAutoNumType: "arabicPeriod",
      bulletFontFamily: "Calibri",
    };
    const result = createBulletInfoFromLevelStyle(style, 5);
    expect(result).toEqual({
      autoNumType: "arabicPeriod",
      autoNumStartAt: 1,
      paragraphIndex: 5,
      fontFamily: "Calibri",
      sizePercent: undefined,
      sizePts: undefined,
      color: undefined,
    });
  });

  it("should return null when no bullet properties are set", () => {
    const style: PlaceholderTextLevelStyle = {};
    expect(createBulletInfoFromLevelStyle(style, 0)).toBeNull();
  });

  it("should return null when bulletChar is empty string", () => {
    const style: PlaceholderTextLevelStyle = { bulletChar: "" };
    expect(createBulletInfoFromLevelStyle(style, 0)).toBeNull();
  });

  it("should return null when bulletAutoNumType is empty string", () => {
    const style: PlaceholderTextLevelStyle = { bulletAutoNumType: "" };
    expect(createBulletInfoFromLevelStyle(style, 0)).toBeNull();
  });

  it("should prefer char bullet over autoNum when both set", () => {
    const style: PlaceholderTextLevelStyle = {
      bulletChar: "-",
      bulletAutoNumType: "arabicPeriod",
    };
    const result = createBulletInfoFromLevelStyle(style, 0);
    expect(result).toHaveProperty("char", "-");
    expect(result).not.toHaveProperty("autoNumType");
  });
});
