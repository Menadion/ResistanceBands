// Diff the two node-set passes the graph renderer sends its worker.
//
// Why: the renderer posts a wide `nodes` message and then a narrower one (385 then 354 on the
// Engine-Room vault). The counts are known; the membership is not, and the band rules cannot be
// written until it is. See AGENTS.md, "Open design questions".
//
// How to run, by hand, in Obsidian:
//   1. Close every Graph view tab. The patch only catches a worker created after it is installed.
//   2. Ctrl+Shift+I to open devtools, Console tab.
//   3. Paste this whole file, press Enter. It prints "armed".
//   4. Open a NEW Graph view tab. Wait about five seconds for the layout to settle.
//   5. Run:  __rbReport()
//   6. Copy the output. Then run:  __rbRestore()   to un-patch.
//
// Nothing is written to disk and no note contents are read - only vault-relative paths, which are
// the renderer's node ids.

(() => {
  const seen = [];
  const originalPostMessage = Worker.prototype.postMessage;

  Worker.prototype.postMessage = function (message, ...rest) {
    try {
      if (message && message.nodes) seen.push(Object.keys(message.nodes));
    } catch (e) {
      // never let the probe break the app
    }
    return originalPostMessage.call(this, message, ...rest);
  };

  window.__rbSeen = seen;

  window.__rbRestore = () => {
    Worker.prototype.postMessage = originalPostMessage;
    return "restored";
  };

  window.__rbReport = () => {
    if (seen.length < 2) {
      return "only " + seen.length + " nodes message(s) captured - was the graph tab opened AFTER arming?";
    }
    const first = seen[0];
    const last = seen[seen.length - 1];
    const inLast = new Set(last);
    const inFirst = new Set(first);
    const dropped = first.filter((k) => !inLast.has(k));
    const added = last.filter((k) => !inFirst.has(k));
    return JSON.stringify(
      {
        passSizes: seen.map((s) => s.length),
        firstPass: first.length,
        lastPass: last.length,
        droppedCount: dropped.length,
        dropped,
        addedCount: added.length,
        added,
      },
      null,
      2
    );
  };

  return "armed - now open a NEW graph view, wait ~5s, then run __rbReport()";
})();
