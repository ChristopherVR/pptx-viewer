/**
 * Type-assertion tests for column spacing, text overflow, and hyperlink mouse-over.
 * These compile-time checks verify the new TextStyle fields exist with the correct types.
 */
import type { TextStyle } from "./types";

// ---------- Column spacing ----------
{
  const style: TextStyle = { columnSpacing: 12.5 };
  const _val: number | undefined = style.columnSpacing;
  void _val;
}

// ---------- Horizontal overflow ----------
{
  const styleOverflow: TextStyle = { hOverflow: "overflow" };
  const styleClip: TextStyle = { hOverflow: "clip" };
  const _a: "overflow" | "clip" | undefined = styleOverflow.hOverflow;
  const _b: "overflow" | "clip" | undefined = styleClip.hOverflow;
  void _a;
  void _b;
}

// ---------- Vertical overflow ----------
{
  const a: TextStyle = { vertOverflow: "overflow" };
  const b: TextStyle = { vertOverflow: "clip" };
  const c: TextStyle = { vertOverflow: "ellipsis" };
  const _x: "overflow" | "clip" | "ellipsis" | undefined = a.vertOverflow;
  const _y: "overflow" | "clip" | "ellipsis" | undefined = b.vertOverflow;
  const _z: "overflow" | "clip" | "ellipsis" | undefined = c.vertOverflow;
  void _x;
  void _y;
  void _z;
}

// ---------- Hyperlink mouse-over ----------
{
  const style: TextStyle = { hyperlinkMouseOver: "https://example.com" };
  const _val: string | undefined = style.hyperlinkMouseOver;
  void _val;
}

// ---------- Combined usage ----------
{
  const style: TextStyle = {
    columnCount: 2,
    columnSpacing: 18,
    hOverflow: "clip",
    vertOverflow: "ellipsis",
    hyperlink: "https://example.com",
    hyperlinkMouseOver: "https://example.com/hover",
  };
  void style;
}
