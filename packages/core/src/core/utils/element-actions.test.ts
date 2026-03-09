import { describe, it, expect } from "vitest";
import {
  pptxActionToElementAction,
  elementActionToPptxAction,
  elementHasAction,
} from "./element-actions";
import type { PptxAction, ElementAction, PptxElement } from "../types";

// ---------------------------------------------------------------------------
// pptxActionToElementAction
// ---------------------------------------------------------------------------

describe("pptxActionToElementAction", () => {
  it("returns slide action for hlinksldjump with targetSlideIndex", () => {
    const pptxAction: PptxAction = {
      action: "ppaction://hlinksldjump",
      targetSlideIndex: 3,
    };
    const result = pptxActionToElementAction(pptxAction, "click");
    expect(result).toEqual({ trigger: "click", type: "slide", slideIndex: 3 });
  });

  it("returns nextSlide for hlinkshowjump?jump=nextslide", () => {
    const pptxAction: PptxAction = {
      action: "ppaction://hlinkshowjump?jump=nextslide",
    };
    const result = pptxActionToElementAction(pptxAction, "click");
    expect(result).toEqual({ trigger: "click", type: "nextSlide" });
  });

  it("returns prevSlide for hlinkshowjump?jump=previousslide", () => {
    const pptxAction: PptxAction = {
      action: "ppaction://hlinkshowjump?jump=previousslide",
    };
    const result = pptxActionToElementAction(pptxAction, "hover");
    expect(result).toEqual({ trigger: "hover", type: "prevSlide" });
  });

  it("returns firstSlide for hlinkshowjump?jump=firstslide", () => {
    const pptxAction: PptxAction = {
      action: "ppaction://hlinkshowjump?jump=firstslide",
    };
    const result = pptxActionToElementAction(pptxAction, "click");
    expect(result).toEqual({ trigger: "click", type: "firstSlide" });
  });

  it("returns lastSlide for hlinkshowjump?jump=lastslide", () => {
    const pptxAction: PptxAction = {
      action: "ppaction://hlinkshowjump?jump=lastslide",
    };
    const result = pptxActionToElementAction(pptxAction, "click");
    expect(result).toEqual({ trigger: "click", type: "lastSlide" });
  });

  it("returns endShow for hlinkshowjump?jump=endshow", () => {
    const pptxAction: PptxAction = {
      action: "ppaction://hlinkshowjump?jump=endshow",
    };
    const result = pptxActionToElementAction(pptxAction, "click");
    expect(result).toEqual({ trigger: "click", type: "endShow" });
  });

  it("returns url action for external URL without hlinksldjump", () => {
    const pptxAction: PptxAction = {
      url: "https://example.com",
      action: "",
    };
    const result = pptxActionToElementAction(pptxAction, "click");
    expect(result).toEqual({
      trigger: "click",
      type: "url",
      url: "https://example.com",
    });
  });

  it("returns none action for empty action with no url", () => {
    const pptxAction: PptxAction = {};
    const result = pptxActionToElementAction(pptxAction, "click");
    expect(result).toEqual({ trigger: "click", type: "none" });
  });

  it("ignores url when action is hlinksldjump but targetSlideIndex is missing", () => {
    const pptxAction: PptxAction = {
      action: "ppaction://hlinksldjump",
      url: "https://example.com",
    };
    const result = pptxActionToElementAction(pptxAction, "click");
    expect(result).toEqual({ trigger: "click", type: "none" });
  });

  it("is case-insensitive for action string", () => {
    const pptxAction: PptxAction = {
      action: "ppaction://HLINKSLDJUMP",
      targetSlideIndex: 0,
    };
    const result = pptxActionToElementAction(pptxAction, "click");
    expect(result).toEqual({ trigger: "click", type: "slide", slideIndex: 0 });
  });
});

// ---------------------------------------------------------------------------
// elementActionToPptxAction
// ---------------------------------------------------------------------------

describe("elementActionToPptxAction", () => {
  it("returns undefined for none action", () => {
    const ea: ElementAction = { trigger: "click", type: "none" };
    expect(elementActionToPptxAction(ea)).toBeUndefined();
  });

  it("returns url PptxAction for url type", () => {
    const ea: ElementAction = {
      trigger: "click",
      type: "url",
      url: "https://example.com",
    };
    const result = elementActionToPptxAction(ea);
    expect(result).toEqual({ url: "https://example.com" });
  });

  it("returns slide PptxAction for slide type", () => {
    const ea: ElementAction = {
      trigger: "click",
      type: "slide",
      slideIndex: 5,
    };
    const result = elementActionToPptxAction(ea);
    expect(result).toEqual({
      action: "ppaction://hlinksldjump",
      targetSlideIndex: 5,
    });
  });

  it("returns firstSlide PptxAction", () => {
    const ea: ElementAction = { trigger: "click", type: "firstSlide" };
    const result = elementActionToPptxAction(ea);
    expect(result).toEqual({
      action: "ppaction://hlinkshowjump?jump=firstslide",
    });
  });

  it("returns lastSlide PptxAction", () => {
    const ea: ElementAction = { trigger: "click", type: "lastSlide" };
    const result = elementActionToPptxAction(ea);
    expect(result).toEqual({
      action: "ppaction://hlinkshowjump?jump=lastslide",
    });
  });

  it("returns nextSlide PptxAction", () => {
    const ea: ElementAction = { trigger: "click", type: "nextSlide" };
    const result = elementActionToPptxAction(ea);
    expect(result).toEqual({
      action: "ppaction://hlinkshowjump?jump=nextslide",
    });
  });

  it("returns prevSlide PptxAction", () => {
    const ea: ElementAction = { trigger: "click", type: "prevSlide" };
    const result = elementActionToPptxAction(ea);
    expect(result).toEqual({
      action: "ppaction://hlinkshowjump?jump=previousslide",
    });
  });

  it("returns endShow PptxAction", () => {
    const ea: ElementAction = { trigger: "click", type: "endShow" };
    const result = elementActionToPptxAction(ea);
    expect(result).toEqual({
      action: "ppaction://hlinkshowjump?jump=endshow",
    });
  });
});

// ---------------------------------------------------------------------------
// elementHasAction
// ---------------------------------------------------------------------------

describe("elementHasAction", () => {
  it("returns true when element has actionClick", () => {
    const element = { actionClick: { action: "ppaction://hlinksldjump" } } as unknown as PptxElement;
    expect(elementHasAction(element)).toBe(true);
  });

  it("returns true when element has actionHover", () => {
    const element = { actionHover: { url: "https://example.com" } } as unknown as PptxElement;
    expect(elementHasAction(element)).toBe(true);
  });

  it("returns false when element has no actions", () => {
    const element = {} as unknown as PptxElement;
    expect(elementHasAction(element)).toBe(false);
  });

  it("returns false when actions are undefined", () => {
    const element = { actionClick: undefined, actionHover: undefined } as unknown as PptxElement;
    expect(elementHasAction(element)).toBe(false);
  });

  it("returns true when both click and hover actions exist", () => {
    const element = {
      actionClick: { action: "ppaction://hlinksldjump" },
      actionHover: { url: "https://example.com" },
    } as unknown as PptxElement;
    expect(elementHasAction(element)).toBe(true);
  });

  it("returns false for null-ish action values", () => {
    const element = { actionClick: null, actionHover: null } as unknown as PptxElement;
    expect(elementHasAction(element)).toBe(false);
  });
});
