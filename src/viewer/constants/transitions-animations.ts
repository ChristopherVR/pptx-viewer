/**
 * Slide transition and element animation preset options.
 */

import type { AnimationPresetOption, SlideTransitionOption } from "../types";

export const SLIDE_TRANSITION_OPTIONS: SlideTransitionOption[] = [
  { value: "none", label: "None" },
  { value: "cut", label: "Cut" },
  { value: "fade", label: "Fade" },
  { value: "push", label: "Push" },
  { value: "wipe", label: "Wipe" },
  { value: "split", label: "Split" },
  { value: "randomBar", label: "Random Bars" },
  { value: "blinds", label: "Blinds" },
  { value: "checker", label: "Checker" },
  { value: "circle", label: "Circle" },
  { value: "comb", label: "Comb" },
  { value: "cover", label: "Cover" },
  { value: "diamond", label: "Diamond" },
  { value: "dissolve", label: "Dissolve" },
  { value: "plus", label: "Plus" },
  { value: "pull", label: "Pull" },
  { value: "random", label: "Random" },
  { value: "strips", label: "Strips" },
  { value: "uncover", label: "Uncover" },
  { value: "wedge", label: "Wedge" },
  { value: "wheel", label: "Wheel" },
  { value: "zoom", label: "Zoom" },
  { value: "newsflash", label: "Newsflash" },
  { value: "morph", label: "Morph" },
];

export const ANIMATION_PRESET_OPTIONS: AnimationPresetOption[] = [
  { value: "fadeIn", label: "Fade In" },
  { value: "flyIn", label: "Fly In" },
  { value: "zoomIn", label: "Zoom In" },
  { value: "fadeOut", label: "Fade Out" },
  { value: "flyOut", label: "Fly Out" },
  { value: "zoomOut", label: "Zoom Out" },
  { value: "spin", label: "Spin" },
  { value: "pulse", label: "Pulse" },
  { value: "colorWave", label: "Color Wave" },
  { value: "bounce", label: "Bounce" },
  { value: "flash", label: "Flash" },
  { value: "growShrink", label: "Grow/Shrink" },
  { value: "teeter", label: "Teeter" },
];
