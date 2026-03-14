import { describe, it, expect } from "vitest";
import { PptxXmlFactoryProvider } from "./PptxXmlFactoryProvider";
import { TextShapeXmlFactory } from "./TextShapeXmlFactory";
import { ConnectorXmlFactory } from "./ConnectorXmlFactory";
import { PictureXmlFactory } from "./PictureXmlFactory";
import { MediaGraphicFrameXmlFactory } from "./MediaGraphicFrameXmlFactory";
import type { PptxBuilderFactoryContext } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockContext(): PptxBuilderFactoryContext {
  let nextId = 1;
  return {
    emuPerPx: 9525,
    getNextId: () => nextId++,
    normalizePresetGeometry: (shapeType) => shapeType || "rect",
    toDrawingTextVerticalAlign: () => undefined,
  };
}

// ---------------------------------------------------------------------------
// PptxXmlFactoryProvider
// ---------------------------------------------------------------------------

describe("PptxXmlFactoryProvider", () => {
  it("creates a TextShapeXmlFactory from createTextShapeFactory", () => {
    const provider = new PptxXmlFactoryProvider();
    const factory = provider.createTextShapeFactory(createMockContext());
    expect(factory).toBeInstanceOf(TextShapeXmlFactory);
  });

  it("creates a ConnectorXmlFactory from createConnectorFactory", () => {
    const provider = new PptxXmlFactoryProvider();
    const factory = provider.createConnectorFactory(createMockContext());
    expect(factory).toBeInstanceOf(ConnectorXmlFactory);
  });

  it("creates a PictureXmlFactory from createPictureFactory", () => {
    const provider = new PptxXmlFactoryProvider();
    const factory = provider.createPictureFactory(createMockContext());
    expect(factory).toBeInstanceOf(PictureXmlFactory);
  });

  it("creates a MediaGraphicFrameXmlFactory from createMediaGraphicFrameFactory", () => {
    const provider = new PptxXmlFactoryProvider();
    const factory =
      provider.createMediaGraphicFrameFactory(createMockContext());
    expect(factory).toBeInstanceOf(MediaGraphicFrameXmlFactory);
  });

  it("creates independent factory instances per call", () => {
    const provider = new PptxXmlFactoryProvider();
    const ctx = createMockContext();
    const f1 = provider.createTextShapeFactory(ctx);
    const f2 = provider.createTextShapeFactory(ctx);
    expect(f1).not.toBe(f2);
  });

  it("created text factory produces valid XML", () => {
    const provider = new PptxXmlFactoryProvider();
    const factory = provider.createTextShapeFactory(createMockContext());
    const result = factory.createXmlElement({
      element: {
        type: "text",
        id: "t1",
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        text: "test",
      } as any,
    });
    expect(result["p:nvSpPr"]).toBeDefined();
    expect(result["p:spPr"]).toBeDefined();
    expect(result["p:txBody"]).toBeDefined();
  });

  it("created connector factory produces valid XML", () => {
    const provider = new PptxXmlFactoryProvider();
    const factory = provider.createConnectorFactory(createMockContext());
    const result = factory.createXmlElement({
      element: {
        type: "connector",
        id: "c1",
        x: 0,
        y: 0,
        width: 100,
        height: 0,
      } as any,
    });
    expect(result["p:nvCxnSpPr"]).toBeDefined();
    expect(result["p:spPr"]).toBeDefined();
  });

  it("created picture factory produces valid XML", () => {
    const provider = new PptxXmlFactoryProvider();
    const factory = provider.createPictureFactory(createMockContext());
    const result = factory.createXmlElement({
      element: {
        type: "image",
        id: "i1",
        x: 0,
        y: 0,
        width: 100,
        height: 75,
      } as any,
      relationshipId: "rId1",
    });
    expect(result["p:nvPicPr"]).toBeDefined();
    expect(result["p:blipFill"]).toBeDefined();
    expect(result["p:spPr"]).toBeDefined();
  });

  it("created media factory produces valid XML", () => {
    const provider = new PptxXmlFactoryProvider();
    const factory =
      provider.createMediaGraphicFrameFactory(createMockContext());
    const result = factory.createXmlElement({
      element: {
        type: "media",
        id: "m1",
        x: 0,
        y: 0,
        width: 320,
        height: 240,
        mediaType: "video",
      } as any,
      relationshipId: "rId3",
    });
    expect(result["p:nvGraphicFramePr"]).toBeDefined();
    expect(result["a:graphic"]).toBeDefined();
  });
});
