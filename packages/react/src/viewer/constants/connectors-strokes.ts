/**
 * Connector geometry, arrow, arrow size, and stroke dash options.
 */

import type {
  ConnectorArrowOption,
  ConnectorGeometryOption,
  StrokeDashOption,
} from "../types";

export const CONNECTOR_GEOMETRY_OPTIONS: ConnectorGeometryOption[] = [
  { value: "straightConnector1", label: "Straight" },
  { value: "bentConnector2", label: "Bent" },
  { value: "bentConnector3", label: "Double Bent" },
  { value: "bentConnector4", label: "Triple Bent" },
  { value: "bentConnector5", label: "Quad Bent" },
  { value: "curvedConnector2", label: "Curved" },
  { value: "curvedConnector3", label: "Curved (Cubic)" },
  { value: "curvedConnector4", label: "Curved 4" },
  { value: "curvedConnector5", label: "Curved 5" },
];

export const CONNECTOR_ARROW_OPTIONS: ConnectorArrowOption[] = [
  { value: "none", label: "None" },
  { value: "triangle", label: "Triangle" },
  { value: "stealth", label: "Stealth" },
  { value: "diamond", label: "Diamond" },
  { value: "oval", label: "Oval" },
  { value: "arrow", label: "Open Arrow" },
];

export const ARROW_SIZE_OPTIONS: {
  value: "sm" | "med" | "lg";
  label: string;
}[] = [
  { value: "sm", label: "Small" },
  { value: "med", label: "Medium" },
  { value: "lg", label: "Large" },
];

export const STROKE_DASH_OPTIONS: StrokeDashOption[] = [
  { value: "solid", label: "Solid" },
  { value: "dot", label: "Dot" },
  { value: "dash", label: "Dash" },
  { value: "dashDot", label: "Dash Dot" },
  { value: "lgDash", label: "Long Dash" },
  { value: "lgDashDot", label: "Long Dash Dot" },
  { value: "lgDashDotDot", label: "Long Dash Dot Dot" },
  { value: "sysDot", label: "System Dot" },
  { value: "sysDash", label: "System Dash" },
  { value: "sysDashDot", label: "System Dash Dot" },
  { value: "sysDashDotDot", label: "System Dash Dot Dot" },
  { value: "custom", label: "Custom" },
];
