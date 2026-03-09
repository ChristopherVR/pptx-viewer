import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("resolves Tailwind conflicts (last wins)", () => {
    const result = cn("px-2", "px-4");
    expect(result).toBe("px-4");
  });

  it("handles conditional classes (false / undefined)", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });

  it("returns empty string when no inputs", () => {
    expect(cn()).toBe("");
  });

  it("handles arrays of class names", () => {
    expect(cn(["a", "b"], "c")).toBe("a b c");
  });

  it("deduplicates identical classes", () => {
    const result = cn("text-red-500", "text-red-500");
    expect(result).toBe("text-red-500");
  });

  it("resolves conflicting text colors", () => {
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toBe("text-blue-500");
  });

  it("preserves non-conflicting classes", () => {
    const result = cn("p-2", "m-4", "bg-red-500");
    expect(result).toBe("p-2 m-4 bg-red-500");
  });
});
