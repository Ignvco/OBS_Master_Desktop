# OBS MASTER 5.0 — Direct Integration RC0 (experimental)

This branch is intentionally isolated from v4.2 `main`.

## What was implemented

- Output selector in the **En Vivo** workspace: `OBS Studio` or `Direct Engine`.
- Dedicated `En Vivo · Direct` graphic controls with Show/Hide, Replay Motion and Hide All.
- Uses the **existing** station state endpoints and SSE overlay renderer. The `visibleInOBS` field is retained as a compatibility field. Renaming or migrating this field needs a dedicated later step.
- Direct graphic commands do not require OBS WebSocket.
- Direct mode disconnects any OBS WebSocket session in the current app window.
- Publishing keeps the existing on-air protection. Hide → Publish → Show is the intended workflow.
- Existing publication history is unchanged: Show, Hide, Replay and Publish do **not** create versions.
- Additional unit tests for Direct state operations.

## What was NOT implemented

- The Windows camera driver or packaged Unity Capture integration.
- A bundled Python service or process supervisor in Electron.
- GPU-accelerated HTML composition or stable 1080p video output.
- Genuine preview/program monitoring, scene switching and OBS scene-transition equivalents.
- Actual verification of video frames received by Unity Capture or StreamYard.
- An installable executable for this branch.

For now keep your validated `Direct Engine Lab` running on Windows 10; `Unity Video Capture` is still its device name. The station server must remain active.

## Important current limitation

The laboratory script captures **one** published HTML graphic URL at a time. The Direct panel's status reports that the station state changed, **not** that the laboratory compositor is displaying a given graphic. Multiple concurrent overlays, real source routing, safety acknowledgements and frame-level monitoring remain to be implemented. Avoid public live use of this experimental branch.

## Local validation checklist (Windows)

1. Back up your v4.2 AppData, runtime content and existing working installer.
2. Check out this branch in a separate directory and install via `npm ci`.
3. Run `npm run lint`, `npm run test:core`, `npm run build` and `npm run desktop:server`.
4. Confirm original OBS mode still works with its original source bindings.
5. Select **Direct Engine** from En Vivo and confirm it does not require OBS.
6. Check lower-third Show → Hide, Motion replay, and Hide All with the station running.
7. Hide a graphic, edit and publish it, then show it again. Verify no new revision was created.
8. Independently inspect StreamYard video; the interface does not attest to frame delivery.

Do not merge into `main` until validation on Windows and the direct motor lifecycle integration are completed.
