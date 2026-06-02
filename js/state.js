// state.js — shared application state

export const state = {
  mode: 'realistic',
  v0: 14,
  h1: 1.0,
  h2: 3.0,
  d: 8.0,
  ropeLen: 1.2,      // NEW: length of bar holding monkey (0.3–2.5)
  running: false,
  t: 0,
  theta: 0,
  impactT: 0,
  impacted: false,
};

export function setState(patch) {
  Object.assign(state, patch);
}
