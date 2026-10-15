import {writable} from 'svelte/store';
export const instanceArtwork=writable<Record<string,string>>({});
