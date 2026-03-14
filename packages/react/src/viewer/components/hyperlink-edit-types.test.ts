import { describe, it, expect } from "vitest";
import {
  ACTION_VERB_MAP,
  ACTION_VERB_TO_PPACTION,
} from "./hyperlink-edit-types";
import type { HyperlinkActionVerb } from "./hyperlink-edit-types";

// ---------------------------------------------------------------------------
// ACTION_VERB_MAP
// ---------------------------------------------------------------------------

describe("ACTION_VERB_MAP", () => {
  it("is a non-empty object", () => {
    expect(typeof ACTION_VERB_MAP).toBe("object");
    expect(Object.keys(ACTION_VERB_MAP).length).toBeGreaterThan(0);
  });

  it("has 5 entries", () => {
    expect(Object.keys(ACTION_VERB_MAP)).toHaveLength(5);
  });

  it("maps nextslide ppaction to nextSlide verb", () => {
    expect(
      ACTION_VERB_MAP["ppaction://hlinkshowjump?jump=nextslide"],
    ).toBe("nextSlide");
  });

  it("maps previousslide ppaction to prevSlide verb", () => {
    expect(
      ACTION_VERB_MAP["ppaction://hlinkshowjump?jump=previousslide"],
    ).toBe("prevSlide");
  });

  it("maps firstslide ppaction to firstSlide verb", () => {
    expect(
      ACTION_VERB_MAP["ppaction://hlinkshowjump?jump=firstslide"],
    ).toBe("firstSlide");
  });

  it("maps lastslide ppaction to lastSlide verb", () => {
    expect(
      ACTION_VERB_MAP["ppaction://hlinkshowjump?jump=lastslide"],
    ).toBe("lastSlide");
  });

  it("maps endshow ppaction to endShow verb", () => {
    expect(
      ACTION_VERB_MAP["ppaction://hlinkshowjump?jump=endshow"],
    ).toBe("endShow");
  });

  it("all keys start with ppaction://", () => {
    for (const key of Object.keys(ACTION_VERB_MAP)) {
      expect(key.startsWith("ppaction://")).toBe(true);
    }
  });

  it("all values are valid HyperlinkActionVerb strings", () => {
    const validVerbs = new Set<HyperlinkActionVerb>([
      "nextSlide",
      "prevSlide",
      "firstSlide",
      "lastSlide",
      "endShow",
    ]);
    for (const verb of Object.values(ACTION_VERB_MAP)) {
      expect(validVerbs.has(verb)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// ACTION_VERB_TO_PPACTION
// ---------------------------------------------------------------------------

describe("ACTION_VERB_TO_PPACTION", () => {
  it("is a non-empty object", () => {
    expect(typeof ACTION_VERB_TO_PPACTION).toBe("object");
    expect(Object.keys(ACTION_VERB_TO_PPACTION).length).toBeGreaterThan(0);
  });

  it("has 5 entries", () => {
    expect(Object.keys(ACTION_VERB_TO_PPACTION)).toHaveLength(5);
  });

  it("maps nextSlide to correct ppaction", () => {
    expect(ACTION_VERB_TO_PPACTION.nextSlide).toBe(
      "ppaction://hlinkshowjump?jump=nextslide",
    );
  });

  it("maps prevSlide to correct ppaction", () => {
    expect(ACTION_VERB_TO_PPACTION.prevSlide).toBe(
      "ppaction://hlinkshowjump?jump=previousslide",
    );
  });

  it("maps firstSlide to correct ppaction", () => {
    expect(ACTION_VERB_TO_PPACTION.firstSlide).toBe(
      "ppaction://hlinkshowjump?jump=firstslide",
    );
  });

  it("maps lastSlide to correct ppaction", () => {
    expect(ACTION_VERB_TO_PPACTION.lastSlide).toBe(
      "ppaction://hlinkshowjump?jump=lastslide",
    );
  });

  it("maps endShow to correct ppaction", () => {
    expect(ACTION_VERB_TO_PPACTION.endShow).toBe(
      "ppaction://hlinkshowjump?jump=endshow",
    );
  });

  it("all values start with ppaction://", () => {
    for (const value of Object.values(ACTION_VERB_TO_PPACTION)) {
      expect(value.startsWith("ppaction://")).toBe(true);
    }
  });

  it("ACTION_VERB_MAP and ACTION_VERB_TO_PPACTION are inverses", () => {
    // For every entry in VERB_MAP, the reverse lookup should match
    for (const [ppaction, verb] of Object.entries(ACTION_VERB_MAP)) {
      expect(ACTION_VERB_TO_PPACTION[verb]).toBe(ppaction);
    }
    // For every entry in VERB_TO_PPACTION, the reverse lookup should match
    for (const [verb, ppaction] of Object.entries(ACTION_VERB_TO_PPACTION)) {
      expect(ACTION_VERB_MAP[ppaction]).toBe(verb);
    }
  });
});
