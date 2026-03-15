/**
 * Tests for pure logic and type contract of useThemeHandlers (GAP-E3).
 *
 * The theme switching coordination logic delegates to PptxHandler.
 * These tests verify the handler result shape and edge-case handling
 * without mounting React components.
 */
import { describe, it, expect, vi } from "vitest";

import type {
  ThemeHandlersResult,
  UseThemeHandlersInput,
} from "./useThemeHandlers";

// ---------------------------------------------------------------------------
// Type-level assertions — ensure the new methods exist in the result type
// ---------------------------------------------------------------------------

describe("ThemeHandlersResult type contract", () => {
  it("should include handleGetAvailableThemes in the result interface", () => {
    // Compile-time check: the property must exist on ThemeHandlersResult
    const check: keyof ThemeHandlersResult = "handleGetAvailableThemes";
    expect(check).toBe("handleGetAvailableThemes");
  });

  it("should include handleSwitchTheme in the result interface", () => {
    const check: keyof ThemeHandlersResult = "handleSwitchTheme";
    expect(check).toBe("handleSwitchTheme");
  });

  it("should include all original handlers in the result interface", () => {
    const keys: Array<keyof ThemeHandlersResult> = [
      "handleApplyTheme",
      "handleUpdateThemeColorScheme",
      "handleUpdateThemeFontScheme",
      "handleUpdateThemeName",
      "handleApplyThemeToPresentation",
      "handleApplyThemeData",
      "handleSetTemplateBackground",
      "handleGetTemplateBackgroundColor",
      "handleGetAvailableThemes",
      "handleSwitchTheme",
    ];
    expect(keys).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// Input type validation
// ---------------------------------------------------------------------------

describe("UseThemeHandlersInput contract", () => {
  it("should accept all required input fields", () => {
    const input: UseThemeHandlersInput = {
      handlerRef: { current: null },
      serializeSlides: vi.fn().mockResolvedValue(null),
      setContent: vi.fn(),
      onContentChange: undefined,
      setTheme: vi.fn(),
      setSlideMasters: vi.fn(),
      slideMasters: [],
      history: {
        markDirty: vi.fn(),
      } as unknown as UseThemeHandlersInput["history"],
    };

    expect(input.handlerRef.current).toBeNull();
    expect(input.slideMasters).toEqual([]);
  });
});
