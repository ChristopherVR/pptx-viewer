import type { EffectName } from "./animation-types";

// ==========================================================================
// OOXML presetId → effect name mapping
// ==========================================================================

interface PresetIdMap {
  entr: Record<number, EffectName>;
  exit: Record<number, EffectName>;
  emph: Record<number, EffectName>;
}

export const PRESET_ID_TO_EFFECT: PresetIdMap = {
  entr: {
    1: "appear",
    2: "flyInBottom",
    3: "blindsIn",
    4: "boxIn",
    5: "checkerboardIn",
    6: "expandIn",
    9: "dissolveIn",
    10: "fadeIn",
    12: "flashIn",
    16: "peekIn",
    17: "randomBarsIn",
    22: "wipeIn",
    23: "zoomIn",
    26: "riseUp",
    21: "wheelIn",
    31: "expandIn",
    37: "bounceIn",
    42: "floatIn",
    47: "swivel",
    49: "spinnerIn",
    53: "growTurnIn",
  },
  exit: {
    1: "disappear",
    2: "flyOutBottom",
    6: "shrinkOut",
    9: "dissolveOut",
    10: "fadeOut",
    22: "wipeOut",
    23: "zoomOut",
    37: "bounceOut",
  },
  emph: {
    1: "boldFlash",
    2: "wave",
    6: "growShrink",
    8: "spin",
    9: "transparency",
    14: "teeter",
    26: "pulse",
  },
};
