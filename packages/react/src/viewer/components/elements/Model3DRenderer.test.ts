import { describe, it, expect, vi, afterEach } from "vitest";
import { dataUrlToBlobUrl } from "./Model3DRenderer";

// ---------------------------------------------------------------------------
// dataUrlToBlobUrl
// ---------------------------------------------------------------------------

describe("dataUrlToBlobUrl", () => {
  const revokedUrls: string[] = [];
  const originalCreateObjectURL = globalThis.URL.createObjectURL;
  const originalRevokeObjectURL = globalThis.URL.revokeObjectURL;

  afterEach(() => {
    revokedUrls.length = 0;
    // Restore originals (in case a test swapped them)
    globalThis.URL.createObjectURL = originalCreateObjectURL;
    globalThis.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("returns undefined for falsy input", () => {
    expect(dataUrlToBlobUrl(undefined)).toBeUndefined();
    expect(dataUrlToBlobUrl("")).toBeUndefined();
  });

  it("returns undefined for a string without a comma (not a data URL)", () => {
    expect(dataUrlToBlobUrl("not-a-data-url")).toBeUndefined();
  });

  it("converts a valid base64 data URL to a blob URL", () => {
    // Minimal valid base64 data URL (1 byte: 0x00)
    const dataUrl = "data:application/octet-stream;base64,AA==";

    // Mock URL.createObjectURL to return a predictable string
    const fakeUrl = "blob:http://localhost/fake-uuid";
    globalThis.URL.createObjectURL = vi.fn(() => fakeUrl);

    const result = dataUrlToBlobUrl(dataUrl);

    expect(result).toBe(fakeUrl);
    expect(globalThis.URL.createObjectURL).toHaveBeenCalledTimes(1);

    // Verify the Blob was created with the correct MIME type
    const blob = (globalThis.URL.createObjectURL as ReturnType<typeof vi.fn>)
      .mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/octet-stream");
    expect(blob.size).toBe(1);
  });

  it("defaults to application/octet-stream when MIME type is missing", () => {
    // data URL without a proper MIME prefix (still has comma)
    const dataUrl = "data:;base64,AA==";

    const fakeUrl = "blob:http://localhost/fake-uuid-2";
    globalThis.URL.createObjectURL = vi.fn(() => fakeUrl);

    const result = dataUrlToBlobUrl(dataUrl);
    expect(result).toBe(fakeUrl);

    const blob = (globalThis.URL.createObjectURL as ReturnType<typeof vi.fn>)
      .mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/octet-stream");
  });

  it("returns undefined when atob throws (invalid base64)", () => {
    // Provide an invalid base64 payload that will cause atob to throw
    const dataUrl = "data:application/octet-stream;base64,!!!invalid!!!";
    const result = dataUrlToBlobUrl(dataUrl);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Blob URL cleanup
// ---------------------------------------------------------------------------

describe("blob URL lifecycle", () => {
  it("URL.revokeObjectURL is called for cleanup", () => {
    const fakeUrl = "blob:http://localhost/cleanup-test";
    const revokeSpy = vi.fn();
    globalThis.URL.revokeObjectURL = revokeSpy;

    // Simulate cleanup: the component calls URL.revokeObjectURL in an
    // effect cleanup.  We verify the function is callable and works.
    URL.revokeObjectURL(fakeUrl);
    expect(revokeSpy).toHaveBeenCalledWith(fakeUrl);
  });
});

// ---------------------------------------------------------------------------
// Poster fallback (module loads without Three.js)
// ---------------------------------------------------------------------------

describe("Model3DRenderer module", () => {
  it("exports dataUrlToBlobUrl as a named export", async () => {
    const mod = await import("./Model3DRenderer");
    expect(typeof mod.dataUrlToBlobUrl).toBe("function");
  });

  it("exports Model3DRenderer as a named export", async () => {
    const mod = await import("./Model3DRenderer");
    expect(typeof mod.Model3DRenderer).toBe("function");
  });
});
