import type {
  PptxSlideTransition,
  PptxSplitOrientation,
  PptxTransitionType,
  XmlObject,
} from "../types";
import type { IPptxXmlLookupService } from "./PptxXmlLookupService";
import {
  parseP14FromExtLst,
  buildP14ExtLst,
  P14_TRANSITION_TYPES,
} from "./p14-transition-parser";

const TRANSITION_TYPES: Set<string> = new Set([
  "fade",
  "push",
  "wipe",
  "split",
  "randomBar",
  "cut",
  "blinds",
  "checker",
  "circle",
  "comb",
  "cover",
  "diamond",
  "dissolve",
  "plus",
  "pull",
  "random",
  "strips",
  "uncover",
  "wedge",
  "wheel",
  "zoom",
  "newsflash",
  "morph",
]);

export interface PptxSlideTransitionServiceOptions {
  xmlLookupService: IPptxXmlLookupService;
  getXmlLocalName: (xmlKey: string) => string;
}

export interface IPptxSlideTransitionService {
  parseSlideTransition(
    slideXml: XmlObject | undefined,
  ): PptxSlideTransition | undefined;
  buildSlideTransitionXml(
    transition: PptxSlideTransition,
  ): XmlObject | undefined;
}

export class PptxSlideTransitionService implements IPptxSlideTransitionService {
  private readonly xmlLookupService: IPptxXmlLookupService;

  private readonly getXmlLocalName: (xmlKey: string) => string;

  public constructor(options: PptxSlideTransitionServiceOptions) {
    this.xmlLookupService = options.xmlLookupService;
    this.getXmlLocalName = options.getXmlLocalName;
  }

  public parseSlideTransition(
    slideXml: XmlObject | undefined,
  ): PptxSlideTransition | undefined {
    const slideRoot = this.xmlLookupService.getChildByLocalName(
      slideXml,
      "sld",
    );
    const transitionNode = this.xmlLookupService.getChildByLocalName(
      slideRoot,
      "transition",
    );
    if (!transitionNode) return undefined;

    let transitionType: PptxTransitionType = "cut";
    let direction: string | undefined;
    let orient: PptxSplitOrientation | undefined;
    let spokes: number | undefined;
    let pattern: string | undefined;
    let thruBlk: boolean | undefined;
    let rawSoundAction: XmlObject | undefined;
    let rawExtLst: XmlObject | undefined;

    for (const [key, value] of Object.entries(transitionNode)) {
      if (key.startsWith("@_")) continue;
      const localName = this.getXmlLocalName(key);
      if (localName === "sndAc") {
        rawSoundAction = value as XmlObject;
        continue;
      }
      if (localName === "extLst") {
        rawExtLst = value as XmlObject;
        continue;
      }

      if (TRANSITION_TYPES.has(localName)) {
        transitionType = localName as PptxTransitionType;
      }

      if (value && typeof value === "object" && !Array.isArray(value)) {
        const detail = value as XmlObject;

        // Direction attribute (@_dir)
        const rawDir = String(detail["@_dir"] || "").trim();
        if (rawDir.length > 0) {
          direction = rawDir;
        }

        // Orientation attribute (@_orient) for split/blinds/checker/comb/randomBar
        const rawOrient = String(detail["@_orient"] || "").trim();
        if (rawOrient === "horz" || rawOrient === "vert") {
          orient = rawOrient;
        }

        // Spokes count for wheel transition (@_spokes)
        const rawSpokes = String(detail["@_spokes"] || "").trim();
        if (rawSpokes.length > 0) {
          const parsedSpokes = Number.parseInt(rawSpokes, 10);
          if (
            Number.isFinite(parsedSpokes) &&
            parsedSpokes >= 1 &&
            parsedSpokes <= 8
          ) {
            spokes = parsedSpokes;
          }
        }

        // Pattern for shred transition (@_pattern)
        const rawPattern = String(detail["@_pattern"] || "").trim();
        if (rawPattern.length > 0) {
          pattern = rawPattern;
        }

        // Through-black flag (@_thruBlk) for blinds/checker
        const rawThruBlk = String(detail["@_thruBlk"] || "").trim();
        if (rawThruBlk.length > 0) {
          thruBlk = !["0", "false", "off"].includes(rawThruBlk.toLowerCase());
        }
      }
    }

    // Parse p14 (Office 2010+) transitions from extLst if no standard
    // transition type was found or if there is an extLst to parse
    if (rawExtLst && transitionType === "cut") {
      const p14Result = parseP14FromExtLst(
        rawExtLst,
        this.xmlLookupService,
        this.getXmlLocalName,
      );
      if (p14Result) {
        transitionType = p14Result.type;
        if (p14Result.direction) direction = p14Result.direction;
        if (p14Result.orient) orient = p14Result.orient;
        if (p14Result.pattern) pattern = p14Result.pattern;
      }
    }

    const parsedDuration = Number.parseInt(
      String(transitionNode["@_dur"] || ""),
      10,
    );
    const durationMs =
      Number.isFinite(parsedDuration) && parsedDuration > 0
        ? parsedDuration
        : undefined;

    const advanceOnClickToken = String(
      transitionNode["@_advClick"] || "",
    ).trim();
    const advanceOnClick =
      advanceOnClickToken.length > 0
        ? !["0", "false", "off"].includes(advanceOnClickToken.toLowerCase())
        : undefined;

    const parsedAdvanceAfter = Number.parseInt(
      String(transitionNode["@_advTm"] || ""),
      10,
    );
    const advanceAfterMs =
      Number.isFinite(parsedAdvanceAfter) && parsedAdvanceAfter >= 0
        ? parsedAdvanceAfter
        : undefined;

    // Extract sound relationship ID from rawSoundAction
    let soundRId: string | undefined;
    if (rawSoundAction) {
      const stSnd = this.xmlLookupService.getChildByLocalName(
        rawSoundAction,
        "stSnd",
      );
      if (stSnd) {
        const snd = this.xmlLookupService.getChildByLocalName(stSnd, "snd");
        if (snd) {
          const embed = snd["@_r:embed"] ?? snd["@_embed"];
          if (embed) soundRId = String(embed);
        }
      }
    }

    return {
      type: transitionType,
      direction,
      orient,
      spokes,
      pattern,
      thruBlk,
      durationMs,
      advanceOnClick,
      advanceAfterMs,
      soundRId,
      rawSoundAction,
      rawExtLst,
    };
  }

