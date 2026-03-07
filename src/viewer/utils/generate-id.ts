/** Generate a unique element ID. */
export function generateElementId(): string {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
