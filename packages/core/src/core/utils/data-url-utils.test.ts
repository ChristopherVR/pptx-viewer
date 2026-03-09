import { describe, it, expect } from "vitest";
import { parseDataUrlToBytes } from "./data-url-utils";

// ---------------------------------------------------------------------------
// parseDataUrlToBytes
// ---------------------------------------------------------------------------

describe("parseDataUrlToBytes", () => {
  it("returns null for non-data-url strings", () => {
    expect(parseDataUrlToBytes("https://example.com/image.png")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseDataUrlToBytes("")).toBeNull();
  });

  it("returns null for malformed data URL (missing base64)", () => {
    expect(parseDataUrlToBytes("data:image/png;utf8,hello")).toBeNull();
  });

  it("parses a PNG data URL correctly", () => {
    // Create a minimal base64 payload (1x1 transparent PNG is complex, use simple bytes)
    const payload = btoa("test");
    const dataUrl = `data:image/png;base64,${payload}`;
    const result = parseDataUrlToBytes(dataUrl);
    expect(result).not.toBeNull();
    expect(result!.extension).toBe("png");
    expect(result!.bytes).toBeInstanceOf(Uint8Array);
    expect(result!.bytes.length).toBe(4); // "test" = 4 bytes
  });

  it("parses a JPEG data URL correctly", () => {
    const payload = btoa("jpeg-data");
    const dataUrl = `data:image/jpeg;base64,${payload}`;
    const result = parseDataUrlToBytes(dataUrl);
    expect(result).not.toBeNull();
    expect(result!.extension).toBe("jpg");
  });

  it("parses image/jpg as jpg extension", () => {
    const payload = btoa("x");
    const result = parseDataUrlToBytes(`data:image/jpg;base64,${payload}`);
    expect(result).not.toBeNull();
    expect(result!.extension).toBe("jpg");
  });

  it("parses SVG data URL", () => {
    const payload = btoa("<svg></svg>");
    const result = parseDataUrlToBytes(`data:image/svg+xml;base64,${payload}`);
    expect(result).not.toBeNull();
    expect(result!.extension).toBe("svg");
  });

  it("parses GIF data URL", () => {
    const payload = btoa("GIF89a");
    const result = parseDataUrlToBytes(`data:image/gif;base64,${payload}`);
    expect(result).not.toBeNull();
    expect(result!.extension).toBe("gif");
  });

  it("parses video/mp4 data URL", () => {
    const payload = btoa("video-data");
    const result = parseDataUrlToBytes(`data:video/mp4;base64,${payload}`);
    expect(result).not.toBeNull();
    expect(result!.extension).toBe("mp4");
  });

  it("parses audio/mpeg data URL as mp3", () => {
    const payload = btoa("audio-data");
    const result = parseDataUrlToBytes(`data:audio/mpeg;base64,${payload}`);
    expect(result).not.toBeNull();
    expect(result!.extension).toBe("mp3");
  });

  it("falls back to bin for unknown MIME types", () => {
    const payload = btoa("unknown");
    const result = parseDataUrlToBytes(`data:application/x-custom;base64,${payload}`);
    expect(result).not.toBeNull();
    expect(result!.extension).toBe("bin");
  });

  it("is case-insensitive for MIME type", () => {
    const payload = btoa("test");
    const result = parseDataUrlToBytes(`data:IMAGE/PNG;base64,${payload}`);
    expect(result).not.toBeNull();
    expect(result!.extension).toBe("png");
  });

  it("correctly decodes base64 content to bytes", () => {
    // "Hello" in base64 is "SGVsbG8="
    const dataUrl = "data:image/png;base64,SGVsbG8=";
    const result = parseDataUrlToBytes(dataUrl);
    expect(result).not.toBeNull();
    const decoded = new TextDecoder().decode(result!.bytes);
    expect(decoded).toBe("Hello");
  });

  it("parses webp data URL", () => {
    const payload = btoa("webp");
    const result = parseDataUrlToBytes(`data:image/webp;base64,${payload}`);
    expect(result).not.toBeNull();
    expect(result!.extension).toBe("webp");
  });
});
