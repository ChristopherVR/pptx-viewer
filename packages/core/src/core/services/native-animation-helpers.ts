/**
 * Helper functions extracted from PptxNativeAnimationService.
 * Provides XML parsing utilities for animation timing trees.
 */
import type {
  AnimationCondition,
  AnimationConditionEvent,
  PptxNativeAnimation,
  PptxTextBuildType,
  XmlObject,
} from "../types";

/**
 * Extract sound action (`p:stSnd` or `p:endSnd`) from a `p:cTn` node.
 */
export function extractSoundAction(cTn: XmlObject): {
  soundRId?: string;
  stopSound?: boolean;
} {
  const stSnd = cTn["p:stSnd"] as XmlObject | undefined;
  if (stSnd) {
    const snd = stSnd["p:snd"] as XmlObject | undefined;
    if (snd) {
      const embed = snd["@_r:embed"] ?? snd["@_embed"];
      if (embed) {
        return { soundRId: String(embed) };
      }
    }
  }

  if (cTn["p:endSnd"] !== undefined) {
    return { stopSound: true };
  }

  const childTnList = cTn["p:childTnLst"] as XmlObject | undefined;
  if (childTnList) {
    const childStSnd = childTnList["p:stSnd"] as XmlObject | undefined;
    if (childStSnd) {
      const snd = childStSnd["p:snd"] as XmlObject | undefined;
      if (snd) {
        const embed = snd["@_r:embed"] ?? snd["@_embed"];
        if (embed) {
          return { soundRId: String(embed) };
        }
      }
    }
    if (childTnList["p:endSnd"] !== undefined) {
      return { stopSound: true };
    }
  }

  return {};
}

export function extractChildMotionValues(childTnList: XmlObject | undefined): {
  motionPath?: string;
  motionOrigin?: string;
  rotationBy?: number;
  scaleByX?: number;
  scaleByY?: number;
} {
  let motionPath: string | undefined;
  let motionOrigin: string | undefined;
  let rotationBy: number | undefined;
  let scaleByX: number | undefined;
  let scaleByY: number | undefined;

  if (!childTnList) {
    return { motionPath, motionOrigin, rotationBy, scaleByX, scaleByY };
  }

  const motionNodes = ensureArray(childTnList["p:animMotion"]);
  for (const motionNode of motionNodes) {
    if (motionNode["@_path"] !== undefined) {
      motionPath = String(motionNode["@_path"]);
      motionOrigin = motionNode["@_origin"]
        ? String(motionNode["@_origin"])
        : undefined;
    }
  }

  const rotationNodes = ensureArray(childTnList["p:animRot"]);
  for (const rotationNode of rotationNodes) {
    if (rotationNode["@_by"] !== undefined) {
      rotationBy = Number.parseInt(String(rotationNode["@_by"]), 10) / 60000;
    }
  }

  const scaleNodes = ensureArray(childTnList["p:animScale"]);
  for (const scaleNode of scaleNodes) {
    const scaleBy = scaleNode["p:by"] as XmlObject | undefined;
    if (!scaleBy) continue;
    if (scaleBy["@_x"] !== undefined) {
      scaleByX = Number.parseInt(String(scaleBy["@_x"]), 10) / 100000;
    }
    if (scaleBy["@_y"] !== undefined) {
      scaleByY = Number.parseInt(String(scaleBy["@_y"]), 10) / 100000;
    }
  }

  return { motionPath, motionOrigin, rotationBy, scaleByX, scaleByY };
}

export function extractRepeatInfo(cTn: XmlObject): {
  repeatCount?: number;
  autoReverse?: boolean;
} {
  let repeatCount: number | undefined;
  let autoReverse: boolean | undefined;

  const rawRepeat = cTn["@_repeatCount"];
  if (rawRepeat !== undefined) {
    const repeatToken = String(rawRepeat);
    repeatCount =
      repeatToken === "indefinite"
        ? Infinity
        : Number.parseInt(repeatToken, 10) / 1000;
  }

  if (cTn["@_autoRev"] === "1" || cTn["@_autoRev"] === true) {
    autoReverse = true;
  }

  return { repeatCount, autoReverse };
}

