# Codex in-app Browser recording

Use this only after selecting the Codex in-app Browser, obtaining the live
`tab`, and confirming that `await tab.capabilities.list()` includes `cdp`.
Capture the existing tab so its cookies and localStorage stay in place.

## Start

Resolve a temporary absolute frame directory outside `clips/`, create it, and
replace the placeholder below. Keep all frame bytes inside the persistent
browser process.

```js
var qaFs = await import("node:fs/promises");
var qaPath = await import("node:path");
var qaFrameDir = "<absolute-frame-directory>";
var qaCdp = await tab.capabilities.get("cdp");
var qaFrameIndex = 0;
var qaFrameCursor = (
  await qaCdp.readEvents({
    methods: ["Page.screencastFrame"],
    limit: 1,
  })
).cursor;

await qaFs.mkdir(qaFrameDir, { recursive: true });

var qaDrainFrames = async () => {
  do {
    var qaBatch = await qaCdp.readEvents({
      methods: ["Page.screencastFrame"],
      afterSequence: qaFrameCursor,
      limit: 100,
      timeoutMs: 500,
    });
    qaFrameCursor = qaBatch.cursor;

    for (var qaEvent of qaBatch.events) {
      var qaFramePath = qaPath.join(
        qaFrameDir,
        `frame-${String(qaFrameIndex).padStart(6, "0")}.jpg`,
      );
      await qaFs.writeFile(
        qaFramePath,
        Buffer.from(qaEvent.params.data, "base64"),
      );
      qaFrameIndex += 1;
      await qaCdp.send("Page.screencastFrameAck", {
        sessionId: qaEvent.params.sessionId,
      });
    }
  } while (qaBatch.hasMore);
};

await qaCdp.send("Page.startScreencast", {
  format: "jpeg",
  quality: 70,
  maxWidth: 960,
  maxHeight: 720,
  everyNthFrame: 1,
});
await qaDrainFrames();
```

Do not emit `qaEvent.params.data`, frame buffers, or saved frames to model
context.

## Drive and drain

Perform each repro interaction with the already-selected `tab`, then drain and
acknowledge its frames before the next interaction:

```js
await <one browser interaction>;
await qaDrainFrames();
```

For an animation, drain repeatedly while it runs so the first unacknowledged
frame does not stall the stream:

```js
for (var qaAnimationTick = 0; qaAnimationTick < 16; qaAnimationTick += 1) {
  await qaDrainFrames();
}
```

The explicit repro step is the stop condition. Do not turn an issue clip into a
whole-run recording.

## Stop and verify

```js
await qaDrainFrames();
await qaCdp.send("Page.stopScreencast");

if (qaFrameIndex < 2) {
  throw new Error(`No sequence evidence captured: ${qaFrameIndex} frame(s)`);
}

nodeRepl.write(JSON.stringify({
  frameDirectory: qaFrameDir,
  frameCount: qaFrameIndex,
}));
```

Encode outside the browser process. `$FRAME_DIR` is the absolute directory
reported above, and the output path must be new:

```bash
ffmpeg -framerate 8 -i "$FRAME_DIR/frame-%06d.jpg" \
  -c:v libvpx-vp9 -pix_fmt yuv420p -an \
  "$RUN_DIR/clips/issue-001.webm"

ffprobe -v error -show_entries format=duration,size \
  -of json "$RUN_DIR/clips/issue-001.webm"
```

Treat an encoder failure, fewer than two frames, zero duration, or zero bytes as
no clip. Return only frame count plus final path, size, and duration, and persist
the size and duration with the issue's recording evidence. After the WebM is
verified and referenced, move the temporary frame directory to trash:

```bash
trash "$FRAME_DIR"
```

Raw CDP records page pixels, not the pointer. When an interaction leaves pixels
unchanged, this route cannot prove it unless the page exposes a visible focus,
pressed, or navigation state. State that exact blocker rather than retaining a
static clip. The fixed 8 fps encode proves visual order, not real elapsed time;
use a native recorder or state the blocker when latency or animation timing is
the claim.
