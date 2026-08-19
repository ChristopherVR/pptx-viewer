// `@christophervr/pptx-viewer` is the scoped name most people search for
// first, so it does double duty: `npx @christophervr/pptx-viewer` runs the
// interactive installer (see `./cli.ts`, wired up via the `bin` field), and
// importing this module - the package root - makes `npm install
// @christophervr/pptx-viewer` behave exactly like `npm install
// pptx-react-viewer`, since React is this project's primary/flagship
// binding. Installing this package still requires the same peers
// pptx-react-viewer does (react, react-dom, framer-motion, ...); they are
// declared as optional peerDependencies here so the CLI-only install path
// (Vue, Angular, Svelte, vanilla, core, MCP) never warns about React.
export * from 'pptx-react-viewer';
