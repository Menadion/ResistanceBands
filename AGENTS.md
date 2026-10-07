# Obsidian community plugin

## Project overview

- Target: Obsidian Community Plugin (TypeScript → bundled JavaScript).
- Entry point: `src/main.ts` compiled to `main.js` and loaded by Obsidian.
- Required release artifacts: `main.js`, `manifest.json`, and optional `styles.css`.

## What this plugin does

Resistance Bands gives chosen notes their own graph link length, longer or shorter than the rest.
Obsidian's core graph cannot express that: a link reaches its simulation as `[sourcePath,
targetPath]` with no room for a per-link value, and `linkDistance` is a single scalar applied to
every link. So the plugin supplies the simulation and leaves the drawing to Obsidian.

## Graph view internals (undocumented API)

Verified against Obsidian on 2026-10-05 by reading `resources/obsidian.asar` and probing a live
renderer. **None of this is public API.** Plugin review flags internal API use, and any Obsidian
update can change it without deprecation. Re-verify before trusting it.

The renderer is at `app.workspace.getLeavesOfType("graph")[0].view.renderer` (`"localgraph"` for
local graphs). It owns `nodes`, `links`, `nodeLookup`, `workerResults`, `scale`, `worker`, and a
PIXI app at `px`. Its layout runs in a **per-view** worker built from `/sim.js`; the constructor
takes an optional existing worker, so views do not share one. `destroy()` calls
`worker.terminate()`.

Messages the renderer sends the worker:

```
{ forces: { centerStrength | linkStrength | linkDistance | repelStrength }, alpha?, alphaTarget?, run? }
{ nodes: { [path]: [x, y] | false }, links: [[sourcePath, targetPath], ...], alpha?, run? }
{ forceNode: { id, x, y }, alpha?, alphaTarget?, run? }
```

- `forces` arrives **one key per message**, and before any node data. Each field is a partial
  update; absent fields keep their previous value.
- `repelStrength` is sent **positive** and negated on arrival.
- `linkDistance` is sent **already converted** from the slider position, so `graph.json` does not
  need reading.
- In `nodes`, a falsy value (observed as `false`) means **keep this node's current position**. Only
  a truthy `[x, y]` sets one. Reading `false[0]` is where a `NaN` cascade comes from.
- Node ids are vault-relative paths with the extension for **files that exist**, the same key space
  as `metadataCache.resolvedLinks`, so folder-prefix rules match them untranslated. **An unresolved
  link is a node too, and its id is the raw link text** — no folder, no extension
  (`engine-rules`, `The World Wraps`, `../backend/`). No folder prefix can ever match one.
- The renderer posts a wide node set first and a narrower one after (386 then 355 on this vault).
  **Measured 2026-10-07: the second is the first after `hideUnresolved` is applied.** With the
  filter off both messages carry 386 keys and nothing drops; with it on, the second drops exactly
  the unresolved names and adds nothing, so it is always a subset. The set therefore moves when the
  **user** flips Graph view's "Existing files only", which they can do while the plugin is running.

What the worker sends back, consumed in the renderer's render callback:

```
{ id: string[], buffer, v?, ignore? }   // buffer holds interleaved x, y floats
```

A `SharedArrayBuffer` takes a version-word path (last 4 bytes, a `Uint32`). A plain `ArrayBuffer`
takes a simpler branch: applied once, then `workerResults` is cleared. Obsidian uses the former;
the latter needs no version counter and is the easier one to produce.

Defaults read from the bundle: `linkDistance 250`, `repelStrength -1000`, `centerStrength 0.1`,
`linkStrength 1`, `alphaDecay 1 - 0.001 ** (1/300)`. Label opacity is
`clamp(log2(scale) + 1 - textFadeMultiplier, 0, 1)`, a ramp spanning one doubling of scale.

The renderer auto-fits its zoom to the layout's extent, so scaling every band by the same factor
is only a zoom. Untangling has to come from the *relative* difference between band lengths.

## Decided (2026-10-06)

**The plugin owns no view of its own.** It hooks the core Graph view's leaf and swaps
`renderer.worker` for its own object. Rejected: a tab of its own constructing a renderer, which
re-opens exactly what renting the renderer was meant to close. Consequence: the plugin is mutating a
view it does not own, so `onunload` must restore the original worker, and graph leaves opened later
need hooking too.

**The replacement is a forwarding layer, not a stand-in.** The renderer never asks what sits in
`renderer.worker`; it only calls things on it, so any object answering `postMessage`, `onmessage` and
`terminate` is accepted. The real worker is parked in a field on the plugin and never terminated by
the plugin directly. Instead the replacement's `terminate` forwards to it:

```js
terminate() { this.parked.terminate() }
```

Obsidian's `destroy()` calls the replacement's `terminate`, which calls the real one, so closing the
graph tab kills the real thread with no orphan left behind. This is also how plugin code gets to run
at tab-close time, which retires the alternatives: the `layout-change` workspace event with its
leaf-diffing and state tracking, and monkey-patching `renderer.destroy`, the route plugin review
would flag hardest.

**The two teardown events get different treatment.** `onunload` (plugin disabled, graph still open)
**restores** — the parked worker goes back in the slot and the graph returns to stock behavior.
`destroy()` (tab closed, plugin still enabled) **terminates**, via the forwarding above. Never
terminate on unload: a renderer with a dead worker is frozen, not visibly broken, which is worse —
it applies whatever arrives on `onmessage`, so when nothing arrives the graph looks fine and does not
respond.

**The sim holds its inputs and acts on none of them early.** `forces` arrives one key per message,
before any node data, and may carry `run: true` when no simulation exists yet. So the four force
values are held as mutable standing state that later partial updates overwrite, and `run` is stored
as an intention rather than obeyed on arrival. A gate starts the ticking once nodes and links have
arrived and the simulation has been created — never before, or `forceLink` initializes against an
empty nodes list.

**Always rebuild from the most recent `nodes` message, and re-filter the bands against it.** Not
"the second message": nothing guarantees there are only two, and a user toggling a filter mid-session
sends more. Any band whose endpoint is absent from that node map is dropped before `forceLink` sees
it, because `find()` in `d3-force/src/link.js:8-11` throws `node not found` from inside initialize,
which takes the whole simulation down rather than skipping one band. Rejected: building from the
unfiltered first message, which simulates nodes the user has hidden so they repel the visible ones
out of position, and which needs new code for every filter Obsidian adds; and inventing placeholder
nodes for missing ends, which is the same layout problem by hand.

Band-rule coverage is never at risk from unresolved endpoints: every band was written by a note, so
every band has at least one end that is a real file in a real folder, and the either-end rule finds
it there.

**Open design questions — M's to decide, do not settle them in code unasked:** the shape of the
length lever itself.

## Environment & tooling

- Node.js: use current LTS (Node 18+ recommended).
- **Package manager: npm** (required for this sample - `package.json` defines npm scripts and dependencies).
- **Bundler: esbuild** (required for this sample - `esbuild.config.mjs` and build scripts depend on it). Alternative bundlers like Rollup or webpack are acceptable for other projects if they bundle all external dependencies into `main.js`.
- Types: `obsidian` type definitions.

### Install

```bash
npm install
```

### Dev (watch)

```bash
npm run dev
```

### Production build

```bash
npm run build
```

## Linting

- ESLint is preconfigured with `eslint-plugin-obsidianmd` for Obsidian-specific rules.
- Run `npm run lint` to lint the project.
- A GitHub Action automatically lints every commit on all branches.

## File & folder conventions

- **Organize code into multiple files**: Split functionality across separate modules rather than putting everything in `main.ts`.
- Source lives in `src/`. Keep `main.ts` small and focused on plugin lifecycle (loading, unloading, registering commands).
- **Do not commit build artifacts**: Never commit `node_modules/`, `main.js`, or other generated files to version control.
- Keep the plugin small. Avoid large dependencies. Prefer browser-compatible packages.
- Generated output should be placed at the plugin root or `dist/` depending on your build setup. Release artifacts must end up at the top level of the plugin folder in the vault (`main.js`, `manifest.json`, `styles.css`).

## Manifest rules (`manifest.json`)

- Must include (non-exhaustive):
    - `id` (plugin ID; for local dev it should match the folder name)
    - `name`
    - `version` (Semantic Versioning `x.y.z`)
    - `minAppVersion`
    - `description`
    - `isDesktopOnly` (boolean)
    - Optional: `author`, `authorUrl`, `fundingUrl` (string or map)
- Never change `id` after release. Treat it as stable API.
- Keep `minAppVersion` accurate when using newer APIs.
- Canonical requirements are coded here: https://github.com/obsidianmd/obsidian-releases/blob/master/.github/workflows/validate-plugin-entry.yml

## Commands & settings

- Any user-facing commands should be added via `this.addCommand(...)`.
- If the plugin has configuration, provide a settings tab and sensible defaults.
- Persist settings using `this.loadData()` / `this.saveData()`.
- Use stable command IDs; avoid renaming once released.

## Versioning & releases

- Bump `version` in `manifest.json` (SemVer) and update `versions.json` to map plugin version → minimum app version.
- Create a GitHub release whose tag exactly matches `manifest.json`'s `version`. Do not use a leading `v`.
- Attach `manifest.json`, `main.js`, and `styles.css` (if present) to the release as individual assets.
- After the initial release, follow the process to add/update your plugin in the community catalog as required.

## Security, privacy, and compliance

Follow Obsidian's **Developer Policies** and **Plugin Guidelines**. In particular:

- Default to local/offline operation. Only make network requests when essential to the feature.
- No hidden telemetry. If you collect optional analytics or call third-party services, require explicit opt-in and document clearly in `README.md` and in settings.
- Never execute remote code, fetch and eval scripts, or auto-update plugin code outside of normal releases.
- Minimize scope: read/write only what's necessary inside the vault. Do not access files outside the vault.
- Clearly disclose any external services used, data sent, and risks.
- Respect user privacy. Do not collect vault contents, filenames, or personal information unless absolutely necessary and explicitly consented.
- Avoid deceptive patterns, ads, or spammy notifications.
- Register and clean up all DOM, app, and interval listeners using the provided `register*` helpers so the plugin unloads safely.

## UX & copy guidelines (for UI text, commands, settings)

- Prefer sentence case for headings, buttons, and titles.
- Use clear, action-oriented imperatives in step-by-step copy.
- Use **bold** to indicate literal UI labels. Prefer "select" for interactions.
- Use arrow notation for navigation: **Settings → Community plugins**.
- Keep in-app strings short, consistent, and free of jargon.

## Performance

- Keep startup light. Defer heavy work until needed.
- Avoid long-running tasks during `onload`; use lazy initialization.
- Batch disk access and avoid excessive vault scans.
- Debounce/throttle expensive operations in response to file system events.

## Coding conventions

- TypeScript with `"strict": true` preferred.
- **Keep `main.ts` minimal**: Focus only on plugin lifecycle (onload, onunload, addCommand calls). Delegate all feature logic to separate modules.
- **Split large files**: If any file exceeds ~200-300 lines, consider breaking it into smaller, focused modules.
- **Use clear module boundaries**: Each file should have a single, well-defined responsibility.
- Bundle everything into `main.js` (no unbundled runtime deps).
- Avoid Node/Electron APIs if you want mobile compatibility; set `isDesktopOnly` accordingly.
- Prefer `async/await` over promise chains; handle errors gracefully.

## Agent do/don't

**Do**

- Add commands with stable IDs (don't rename once released).
- Provide defaults and validation in settings.
- Write idempotent code paths so reload/unload doesn't leak listeners or intervals.
- Use `this.register*` helpers for everything that needs cleanup.

**Don't**

- Introduce network calls without an obvious user-facing reason and documentation.
- Ship features that require cloud services without clear disclosure and explicit opt-in.
- Store or transmit vault contents unless essential and consented.

## Common tasks

### Register listeners safely

```ts
this.registerEvent(
	this.app.workspace.on('file-open', (f) => {
		/* ... */
	}),
);
this.registerDomEvent(activeWindow, 'resize', () => {
	/* ... */
});
this.registerInterval(
	window.setInterval(() => {
		/* ... */
	}, 1000),
);
```

## Troubleshooting

- Plugin doesn't load after build: ensure `main.js` and `manifest.json` are at the top level of the plugin folder under `<Vault>/.obsidian/plugins/<plugin-id>/`.
- Build issues: if `main.js` is missing, run `npm run build` or `npm run dev` to compile your TypeScript source code.
- Commands not appearing: verify `addCommand` runs after `onload` and IDs are unique.
- Settings not persisting: ensure `loadData`/`saveData` are awaited and you re-render the UI after changes.

## References

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- API documentation: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Style guide: https://help.obsidian.md/style-guide
