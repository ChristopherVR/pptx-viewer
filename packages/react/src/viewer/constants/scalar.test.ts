import { describe, it, expect } from "vitest";
import {
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  MIN_ELEMENT_SIZE,
  EMU_PER_PX,
  DEFAULT_BODY_INSET_LR_PX,
  DEFAULT_BODY_INSET_TB_PX,
  DEFAULT_TEXT_COLOR,
  DEFAULT_FILL_COLOR,
  DEFAULT_STROKE_COLOR,
  DEFAULT_FONT_FAMILY,
  DEFAULT_TEXT_FONT_SIZE,
  RECENT_COLOR_LIMIT,
  HYPERLINK_COLOR,
  DEFAULT_TABLE_ROWS,
  DEFAULT_TABLE_COLUMNS,
  MIN_TABLE_DIMENSION,
  MAX_TABLE_DIMENSION,
  DEFAULT_PRESENTATION_STEP_DURATION_MS,
  SHAPE_ADJUSTMENT_MIN,
  SHAPE_ADJUSTMENT_MAX,
  DEFAULT_ROUND_RECT_ADJUSTMENT,
  MINIMAP_WIDTH,
  MIN_ZOOM_SCALE,
  MAX_ZOOM_SCALE,
  ZOOM_TO_SELECTION_PADDING,
  GRID_SIZE,
  SNAP_THRESHOLD,
  SLIDE_NAV_THUMBNAIL_WIDTH,
  UNGROUPED_SECTION_ID,
} from "./scalar";

describe("canvas defaults", () => {
  it("DEFAULT_CANVAS_WIDTH is a standard HD width", () => {
    expect(DEFAULT_CANVAS_WIDTH).toBe(1280);
  });

  it("DEFAULT_CANVAS_HEIGHT is a standard HD height", () => {
    expect(DEFAULT_CANVAS_HEIGHT).toBe(720);
  });

  it("canvas defaults have a 16:9 aspect ratio", () => {
    expect(DEFAULT_CANVAS_WIDTH / DEFAULT_CANVAS_HEIGHT).toBeCloseTo(16 / 9, 2);
  });
});

describe("element constraints", () => {
  it("MIN_ELEMENT_SIZE is positive", () => {
    expect(MIN_ELEMENT_SIZE).toBeGreaterThan(0);
  });
});

describe("EMU conversion", () => {
  it("EMU_PER_PX matches the standard OOXML value", () => {
    expect(EMU_PER_PX).toBe(9525);
  });
});

describe("body insets", () => {
  it("DEFAULT_BODY_INSET_LR_PX is computed from 91440 EMU", () => {
    expect(DEFAULT_BODY_INSET_LR_PX).toBeCloseTo(91440 / 9525, 5);
  });

  it("DEFAULT_BODY_INSET_TB_PX is computed from 45720 EMU", () => {
    expect(DEFAULT_BODY_INSET_TB_PX).toBeCloseTo(45720 / 9525, 5);
  });

  it("horizontal insets are larger than vertical insets", () => {
    expect(DEFAULT_BODY_INSET_LR_PX).toBeGreaterThan(DEFAULT_BODY_INSET_TB_PX);
  });
});

