import { mount } from 'svelte';

import App from './App.svelte';

import './styles.css';

/** Demo entry point: mounts the Svelte demo shell. */
const appRoot = document.getElementById('app');
if (!appRoot) {
	throw new Error('missing #app root');
}

mount(App, { target: appRoot });
