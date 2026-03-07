import type {
  PptxAnimationTrigger,
  PptxNativeAnimation,
  PptxTextAnimationTarget,
  XmlObject,
} from "../types";
import {
  extractSoundAction,
  extractChildMotionValues,
  extractRepeatInfo,
  extractAnimationTargetId,
  applyBuildList,
  extractTriggerShapeId,
  ensureArray,
} from "./native-animation-helpers";
import {
  extractColorAnimation,
  extractTextTarget,
  extractIterate,
  extractCommand,
} from "./native-animation-extended-helpers";

export interface IPptxNativeAnimationService {
  parseNativeAnimations(slideXml: XmlObject): PptxNativeAnimation[] | undefined;
}

export class PptxNativeAnimationService implements IPptxNativeAnimationService {
  public parseNativeAnimations(
    slideXml: XmlObject,
  ): PptxNativeAnimation[] | undefined {
    try {
      const timing = slideXml?.["p:sld"]?.["p:timing"];
      if (!timing || typeof timing !== "object") return undefined;

      const tnLst = (timing as XmlObject)["p:tnLst"];
      if (!tnLst || typeof tnLst !== "object") return undefined;

      const animations: PptxNativeAnimation[] = [];
      const rootPar = (tnLst as XmlObject)["p:par"];
      if (!rootPar || typeof rootPar !== "object") return undefined;

      this.walkTimingTree(rootPar as XmlObject, animations, "onClick");

      // Parse interactive sequences (sibling p:seq nodes with trigger shape)
      this.parseInteractiveSequences(rootPar as XmlObject, animations);

      // Parse p:bldLst to attach text build info to animations
      applyBuildList(timing as XmlObject, animations);

      return animations.length > 0 ? animations : undefined;
    } catch (error) {
      console.warn("Failed to parse native animations:", error);
      return undefined;
    }
  }

  private walkTimingTree(
    node: XmlObject,
    animations: PptxNativeAnimation[],
    currentTrigger: PptxAnimationTrigger,
  ): void {
    if (!node) return;

    const cTn = node["p:cTn"] as XmlObject | undefined;
    if (cTn) {
      const nodeType = String(cTn["@_nodeType"] || "");
      const presetClass = cTn["@_presetClass"] as string | undefined;
      const presetId = cTn["@_presetID"]
        ? Number.parseInt(String(cTn["@_presetID"]), 10)
        : undefined;
      const durationMs = cTn["@_dur"]
        ? Number.parseInt(String(cTn["@_dur"]), 10)
        : undefined;
      const delayMs = cTn["@_delay"]
        ? Number.parseInt(String(cTn["@_delay"]), 10)
        : undefined;

      let trigger = currentTrigger;
      if (nodeType === "afterPrevious" || nodeType === "afterPrev") {
        trigger = "afterPrevious";
      } else if (nodeType === "withPrevious" || nodeType === "withEffect") {
        trigger = "withPrevious";
      } else if (nodeType === "clickEffect") {
        trigger = "onClick";
      } else if (nodeType === "mouseOver" || nodeType === "onMouseOver") {
        trigger = "onHover";
      }

      const stCondList = cTn["p:stCondLst"] as XmlObject | undefined;
      if (stCondList) {
        const conditions = ensureArray(stCondList["p:cond"]);
        for (const condition of conditions) {
          const conditionDelay = condition["@_delay"];
          if (
            conditionDelay !== undefined &&
            Number.parseInt(String(conditionDelay), 10) > 0
          ) {
            trigger = "afterDelay";
          }
        }
      }

      // Extract sound actions from this timing node
      const soundInfo = extractSoundAction(cTn);

      // Preserve p:endCondLst for lossless round-trip
      const rawEndCondLst = cTn["p:endCondLst"] as XmlObject | undefined;

      const targetId = extractAnimationTargetId(cTn);
      if (presetClass && targetId) {
        const validPresetClass = (
          ["entr", "exit", "emph", "path"].includes(presetClass)
            ? presetClass
            : undefined
        ) as PptxNativeAnimation["presetClass"];

        const childTnList = cTn["p:childTnLst"] as XmlObject | undefined;
        const childMotion = extractChildMotionValues(childTnList);
        const repeatInfo = extractRepeatInfo(cTn);
        const colorAnimation = extractColorAnimation(childTnList);
        const iterateInfo = extractIterate(cTn);
        const cmdInfo = extractCommand(childTnList);
        const textTarget = this.extractTextTargetFromCTn(cTn);

        animations.push({
          targetId,
          trigger,
          presetClass: validPresetClass,
          presetId,
          durationMs,
          delayMs,
          triggerDelayMs: trigger === "afterDelay" ? delayMs : undefined,
          motionPath: childMotion.motionPath,
          motionOrigin: childMotion.motionOrigin,
          rotationBy: childMotion.rotationBy,
          scaleByX: childMotion.scaleByX,
          scaleByY: childMotion.scaleByY,
          repeatCount: repeatInfo.repeatCount,
          autoReverse: repeatInfo.autoReverse,
          soundRId: soundInfo.soundRId,
          stopSound: soundInfo.stopSound,
          rawEndCondLst: rawEndCondLst ?? undefined,
          colorAnimation: colorAnimation ?? undefined,
          iterate: iterateInfo ?? undefined,
          commandType: cmdInfo.commandType,
          commandString: cmdInfo.commandString,
          textTarget: textTarget ?? undefined,
        });
      }

      const childTnList = cTn["p:childTnLst"] as XmlObject | undefined;
      if (childTnList) {
        const parallels = ensureArray(childTnList["p:par"]);
        const sequences = ensureArray(childTnList["p:seq"]);
        const exclusives = ensureArray(childTnList["p:excl"]);
        for (const parallel of parallels) {
          this.walkTimingTree(parallel, animations, trigger);
        }
        for (const sequence of sequences) {
          this.walkTimingTree(sequence, animations, trigger);
        }
        for (const excl of exclusives) {
          const exclAnims: PptxNativeAnimation[] = [];
          this.walkTimingTree(excl, exclAnims, trigger);
          for (const a of exclAnims) {
            a.exclusive = true;
            animations.push(a);
          }
        }
      }
    }

    const directParallels = ensureArray(node["p:par"]);
    const directSequences = ensureArray(node["p:seq"]);
    for (const parallel of directParallels) {
      this.walkTimingTree(parallel, animations, currentTrigger);
    }
    for (const sequence of directSequences) {
      this.walkTimingTree(sequence, animations, currentTrigger);
    }
  }