describe("color defaults", () => {
  it("DEFAULT_TEXT_COLOR is a valid hex color", () => {
    expect(DEFAULT_TEXT_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("DEFAULT_FILL_COLOR is a valid hex color", () => {
    expect(DEFAULT_FILL_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("DEFAULT_STROKE_COLOR is a valid hex color", () => {
    expect(DEFAULT_STROKE_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("HYPERLINK_COLOR is a valid hex color", () => {
    expect(HYPERLINK_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe("font defaults", () => {
  it("DEFAULT_FONT_FAMILY is a non-empty string", () => {
    expect(DEFAULT_FONT_FAMILY.length).toBeGreaterThan(0);
  });

  it("DEFAULT_TEXT_FONT_SIZE is a positive number", () => {
    expect(DEFAULT_TEXT_FONT_SIZE).toBeGreaterThan(0);
  });
});

describe("table defaults", () => {
  it("DEFAULT_TABLE_ROWS and DEFAULT_TABLE_COLUMNS are 3", () => {
    expect(DEFAULT_TABLE_ROWS).toBe(3);
    expect(DEFAULT_TABLE_COLUMNS).toBe(3);
  });

  it("MIN_TABLE_DIMENSION is at least 1", () => {
    expect(MIN_TABLE_DIMENSION).toBeGreaterThanOrEqual(1);
  });

  it("MAX_TABLE_DIMENSION is larger than MIN_TABLE_DIMENSION", () => {
    expect(MAX_TABLE_DIMENSION).toBeGreaterThan(MIN_TABLE_DIMENSION);
  });

  it("defaults fall within min/max bounds", () => {
    expect(DEFAULT_TABLE_ROWS).toBeGreaterThanOrEqual(MIN_TABLE_DIMENSION);
    expect(DEFAULT_TABLE_ROWS).toBeLessThanOrEqual(MAX_TABLE_DIMENSION);
    expect(DEFAULT_TABLE_COLUMNS).toBeGreaterThanOrEqual(MIN_TABLE_DIMENSION);
    expect(DEFAULT_TABLE_COLUMNS).toBeLessThanOrEqual(MAX_TABLE_DIMENSION);
  });
});

describe("zoom constraints", () => {
  it("MIN_ZOOM_SCALE is less than 1 (allows zoom out)", () => {
    expect(MIN_ZOOM_SCALE).toBeLessThan(1);
  });

  it("MAX_ZOOM_SCALE is greater than 1 (allows zoom in)", () => {
    expect(MAX_ZOOM_SCALE).toBeGreaterThan(1);
  });

  it("MIN_ZOOM_SCALE is positive", () => {
    expect(MIN_ZOOM_SCALE).toBeGreaterThan(0);
  });

  it("MIN_ZOOM_SCALE is less than MAX_ZOOM_SCALE", () => {
    expect(MIN_ZOOM_SCALE).toBeLessThan(MAX_ZOOM_SCALE);
  });
});

describe("shape adjustments", () => {
  it("SHAPE_ADJUSTMENT_MIN is 0", () => {
    expect(SHAPE_ADJUSTMENT_MIN).toBe(0);
  });

  it("SHAPE_ADJUSTMENT_MAX is 50000 (100% in OOXML EMU fifths)", () => {
    expect(SHAPE_ADJUSTMENT_MAX).toBe(50000);
  });

  it("DEFAULT_ROUND_RECT_ADJUSTMENT is within valid range", () => {
    expect(DEFAULT_ROUND_RECT_ADJUSTMENT).toBeGreaterThanOrEqual(
      SHAPE_ADJUSTMENT_MIN,
    );
    expect(DEFAULT_ROUND_RECT_ADJUSTMENT).toBeLessThanOrEqual(
      SHAPE_ADJUSTMENT_MAX,
    );
  });
});

describe("miscellaneous constants", () => {
  it("RECENT_COLOR_LIMIT is a positive integer", () => {
    expect(RECENT_COLOR_LIMIT).toBeGreaterThan(0);
    expect(Number.isInteger(RECENT_COLOR_LIMIT)).toBe(true);
  });

  it("DEFAULT_PRESENTATION_STEP_DURATION_MS is positive", () => {
    expect(DEFAULT_PRESENTATION_STEP_DURATION_MS).toBeGreaterThan(0);
  });

  it("MINIMAP_WIDTH is a positive number", () => {
    expect(MINIMAP_WIDTH).toBeGreaterThan(0);
  });

  it("ZOOM_TO_SELECTION_PADDING is a positive number", () => {
    expect(ZOOM_TO_SELECTION_PADDING).toBeGreaterThan(0);
  });

  it("GRID_SIZE is a positive number", () => {
    expect(GRID_SIZE).toBeGreaterThan(0);
  });

  it("SNAP_THRESHOLD is a positive number", () => {
    expect(SNAP_THRESHOLD).toBeGreaterThan(0);
  });

  it("SLIDE_NAV_THUMBNAIL_WIDTH is a positive number", () => {
    expect(SLIDE_NAV_THUMBNAIL_WIDTH).toBeGreaterThan(0);
  });

  it("UNGROUPED_SECTION_ID is a string starting with double underscore", () => {
    expect(UNGROUPED_SECTION_ID).toMatch(/^__.*__$/);
  });
});