export function extractAnimationTargetId(cTn: XmlObject): string | undefined {
  const childTnList = cTn["p:childTnLst"] as XmlObject | undefined;
  if (!childTnList) return undefined;

  const animationNodes = [
    ...ensureArray(childTnList["p:animEffect"]),
    ...ensureArray(childTnList["p:anim"]),
    ...ensureArray(childTnList["p:animMotion"]),
    ...ensureArray(childTnList["p:animRot"]),
    ...ensureArray(childTnList["p:animScale"]),
    ...ensureArray(childTnList["p:set"]),
  ];

  for (const animationNode of animationNodes) {
    const behavior = animationNode["p:cBhvr"] as XmlObject | undefined;
    const targetElement = behavior?.["p:tgtEl"] as XmlObject | undefined;
    const shapeTarget = targetElement?.["p:spTgt"] as XmlObject | undefined;
    if (shapeTarget?.["@_spid"]) {
      return String(shapeTarget["@_spid"]);
    }
  }

  const nestedParallels = ensureArray(childTnList["p:par"]);
  const nestedSequences = ensureArray(childTnList["p:seq"]);
  for (const nestedNode of [...nestedParallels, ...nestedSequences]) {
    const nestedCTn = nestedNode["p:cTn"] as XmlObject | undefined;
    if (!nestedCTn) continue;

    const nestedTarget = extractAnimationTargetId(nestedCTn);
    if (nestedTarget) return nestedTarget;
  }

  return undefined;
}

/**
 * Parse `p:bldLst` from the timing element and attach text-build info
 * to matching animations.
 */
export function applyBuildList(
  timing: XmlObject,
  animations: PptxNativeAnimation[],
): void {
  const bldLst = timing["p:bldLst"] as XmlObject | undefined;
  if (!bldLst) return;

  const bldPEntries = ensureArray(bldLst["p:bldP"]);
  for (const bldP of bldPEntries) {
    const spid =
      bldP["@_spid"] !== undefined ? String(bldP["@_spid"]) : undefined;
    if (!spid) continue;

    const buildType = parseBuildType(bldP["@_build"]);
    const groupId =
      bldP["@_grpId"] !== undefined ? String(bldP["@_grpId"]) : undefined;
    const bldLvl =
      bldP["@_bldLvl"] !== undefined
        ? Number.parseInt(String(bldP["@_bldLvl"]), 10)
        : undefined;

    for (const anim of animations) {
      if (anim.targetId === spid) {
        anim.buildType = buildType;
        anim.groupId = groupId;
        if (bldLvl !== undefined && !Number.isNaN(bldLvl)) {
          anim.buildLevel = bldLvl;
        }
      }
    }
  }
}

export function parseBuildType(value: unknown): PptxTextBuildType {
  if (!value) return "allAtOnce";
  const str = String(value).toLowerCase();
  if (str === "p" || str === "byparagraph") return "byParagraph";
  if (str === "word" || str === "byword") return "byWord";
  if (str === "char" || str === "bychar") return "byChar";
  return "allAtOnce";
}

/**
 * Extract trigger shape ID from a `p:cTn` node's start condition list.
 */
export function extractTriggerShapeId(cTn: XmlObject): string | undefined {
  const stCondList = cTn["p:stCondLst"] as XmlObject | undefined;
  if (!stCondList) return undefined;

  const conditions = ensureArray(stCondList["p:cond"]);
  for (const cond of conditions) {
    const evt = cond["@_evt"];
    if (evt !== "onClick") continue;

    const tgtEl = cond["p:tgtEl"] as XmlObject | undefined;
    if (!tgtEl) continue;

    const spTgt = tgtEl["p:spTgt"] as XmlObject | undefined;
    if (spTgt?.["@_spid"]) {
      return String(spTgt["@_spid"]);
    }
  }

  return undefined;
}

export function ensureArray(value: unknown): XmlObject[] {
  if (!value) return [];
  if (!Array.isArray(value)) {
    return isXmlObject(value) ? [value] : [];
  }
  return value.filter((entry): entry is XmlObject => isXmlObject(entry));
}