  private extractTextTargetFromCTn(
    cTn: XmlObject,
  ): PptxTextAnimationTarget | undefined {
    const childTnList = cTn["p:childTnLst"] as XmlObject | undefined;
    if (!childTnList) return undefined;

    const animNodes = [
      ...ensureArray(childTnList["p:animEffect"]),
      ...ensureArray(childTnList["p:anim"]),
      ...ensureArray(childTnList["p:set"]),
    ];

    for (const animNode of animNodes) {
      const behavior = animNode["p:cBhvr"] as XmlObject | undefined;
      const tgtEl = behavior?.["p:tgtEl"] as XmlObject | undefined;
      const spTgt = tgtEl?.["p:spTgt"] as XmlObject | undefined;
      if (spTgt) {
        const result = extractTextTarget(spTgt);
        if (result) return result;
      }
    }

    return undefined;
  }

  /**
   * Parse interactive sequences from the root `p:par` node.
   *
   * In OOXML, interactive sequences are sibling `p:seq` nodes alongside the
   * main sequence. They have a `p:stCondLst` condition with `evt="onClick"`
   * targeting a specific shape via `p:tgtEl/p:spTgt/@spid`.
   *
   * See ISO/IEC 29500-1 S19.5.60 (CT_TLTimeNodeSequence).
   */
  private parseInteractiveSequences(
    rootPar: XmlObject,
    animations: PptxNativeAnimation[],
  ): void {
    const rootCTn = rootPar["p:cTn"] as XmlObject | undefined;
    if (!rootCTn) return;

    const childTnList = rootCTn["p:childTnLst"] as XmlObject | undefined;
    if (!childTnList) return;

    const sequences = ensureArray(childTnList["p:seq"]);
    for (const seq of sequences) {
      const seqCTn = seq["p:cTn"] as XmlObject | undefined;
      if (!seqCTn) continue;

      // Skip the main sequence -- it has nodeType="mainSeq"
      const nodeType = String(seqCTn["@_nodeType"] || "");
      if (nodeType === "mainSeq") continue;

      // Extract the trigger shape ID from the sequence conditions
      const triggerShapeId = extractTriggerShapeId(seqCTn);
      if (!triggerShapeId) continue;

      // Walk this interactive sequence children and tag them
      const interactiveAnims: PptxNativeAnimation[] = [];
      this.walkTimingTree(seq, interactiveAnims, "onShapeClick");

      for (const anim of interactiveAnims) {
        anim.triggerShapeId = triggerShapeId;
        anim.trigger = "onShapeClick";
        animations.push(anim);
      }
    }
  }
}
