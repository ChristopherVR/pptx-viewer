/**
 * Preset shadow blur radius map (shdw1–shdw20).
 * Values approximate the OOXML preset shadow definitions from the ISO 29500 spec.
 * Blur values are in px. Shadows 1-6 are outer bottom-right shadows of increasing intensity.
 * 7-12 are perspective shadows. 13-16 are inner shadows. 17-20 are special effect shadows.
 */
export const PRESET_SHADOW_BLUR_MAP: Record<string, number> = {
  shdw1: 2,
  shdw2: 4,
  shdw3: 6,
  shdw4: 3,
  shdw5: 5,
  shdw6: 8,
  shdw7: 4,
  shdw8: 6,
  shdw9: 8,
  shdw10: 10,
  shdw11: 4,
  shdw12: 6,
  shdw13: 3,
  shdw14: 5,
  shdw15: 4,
  shdw16: 6,
  shdw17: 3,
  shdw18: 5,
  shdw19: 4,
  shdw20: 8,
};

/** Preset shadow default opacity map (0-1). */
export const PRESET_SHADOW_OPACITY_MAP: Record<string, number> = {
  shdw1: 0.35,
  shdw2: 0.38,
  shdw3: 0.4,
  shdw4: 0.45,
  shdw5: 0.48,
  shdw6: 0.5,
  shdw7: 0.38,
  shdw8: 0.4,
  shdw9: 0.42,
  shdw10: 0.45,
  shdw11: 0.38,
  shdw12: 0.4,
  shdw13: 0.5,
  shdw14: 0.52,
  shdw15: 0.55,
  shdw16: 0.58,
  shdw17: 0.42,
  shdw18: 0.45,
  shdw19: 0.48,
  shdw20: 0.5,
};
