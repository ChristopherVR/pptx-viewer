import { describe, it, expect } from "vitest";
import JSZip from "jszip";

// ---------------------------------------------------------------------------
// Extracted logic from PptxHandlerRuntimeDocProperties.parseThumbnail()
// and PptxHandlerRuntimeSaveDocumentParts.applyThumbnailPreservation()
// ---------------------------------------------------------------------------

/**
 * Mirrors `parseThumbnail` — reads the first matching thumbnail path
 * from the ZIP and returns its binary content.
 */
async function parseThumbnail(zip: JSZip): Promise<Uint8Array | null> {
  const candidates = [
    "docProps/thumbnail.jpeg",
    "docProps/thumbnail.jpg",
    "docProps/thumbnail.png",
    "docProps/thumbnail.emf",
  ];
  for (const path of candidates) {
    const file = zip.file(path);
    if (file) {
      try {
        return await file.async("uint8array");
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Mirrors `applyThumbnailPreservation` — writes the thumbnail data
 * back into the ZIP at the correct path.
 */
function applyThumbnailPreservation(
  zip: JSZip,
  thumbnailData: Uint8Array | null,
): void {
  if (!thumbnailData) return;

  const candidates = [
    "docProps/thumbnail.jpeg",
    "docProps/thumbnail.jpg",
    "docProps/thumbnail.png",
    "docProps/thumbnail.emf",
  ];
  let targetPath = "docProps/thumbnail.jpeg";
  for (const path of candidates) {
    if (zip.file(path)) {
      targetPath = path;
      break;
    }
  }

  zip.file(targetPath, thumbnailData);
}

// ---------------------------------------------------------------------------
// Tests: parseThumbnail
// ---------------------------------------------------------------------------
describe("parseThumbnail", () => {
  it("should read thumbnail.jpeg when present", async () => {
    const zip = new JSZip();
    const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    zip.file("docProps/thumbnail.jpeg", fakeJpeg);

    const result = await parseThumbnail(zip);
    expect(result).not.toBeNull();
    expect(result).toEqual(fakeJpeg);
  });

  it("should read thumbnail.jpg as fallback", async () => {
    const zip = new JSZip();
    const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe1]);
    zip.file("docProps/thumbnail.jpg", fakeJpeg);

    const result = await parseThumbnail(zip);
    expect(result).not.toBeNull();
    expect(result).toEqual(fakeJpeg);
  });

  it("should read thumbnail.png as fallback", async () => {
    const zip = new JSZip();
    const fakePng = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    zip.file("docProps/thumbnail.png", fakePng);

    const result = await parseThumbnail(zip);
    expect(result).not.toBeNull();
    expect(result).toEqual(fakePng);
  });

  it("should read thumbnail.emf as fallback", async () => {
    const zip = new JSZip();
    const fakeEmf = new Uint8Array([0x01, 0x00, 0x00, 0x00]);
    zip.file("docProps/thumbnail.emf", fakeEmf);

    const result = await parseThumbnail(zip);
    expect(result).not.toBeNull();
    expect(result).toEqual(fakeEmf);
  });

  it("should return null when no thumbnail exists", async () => {
    const zip = new JSZip();
    const result = await parseThumbnail(zip);
    expect(result).toBeNull();
  });

  it("should prefer .jpeg over .jpg when both exist", async () => {
    const zip = new JSZip();
    const jpegData = new Uint8Array([0xff, 0xd8, 0x01]);
    const jpgData = new Uint8Array([0xff, 0xd8, 0x02]);
    zip.file("docProps/thumbnail.jpeg", jpegData);
    zip.file("docProps/thumbnail.jpg", jpgData);

    const result = await parseThumbnail(zip);
    expect(result).toEqual(jpegData);
  });

  it("should ignore non-thumbnail files in docProps", async () => {
    const zip = new JSZip();
    zip.file("docProps/app.xml", "<Properties/>");
    zip.file("docProps/core.xml", "<cp:coreProperties/>");

    const result = await parseThumbnail(zip);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: applyThumbnailPreservation
// ---------------------------------------------------------------------------
describe("applyThumbnailPreservation", () => {
  it("should write thumbnail data to docProps/thumbnail.jpeg by default", () => {
    const zip = new JSZip();
    const data = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

    applyThumbnailPreservation(zip, data);

    const file = zip.file("docProps/thumbnail.jpeg");
    expect(file).not.toBeNull();
  });

  it("should not write anything when thumbnailData is null", () => {
    const zip = new JSZip();

    applyThumbnailPreservation(zip, null);

    expect(zip.file("docProps/thumbnail.jpeg")).toBeNull();
    expect(zip.file("docProps/thumbnail.jpg")).toBeNull();
    expect(zip.file("docProps/thumbnail.png")).toBeNull();
    expect(zip.file("docProps/thumbnail.emf")).toBeNull();
  });

  it("should preserve the original path when .png existed", () => {
    const zip = new JSZip();
    zip.file("docProps/thumbnail.png", new Uint8Array([0x89]));
    const newData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

    applyThumbnailPreservation(zip, newData);

    const file = zip.file("docProps/thumbnail.png");
    expect(file).not.toBeNull();
  });

  it("should preserve the original path when .emf existed", () => {
    const zip = new JSZip();
    zip.file("docProps/thumbnail.emf", new Uint8Array([0x01]));
    const newData = new Uint8Array([0x01, 0x00, 0x00, 0x00]);

    applyThumbnailPreservation(zip, newData);

    const file = zip.file("docProps/thumbnail.emf");
    expect(file).not.toBeNull();
  });

  it("should prefer .jpeg path over .jpg when both exist", () => {
    const zip = new JSZip();
    zip.file("docProps/thumbnail.jpeg", new Uint8Array([0x01]));
    zip.file("docProps/thumbnail.jpg", new Uint8Array([0x02]));
    const newData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

    applyThumbnailPreservation(zip, newData);

    // Should write to .jpeg (first match)
    const file = zip.file("docProps/thumbnail.jpeg");
    expect(file).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: round-trip preservation
// ---------------------------------------------------------------------------
describe("thumbnail round-trip", () => {
  it("should preserve exact binary data through parse then save cycle", async () => {
    const zip = new JSZip();
    const originalData = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
    ]);
    zip.file("docProps/thumbnail.jpeg", originalData);

    // Simulate load
    const loaded = await parseThumbnail(zip);
    expect(loaded).not.toBeNull();

    // Simulate save to a fresh zip
    const outputZip = new JSZip();
    outputZip.file("docProps/thumbnail.jpeg", new Uint8Array([]));
    applyThumbnailPreservation(outputZip, loaded);

    const outputFile = outputZip.file("docProps/thumbnail.jpeg");
    expect(outputFile).not.toBeNull();
    const outputData = await outputFile!.async("uint8array");
    expect(outputData).toEqual(originalData);
  });

  it("should handle large thumbnail data", async () => {
    const zip = new JSZip();
    const largeData = new Uint8Array(100 * 1024);
    for (let i = 0; i < largeData.length; i++) {
      largeData[i] = i % 256;
    }
    zip.file("docProps/thumbnail.jpeg", largeData);

    const loaded = await parseThumbnail(zip);
    expect(loaded).not.toBeNull();
    expect(loaded!.length).toBe(100 * 1024);

    const outputZip = new JSZip();
    applyThumbnailPreservation(outputZip, loaded);

    const outputFile = outputZip.file("docProps/thumbnail.jpeg");
    const outputData = await outputFile!.async("uint8array");
    expect(outputData).toEqual(largeData);
  });

  it("should round-trip a PNG thumbnail at its original path", async () => {
    const zip = new JSZip();
    const pngData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    zip.file("docProps/thumbnail.png", pngData);

    // Load
    const loaded = await parseThumbnail(zip);
    expect(loaded).toEqual(pngData);

    // Save — the zip still has the .png entry, so preservation targets .png
    applyThumbnailPreservation(zip, loaded);

    const outputFile = zip.file("docProps/thumbnail.png");
    expect(outputFile).not.toBeNull();
    const outputData = await outputFile!.async("uint8array");
    expect(outputData).toEqual(pngData);
  });
});
