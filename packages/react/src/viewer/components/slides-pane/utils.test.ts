import { describe, it, expect } from "vitest";
import { formatTimingMs } from "./utils";

describe("formatTimingMs", () => {
  it('formats 0 ms as "0:00"', () => {
    expect(formatTimingMs(0)).toBe("0:00");
  });

  it('formats 1000 ms as "0:01"', () => {
    expect(formatTimingMs(1000)).toBe("0:01");
  });

  it('formats 60000 ms as "1:00"', () => {
    expect(formatTimingMs(60000)).toBe("1:00");
  });

  it('formats 90000 ms as "1:30"', () => {
    expect(formatTimingMs(90000)).toBe("1:30");
  });

  it('formats 125000 ms as "2:05"', () => {
    expect(formatTimingMs(125000)).toBe("2:05");
  });

  it("pads seconds with leading zero", () => {
    expect(formatTimingMs(5000)).toBe("0:05");
  });

  it('treats negative values as "0:00"', () => {
    expect(formatTimingMs(-1000)).toBe("0:00");
  });

  it("floors fractional seconds", () => {
    expect(formatTimingMs(1500)).toBe("0:01");
  });

  it("handles large values", () => {
    // 10 minutes = 600000 ms
    expect(formatTimingMs(600000)).toBe("10:00");
  });

  it("formats 59 seconds correctly", () => {
    expect(formatTimingMs(59000)).toBe("0:59");
  });
});
