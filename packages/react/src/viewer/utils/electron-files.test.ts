import { describe, it, expect } from "vitest";
import { escapeHtml } from "./electron-files";

// ---------------------------------------------------------------------------
// Tests: escapeHtml (pure function exported from electron-files)
// ---------------------------------------------------------------------------

describe("escapeHtml", () => {
  it("should escape ampersands", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("should escape less-than signs", () => {
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
  });

  it("should escape greater-than signs", () => {
    expect(escapeHtml("x > y")).toBe("x &gt; y");
  });

  it("should escape double quotes", () => {
    expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("should escape single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("should escape all special characters together", () => {
    expect(escapeHtml(`<a href="x" title='y'>&`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;",
    );
  });

  it("should return empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("should return plain text unchanged", () => {
    expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
  });

  it("should handle multiple ampersands", () => {
    expect(escapeHtml("a && b && c")).toBe("a &amp;&amp; b &amp;&amp; c");
  });
});