export function isXmlObject(value: unknown): value is XmlObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Known OOXML condition event values. */
const VALID_CONDITION_EVENTS = new Set<string>([
  "onBegin",
  "onEnd",
  "begin",
  "end",
  "onClick",
  "onMouseOver",
  "onMouseOut",
  "onNext",
  "onPrev",
  "onStopAudio",
]);

/**
 * Parse a single `p:cond` XML element into a structured {@link AnimationCondition}.
 *
 * Extracts the event type (`@_evt`), delay (`@_delay`), target time node
 * (`@_tn`), and target element information (`p:tgtEl`).
 */
export function parseCondition(condXml: XmlObject): AnimationCondition {
  const condition: AnimationCondition = {};

  // Event type
  const evt = condXml["@_evt"];
  if (evt !== undefined) {
    const evtStr = String(evt);
    if (VALID_CONDITION_EVENTS.has(evtStr)) {
      condition.event = evtStr as AnimationConditionEvent;
    }
  }

  // Delay
  const delay = condXml["@_delay"];
  if (delay !== undefined) {
    const delayStr = String(delay);
    condition.delay =
      delayStr === "indefinite" ? -1 : Number.parseInt(delayStr, 10);
  }

  // Target time node reference
  const tn = condXml["@_tn"];
  if (tn !== undefined) {
    const tnNum = Number.parseInt(String(tn), 10);
    if (!Number.isNaN(tnNum)) {
      condition.targetTimeNodeId = tnNum;
    }
  }

  // Target element
  const tgtEl = condXml["p:tgtEl"] as XmlObject | undefined;
  if (tgtEl) {
    const spTgt = tgtEl["p:spTgt"] as XmlObject | undefined;
    if (spTgt?.["@_spid"]) {
      condition.targetShapeId = String(spTgt["@_spid"]);
    }
    if (tgtEl["p:sldTgt"] !== undefined) {
      condition.targetSlide = true;
    }
  }

  return condition;
}

/**
 * Parse a `p:stCondLst` or `p:endCondLst` XML element into an array
 * of structured {@link AnimationCondition} objects.
 *
 * Returns `undefined` if the condition list is missing or empty.
 */
export function parseConditionList(
  condListXml: XmlObject | undefined,
): AnimationCondition[] | undefined {
  if (!condListXml) return undefined;

  const conditions = ensureArray(condListXml["p:cond"]);
  if (conditions.length === 0) return undefined;

  const result: AnimationCondition[] = [];
  for (const condXml of conditions) {
    result.push(parseCondition(condXml));
  }

  return result.length > 0 ? result : undefined;
}

/**
 * Serialize a single {@link AnimationCondition} back to an OOXML `p:cond`
 * XML object for round-trip fidelity.
 */
export function serializeCondition(condition: AnimationCondition): XmlObject {
  const condXml: XmlObject = {};

  if (condition.event !== undefined) {
    condXml["@_evt"] = condition.event;
  }

  if (condition.delay !== undefined) {
    condXml["@_delay"] = condition.delay === -1 ? "indefinite" : String(condition.delay);
  }

  if (condition.targetTimeNodeId !== undefined) {
    condXml["@_tn"] = String(condition.targetTimeNodeId);
  }

  // Target element
  if (condition.targetShapeId || condition.targetSlide) {
    const tgtEl: XmlObject = {};
    if (condition.targetShapeId) {
      tgtEl["p:spTgt"] = { "@_spid": condition.targetShapeId };
    }
    if (condition.targetSlide) {
      tgtEl["p:sldTgt"] = {};
    }
    condXml["p:tgtEl"] = tgtEl;
  }

  return condXml;
}

/**
 * Serialize an array of {@link AnimationCondition} objects back to an
 * OOXML condition list XML object (`p:stCondLst` or `p:endCondLst`).
 *
 * Returns `undefined` if the array is empty or `undefined`.
 */
export function serializeConditionList(
  conditions: AnimationCondition[] | undefined,
): XmlObject | undefined {
  if (!conditions || conditions.length === 0) return undefined;

  const serialized = conditions.map(serializeCondition);

  return {
    "p:cond": serialized.length === 1 ? serialized[0] : serialized,
  };
}
