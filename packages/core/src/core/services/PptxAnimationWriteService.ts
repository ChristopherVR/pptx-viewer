import type { PptxElementAnimation, XmlObject } from "../types";
import type { IPptxAnimationWriteService } from "./animation-write-mappings";
import {
  buildEffectNodesForAnimation,
  buildBuildListXml,
  buildInteractiveSequences,
} from "./animation-write-sequence-builders";
import { surgicallyUpdateTimingTree } from "./animation-timing-surgical";

export type { IPptxAnimationWriteService } from "./animation-write-mappings";

/**
 * Service that serializes `PptxElementAnimation[]` into valid OOXML
 * `p:timing` XML structures for writing back to .pptx files.
 */
export class PptxAnimationWriteService implements IPptxAnimationWriteService {
  private nextId: number = 1;

  /**
   * Build a complete `p:timing` XML object from editor animations.
   *
   * When `existingRawTiming` is provided, performs surgical updates on
   * the existing timing tree rather than regenerating it. This preserves
   * complex structures (endCondLst, nested sequences, etc.) that would
   * be destroyed by a full rebuild.
   *
   * Falls back to full regeneration when no existing tree is available.
   */
  public buildTimingXml(
    animations: PptxElementAnimation[],
    existingRawTiming: XmlObject | undefined,
  ): XmlObject | undefined {
    // Filter to animations that have at least one effect
    const validAnimations = animations
      .filter((a) => a.entrance || a.exit || a.emphasis || a.motionPath)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (validAnimations.length === 0) {
      return existingRawTiming;
    }

    // When an existing timing tree is available, perform surgical updates
    // to preserve complex structures (endCondLst, exclusive containers, etc.)
    if (existingRawTiming) {
      const cloned = JSON.parse(JSON.stringify(existingRawTiming)) as XmlObject;
      return surgicallyUpdateTimingTree(cloned, validAnimations);
    }

    this.nextId = 1;

    // Separate regular and interactive (onShapeClick) animations
    const regularAnimations = validAnimations.filter(
      (a) => a.trigger !== "onShapeClick",
    );
    const interactiveAnimations = validAnimations.filter(
      (a) => a.trigger === "onShapeClick" && a.triggerShapeId,
    );

    // Build the animation sequence nodes grouped by trigger
    const animationNodes = this.buildAnimationSequence(regularAnimations);
    if (animationNodes.length === 0 && interactiveAnimations.length === 0) {
      return existingRawTiming;
    }

    // Build the root p:timing structure
    const rootParId = this.allocateId();
    const mainSeqId = this.allocateId();

    // Build the main sequence container
    const mainSequenceChildren: XmlObject[] = [];
    for (const node of animationNodes) {
      mainSequenceChildren.push(node);
    }

    const mainSeqNode: XmlObject = {
      "p:cTn": {
        "@_id": String(mainSeqId),
        "@_dur": "indefinite",
        "@_nodeType": "mainSeq",
        "p:childTnLst": {
          "p:par":
            mainSequenceChildren.length === 1
              ? mainSequenceChildren[0]
              : mainSequenceChildren,
        },
      },
      "p:prevCondLst": {
        "p:cond": {
          "@_evt": "onPrev",
          "@_delay": "0",
          "p:tgtEl": {
            "p:sldTgt": {},
          },
        },
      },
      "p:nextCondLst": {
        "p:cond": {
          "@_evt": "onNext",
          "@_delay": "0",
          "p:tgtEl": {
            "p:sldTgt": {},
          },
        },
      },
    };

    // Build interactive sequence nodes
    const interactiveSeqNodes = buildInteractiveSequences(
      interactiveAnimations,
      this.allocateId.bind(this),
    );

    // Combine main seq + interactive sequences into the child list
    const seqNodes: XmlObject | XmlObject[] =
      interactiveSeqNodes.length === 0
        ? mainSeqNode
        : [mainSeqNode, ...interactiveSeqNodes];

    const timingXml: XmlObject = {
      "p:tnLst": {
        "p:par": {
          "p:cTn": {
            "@_id": String(rootParId),
            "@_dur": "indefinite",
            "@_restart": "never",
            "@_nodeType": "tmRoot",
            "p:childTnLst": {
              "p:seq": seqNodes,
            },
          },
        },
      },
    };

    // Build the build list for paragraph-level animations
    const buildList = buildBuildListXml(validAnimations);
    if (buildList) {
      timingXml["p:bldLst"] = buildList;
    }

    return timingXml;
  }

  /**
   * Build animation sequence nodes -- each onClick trigger starts a new
   * click-group (p:par container), while afterPrevious/withPrevious
   * animations are nested within the current group.
   */
  private buildAnimationSequence(
    animations: PptxElementAnimation[],
  ): XmlObject[] {
    const clickGroups: XmlObject[][] = [];
    let currentGroup: XmlObject[] = [];

    for (const anim of animations) {
      const effectNodes = this.buildEffectNodesForAnimation(anim);
      if (effectNodes.length === 0) continue;

      const trigger = anim.trigger ?? "onClick";

      if (trigger === "onClick" || currentGroup.length === 0) {
        if (currentGroup.length > 0) {
          clickGroups.push(currentGroup);
        }
        currentGroup = [];
      }

      for (const effectNode of effectNodes) {
        currentGroup.push(effectNode);
      }
    }

    if (currentGroup.length > 0) {
      clickGroups.push(currentGroup);
    }

    // Wrap each click group in a p:par container
    return clickGroups.map((group) => {
      const groupId = this.allocateId();
      return {
        "p:cTn": {
          "@_id": String(groupId),
          "@_fill": "hold",
          "p:stCondLst": {
            "p:cond": {
              "@_delay": "indefinite",
            },
          },
          "p:childTnLst": {
            "p:par": group.length === 1 ? group[0] : group,
          },
        },
      } as XmlObject;
    });
  }

  private buildEffectNodesForAnimation(
    anim: PptxElementAnimation,
  ): XmlObject[] {
    return buildEffectNodesForAnimation(anim, this.allocateId.bind(this));
  }

  private allocateId(): number {
    return this.nextId++;
  }
}
