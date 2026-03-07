/**
 * Shape presets with their icon definitions for the toolbar shape picker.
 */

import React from "react";
import {
  LuCircle,
  LuDatabase,
  LuDiamond,
  LuMinus,
  LuMoveRight,
  LuPlus,
  LuSquare,
  LuTriangle,
} from "react-icons/lu";

import type { ShapePreset } from "../types";

const icon = (
  component: React.ElementType,
  className: string,
): React.ReactNode => React.createElement(component, { className });

export const SHAPE_PRESETS: ShapePreset[] = [
  { type: "rect", label: "Rectangle", icon: icon(LuSquare, "w-3.5 h-3.5") },
  { type: "roundRect", label: "Rounded", icon: icon(LuSquare, "w-3.5 h-3.5") },
  { type: "ellipse", label: "Circle", icon: icon(LuCircle, "w-3.5 h-3.5") },
  {
    type: "cylinder",
    label: "Cylinder",
    icon: icon(LuDatabase, "w-3.5 h-3.5"),
  },
  {
    type: "rtArrow",
    label: "Right Arrow",
    icon: icon(LuMoveRight, "w-3.5 h-3.5"),
  },
  {
    type: "leftArrow",
    label: "Left Arrow",
    icon: icon(LuMoveRight, "w-3.5 h-3.5 rotate-180"),
  },
  {
    type: "upArrow",
    label: "Up Arrow",
    icon: icon(LuMoveRight, "w-3.5 h-3.5 -rotate-90"),
  },
  {
    type: "downArrow",
    label: "Down Arrow",
    icon: icon(LuMoveRight, "w-3.5 h-3.5 rotate-90"),
  },
  {
    type: "triangle",
    label: "Triangle",
    icon: icon(LuTriangle, "w-3.5 h-3.5"),
  },
  {
    type: "rtTriangle",
    label: "Right Triangle",
    icon: icon(LuTriangle, "w-3.5 h-3.5 rotate-90"),
  },
  { type: "diamond", label: "Diamond", icon: icon(LuDiamond, "w-3.5 h-3.5") },
  {
    type: "parallelogram",
    label: "Parallelogram",
    icon: icon(LuSquare, "w-3.5 h-3.5 -skew-x-12"),
  },
  {
    type: "trapezoid",
    label: "Trapezoid",
    icon: icon(LuSquare, "w-3.5 h-3.5"),
  },
  { type: "pentagon", label: "Pentagon", icon: icon(LuDiamond, "w-3.5 h-3.5") },
  { type: "hexagon", label: "Hexagon", icon: icon(LuDiamond, "w-3.5 h-3.5") },
  { type: "octagon", label: "Octagon", icon: icon(LuCircle, "w-3.5 h-3.5") },
  { type: "chevron", label: "Chevron", icon: icon(LuMoveRight, "w-3.5 h-3.5") },
  {
    type: "star5",
    label: "Star",
    icon: icon(LuDiamond, "w-3.5 h-3.5 rotate-45"),
  },
  { type: "star6", label: "Star 6", icon: icon(LuDiamond, "w-3.5 h-3.5") },
  {
    type: "star8",
    label: "Star 8",
    icon: icon(LuDiamond, "w-3.5 h-3.5 rotate-45"),
  },
  { type: "plus", label: "Plus", icon: icon(LuPlus, "w-3.5 h-3.5") },
  { type: "heart", label: "Heart", icon: icon(LuCircle, "w-3.5 h-3.5") },
  { type: "cloud", label: "Cloud", icon: icon(LuCircle, "w-3.5 h-3.5") },
  { type: "sun", label: "Sun", icon: icon(LuCircle, "w-3.5 h-3.5") },
  { type: "moon", label: "Moon", icon: icon(LuCircle, "w-3.5 h-3.5") },
  { type: "pie", label: "Pie", icon: icon(LuCircle, "w-3.5 h-3.5") },
  { type: "plaque", label: "Plaque", icon: icon(LuSquare, "w-3.5 h-3.5") },
  { type: "teardrop", label: "Teardrop", icon: icon(LuCircle, "w-3.5 h-3.5") },
  { type: "line", label: "Line", icon: icon(LuMinus, "w-3.5 h-3.5") },
  {
    type: "connector",
    label: "Connector",
    icon: icon(LuMoveRight, "w-3.5 h-3.5"),
  },
];
