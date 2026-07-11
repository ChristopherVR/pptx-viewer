/**
 * Collaboration barrel for the Svelte viewer: the runes controller, its
 * transport/session seams, and the shared config types re-exported for hosts.
 */
export { CollaborationController } from './collaboration.svelte';
export type { CollaborationDeps } from './collaboration.svelte';
export { CollaborationDialogsState } from './collaboration-dialogs.svelte';
export type { ShareDefaultsInput } from './collaboration-dialogs.svelte';
export { createDefaultSession } from './collaboration-session';
export type { CollabSession, CollabSessionFactory } from './collaboration-session';
export { createCollabProvider } from './collaboration-provider';
export type { CollabProviderHandle } from './collaboration-provider';
export { createWriteBackScheduler } from 'pptx-viewer-shared';
export type { WriteBackDeps, WriteBackScheduler } from 'pptx-viewer-shared';
