import { describe, it, expect, vi } from "vitest";
import { createStructuredElementHandlers } from "./insert-structured-elements";
import type { PptxElement, PptxSlide, SmartArtLayout } from "pptx-viewer-core";
import type { StructuredElementDeps } from "./insert-structured-elements";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDeps(overrides: Partial<StructuredElementDeps> = {}): StructuredElementDeps {
  return {
    activeSlide: {
      id: "slide1",
      rId: "rId1",
      slideNumber: 1,
      elements: [],
    } as PptxSlide,
    activeSlideIndex: 0,
    selectedElements: [],
    ops: { updateElementById: vi.fn() } as any,
    history: { markDirty: vi.fn() } as any,
    addElement: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// handleInsertSmartArt
// ---------------------------------------------------------------------------

describe("handleInsertSmartArt", () => {
  it("creates a smartArt element with the given layout and items", () => {
    const deps = makeDeps();
    const handlers = createStructuredElementHandlers(deps);

    handlers.handleInsertSmartArt("list", ["Item 1", "Item 2", "Item 3"]);

    expect(deps.addElement).toHaveBeenCalledTimes(1);
    const el = (deps.addElement as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(el.type).toBe("smartArt");
    expect(el.smartArtData.layout).toBe("list");
    expect(el.smartArtData.nodes).toHaveLength(3);
    expect(el.smartArtData.nodes[0].text).toBe("Item 1");
    expect(el.smartArtData.nodes[1].text).toBe("Item 2");
    expect(el.smartArtData.nodes[2].text).toBe("Item 3");
  });

  it("sets parentId for hierarchy layout on non-first nodes", () => {
    const deps = makeDeps();
    const handlers = createStructuredElementHandlers(deps);

    handlers.handleInsertSmartArt("hierarchy", ["Root", "Child 1", "Child 2"]);

    const el = (deps.addElement as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const nodes = el.smartArtData.nodes;
    expect(nodes[0].parentId).toBeUndefined();
    expect(nodes[1].parentId).toBe(nodes[0].id);
    expect(nodes[2].parentId).toBe(nodes[0].id);
  });

  it("does not set parentId for non-hierarchy layouts", () => {
    const deps = makeDeps();
    const handlers = createStructuredElementHandlers(deps);

    handlers.handleInsertSmartArt("cycle", ["A", "B"]);

    const el = (deps.addElement as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(el.smartArtData.nodes[0].parentId).toBeUndefined();
    expect(el.smartArtData.nodes[1].parentId).toBeUndefined();
  });

  it("does not call addElement when activeSlide is undefined", () => {
    const deps = makeDeps({ activeSlide: undefined });
    const handlers = createStructuredElementHandlers(deps);

    handlers.handleInsertSmartArt("list", ["Item"]);

    expect(deps.addElement).not.toHaveBeenCalled();
  });

  it("assigns unique node ids", () => {
    const deps = makeDeps();
    const handlers = createStructuredElementHandlers(deps);

    handlers.handleInsertSmartArt("list", ["A", "B", "C"]);

    const el = (deps.addElement as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const ids = el.smartArtData.nodes.map((n: any) => n.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("sets correct dimensions and position", () => {
    const deps = makeDeps();
    const handlers = createStructuredElementHandlers(deps);

    handlers.handleInsertSmartArt("list", ["A"]);

    const el = (deps.addElement as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(el.x).toBe(100);
    expect(el.y).toBe(120);
    expect(el.width).toBe(600);
    expect(el.height).toBe(340);
  });
});

// ---------------------------------------------------------------------------
// handleInsertEquation
// ---------------------------------------------------------------------------

describe("handleInsertEquation", () => {
  it("creates a shape element with equation metadata", () => {
    const deps = makeDeps();
    const handlers = createStructuredElementHandlers(deps);

    const omml = { "m:oMath": { "m:r": { "m:t": "x" } } };
    handlers.handleInsertEquation(omml);

    expect(deps.addElement).toHaveBeenCalledTimes(1);
    const el = (deps.addElement as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(el.type).toBe("shape");
    expect(el.text).toBe("[Equation]");
    expect(el.textStyle.fontFamily).toBe("Cambria Math");
    expect(el.textSegments[0].equationXml).toBe(omml);
  });

  it("does not call addElement when activeSlide is undefined", () => {
    const deps = makeDeps({ activeSlide: undefined });
    const handlers = createStructuredElementHandlers(deps);

    handlers.handleInsertEquation({});

    expect(deps.addElement).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleInsertField
// ---------------------------------------------------------------------------

describe("handleInsertField", () => {
  it("creates a shape element for slidenum field", () => {
    const deps = makeDeps({ activeSlideIndex: 2 });
    const handlers = createStructuredElementHandlers(deps);

    handlers.handleInsertField("slidenum");

    const el = (deps.addElement as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(el.type).toBe("shape");
    expect(el.text).toBe("3"); // slideIndex 2 + 1
    expect(el.textSegments[0].fieldType).toBe("slidenum");
    expect(el.textSegments[0].fieldGuid).toBeTruthy();
  });

  it("creates a shape element for header field with default text", () => {
    const deps = makeDeps();
    const handlers = createStructuredElementHandlers(deps);

    handlers.handleInsertField("header");

    const el = (deps.addElement as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(el.text).toBe("Header");
  });

  it("creates a shape element for footer field", () => {
    const deps = makeDeps();
    const handlers = createStructuredElementHandlers(deps);

    handlers.handleInsertField("footer");

    const el = (deps.addElement as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(el.text).toBe("Footer");
  });

  it("uses fieldType as display text for unknown field types", () => {
    const deps = makeDeps();
    const handlers = createStructuredElementHandlers(deps);

    handlers.handleInsertField("customField");

    const el = (deps.addElement as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(el.text).toBe("customField");
  });

  it("does not call addElement when activeSlide is undefined", () => {
    const deps = makeDeps({ activeSlide: undefined });
    const handlers = createStructuredElementHandlers(deps);

    handlers.handleInsertField("slidenum");

    expect(deps.addElement).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleAddActionButton
// ---------------------------------------------------------------------------

describe("handleAddActionButton", () => {
  it("creates a shape for a known action button preset", () => {
    const deps = makeDeps();
    const handlers = createStructuredElementHandlers(deps);

    handlers.handleAddActionButton("actionButtonForwardNext");

    expect(deps.addElement).toHaveBeenCalledTimes(1);
    const el = (deps.addElement as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(el.type).toBe("shape");
    expect(el.shapeType).toBe("actionButtonForwardNext");
    expect(el.shapeStyle.fillColor).toBe("#4472C4");
    expect(el.actionClick).toBeDefined();
  });

  it("does not call addElement for unknown shape type", () => {
    const deps = makeDeps();
    const handlers = createStructuredElementHandlers(deps);

    handlers.handleAddActionButton("unknownButton");

    expect(deps.addElement).not.toHaveBeenCalled();
  });

  it("does not call addElement when activeSlide is undefined", () => {
    const deps = makeDeps({ activeSlide: undefined });
    const handlers = createStructuredElementHandlers(deps);

    handlers.handleAddActionButton("actionButtonBackPrevious");

    expect(deps.addElement).not.toHaveBeenCalled();
  });

  it("creates action button with correct position and dimensions", () => {
    const deps = makeDeps();
    const handlers = createStructuredElementHandlers(deps);

    handlers.handleAddActionButton("actionButtonBackPrevious");

    const el = (deps.addElement as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(el.x).toBe(150);
    expect(el.y).toBe(150);
    expect(el.width).toBe(80);
    expect(el.height).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// handleHyperlinkConfirm
// ---------------------------------------------------------------------------

describe("handleHyperlinkConfirm", () => {
  it("does nothing when no element is selected", () => {
    const deps = makeDeps({ selectedElements: [] });
    const handlers = createStructuredElementHandlers(deps);

    handlers.handleHyperlinkConfirm({
      targetType: "url",
      url: "https://example.com",
      tooltip: "",
      emailAddress: "",
      emailSubject: "",
      slideNumber: 1,
      filePath: "",
      actionVerb: "none",
    });

    expect(deps.ops.updateElementById).not.toHaveBeenCalled();
  });

  it("updates the selected element with hyperlink action when element exists", () => {
    const selected = { id: "el1", type: "shape", x: 0, y: 0, width: 100, height: 50 } as PptxElement;
    const deps = makeDeps({ selectedElements: [selected] });
    const handlers = createStructuredElementHandlers(deps);

    handlers.handleHyperlinkConfirm({
      targetType: "url",
      url: "https://example.com",
      tooltip: "Click me",
      emailAddress: "",
      emailSubject: "",
      slideNumber: 1,
      filePath: "",
      actionVerb: "none",
    });

    expect(deps.ops.updateElementById).toHaveBeenCalledTimes(1);
    expect(deps.history.markDirty).toHaveBeenCalledTimes(1);
    const call = (deps.ops.updateElementById as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("el1");
    expect(call[1].actionClick).toBeDefined();
  });
});
