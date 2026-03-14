import { describe, it, expect } from "vitest";
import {
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
  ZOOM_STEP,
} from "./types";

describe("slide-sorter constants", () => {
  it("MIN_ZOOM is a positive number", () => {
    expect(typeof MIN_ZOOM).toBe("number");
    expect(MIN_ZOOM).toBeGreaterThan(0);
  });

  it("MAX_ZOOM is a positive number", () => {
    expect(typeof MAX_ZOOM).toBe("number");
    expect(MAX_ZOOM).toBeGreaterThan(0);
  });

  it("MIN_ZOOM is less than MAX_ZOOM", () => {
    expect(MIN_ZOOM).toBeLessThan(MAX_ZOOM);
  });

  it("DEFAULT_ZOOM is between MIN_ZOOM and MAX_ZOOM (inclusive)", () => {
    expect(DEFAULT_ZOOM).toBeGreaterThanOrEqual(MIN_ZOOM);
    expect(DEFAULT_ZOOM).toBeLessThanOrEqual(MAX_ZOOM);
  });

  it("ZOOM_STEP is a positive number", () => {
    expect(typeof ZOOM_STEP).toBe("number");
    expect(ZOOM_STEP).toBeGreaterThan(0);
  });

  it("ZOOM_STEP divides the range evenly (range is a multiple of step)", () => {
    const range = MAX_ZOOM - MIN_ZOOM;
    expect(range % ZOOM_STEP).toBe(0);
  });

  it("MIN_ZOOM is 50", () => {
    expect(MIN_ZOOM).toBe(50);
  });

  it("MAX_ZOOM is 200", () => {
    expect(MAX_ZOOM).toBe(200);
  });

  it("DEFAULT_ZOOM is 100", () => {
    expect(DEFAULT_ZOOM).toBe(100);
  });

  it("ZOOM_STEP is 10", () => {
    expect(ZOOM_STEP).toBe(10);
  });
});