  public buildSlideTransitionXml(
    transition: PptxSlideTransition,
  ): XmlObject | undefined {
    if (!transition || transition.type === "none") {
      return undefined;
    }

    const transitionType = transition.type || "cut";
    const isP14Type = P14_TRANSITION_TYPES.has(transitionType);
    const node: XmlObject = {};

    if (isP14Type) {
      // p14 transitions are stored in the extLst, not as direct children
      node["p:extLst"] = buildP14ExtLst(
        transitionType,
        transition.direction,
        transition.orient,
        transition.pattern,
        transition.rawExtLst,
        this.xmlLookupService,
        this.getXmlLocalName,
      );
    } else if (transitionType !== "cut") {
      const childNode: XmlObject = {};
      const direction = String(transition.direction || "").trim();
      if (direction.length > 0) {
        childNode["@_dir"] = direction;
      }
      if (transition.orient) {
        childNode["@_orient"] = transition.orient;
      }
      if (typeof transition.spokes === "number" && transition.spokes >= 1) {
        childNode["@_spokes"] = String(transition.spokes);
      }
      if (transition.pattern) {
        childNode["@_pattern"] = transition.pattern;
      }
      if (typeof transition.thruBlk === "boolean") {
        childNode["@_thruBlk"] = transition.thruBlk ? "1" : "0";
      }
      node[`p:${transitionType}`] = childNode;
    } else {
      node["p:cut"] = {};
    }

    if (
      typeof transition.durationMs === "number" &&
      Number.isFinite(transition.durationMs) &&
      transition.durationMs > 0
    ) {
      node["@_dur"] = String(Math.round(transition.durationMs));
    }

    if (typeof transition.advanceOnClick === "boolean") {
      node["@_advClick"] = transition.advanceOnClick ? "1" : "0";
    }

    if (
      typeof transition.advanceAfterMs === "number" &&
      Number.isFinite(transition.advanceAfterMs) &&
      transition.advanceAfterMs >= 0
    ) {
      node["@_advTm"] = String(Math.round(transition.advanceAfterMs));
    }

    if (transition.rawSoundAction) {
      node["p:sndAc"] = transition.rawSoundAction;
    }
    // Only write rawExtLst for non-p14 types (p14 already built its own extLst)
    if (transition.rawExtLst && !isP14Type) {
      node["p:extLst"] = transition.rawExtLst;
    }

    return node;
  }
}
