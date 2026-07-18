/**
 * stage-element-markers: DOM post-pass that removes the `data-element-id`
 * query/interaction markers from a static stage subtree.
 *
 * Only the primary editable canvas and the live presentation stage may expose
 * `data-element-id` hooks. Thumbnails, the slide sorter, version previews,
 * master views, transition snapshots, and the off-screen export stage render
 * the exact same element tree, but must not leak the markers: both the e2e
 * contract (`page.locator('[data-element-id]').first()` is the real canvas
 * element) and internal `document.querySelectorAll('[data-element-id]')`
 * consumers (animation preview, delegation fallbacks) rely on the first match
 * being the interactive copy. React reaches the same DOM contract by rendering
 * its static surfaces through a marker-free `StaticElementRenderer`; this
 * post-pass (run from `SlideStage`'s existing post-render effect, the same
 * boundary that applies element accessibility) gives Vue identical semantics
 * without threading a prop through every element renderer.
 *
 * Safe against re-renders: Vue's patcher only rewrites a DOM attribute when
 * the bound vnode prop value changes, and an element's `id` is stable, so a
 * stripped attribute is not re-added by unrelated updates. Structural changes
 * (elements added/removed/replaced) change the reactive element list, which
 * re-triggers the owning effect and re-strips.
 */
export function stripElementIdMarkers(stage: ParentNode): number {
	const nodes = stage.querySelectorAll<HTMLElement>('[data-element-id]');
	for (const node of nodes) {
		node.removeAttribute('data-element-id');
	}
	return nodes.length;
}
