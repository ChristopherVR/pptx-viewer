/**
 * Table style preset definitions.
 */

export interface TableStylePreset {
  id: string;
  label: string;
  headerBg: string;
  headerFg: string;
  bandBg: string;
  borderColor: string;
}

export const TABLE_STYLE_PRESETS: TableStylePreset[] = [
  // Light styles
  {
    id: "light-1",
    label: "Light 1",
    headerBg: "#4472C4",
    headerFg: "#FFFFFF",
    bandBg: "rgba(217, 226, 243, 0.5)",
    borderColor: "#B4C6E7",
  },
  {
    id: "light-2",
    label: "Light 2",
    headerBg: "#ED7D31",
    headerFg: "#FFFFFF",
    bandBg: "rgba(252, 228, 214, 0.5)",
    borderColor: "#F4B084",
  },
  {
    id: "light-3",
    label: "Light 3",
    headerBg: "#70AD47",
    headerFg: "#FFFFFF",
    bandBg: "rgba(226, 239, 218, 0.5)",
    borderColor: "#A9D18E",
  },
  // Medium styles
  {
    id: "medium-1",
    label: "Medium 1",
    headerBg: "#2F5597",
    headerFg: "#FFFFFF",
    bandBg: "rgba(180, 198, 231, 0.4)",
    borderColor: "#8FAADC",
  },
  {
    id: "medium-2",
    label: "Medium 2",
    headerBg: "#C55A11",
    headerFg: "#FFFFFF",
    bandBg: "rgba(244, 176, 132, 0.4)",
    borderColor: "#F4B084",
  },
  {
    id: "medium-3",
    label: "Medium 3",
    headerBg: "#548235",
    headerFg: "#FFFFFF",
    bandBg: "rgba(169, 209, 142, 0.4)",
    borderColor: "#A9D18E",
  },
  // Dark styles
  {
    id: "dark-1",
    label: "Dark 1",
    headerBg: "#1F3864",
    headerFg: "#FFFFFF",
    bandBg: "rgba(31, 56, 100, 0.15)",
    borderColor: "#2F5597",
  },
  {
    id: "dark-2",
    label: "Dark 2",
    headerBg: "#843C0C",
    headerFg: "#FFFFFF",
    bandBg: "rgba(132, 60, 12, 0.15)",
    borderColor: "#C55A11",
  },
  {
    id: "dark-3",
    label: "Dark 3",
    headerBg: "#375623",
    headerFg: "#FFFFFF",
    bandBg: "rgba(55, 86, 35, 0.15)",
    borderColor: "#548235",
  },
];
