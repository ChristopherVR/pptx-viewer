import { describe, it, expect } from "vitest";
import { SELECT_CLS, NUMBER_CLS, BTN_CLS } from "./element-properties-constants";

describe("element-properties-constants CSS classes", () => {
  it("SELECT_CLS is a non-empty string", () => {
    expect(SELECT_CLS).toBeTruthy();
    expect(typeof SELECT_CLS).toBe("string");
  });

  it("NUMBER_CLS is a non-empty string", () => {
    expect(NUMBER_CLS).toBeTruthy();
    expect(typeof NUMBER_CLS).toBe("string");
  });

  it("BTN_CLS is a non-empty string", () => {
    expect(BTN_CLS).toBeTruthy();
    expect(typeof BTN_CLS).toBe("string");
  });

  it("NUMBER_CLS equals SELECT_CLS", () => {
    expect(NUMBER_CLS).toBe(SELECT_CLS);
  });

  it("BTN_CLS contains flex-related classes", () => {
    expect(BTN_CLS).toContain("inline-flex");
  });
});
