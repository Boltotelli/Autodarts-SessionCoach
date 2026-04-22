# Autodarts Session Coach (new standalone extension)

This is a fresh Chrome extension for `https://play.autodarts.io/*`.

## What is included

- automatic **daily sessions**
- live **Session Coach** overlay
- goals for:
  - Average over
  - First 9 over
  - Checkout darts under X
  - Max busts
- **Checkout Advisor v1**
- popup settings
- coach history page
- debug capture for raw WebSocket / JSON payloads

## Important first-test note

`play.autodarts.io` is a JavaScript app and the extension cannot fully inspect the live authenticated match UI from here, so the live adapter is built as a **generic bridge + parser**. It may already work on your setup, but the first real browser test is important. If some live values do not update correctly, open:

- the extension popup
- `Open coach page`

and send me the **runtime / debug log** content. Then I can tighten the parser to the exact Autodarts payload format.

## Install

1. Unzip the folder.
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the unzipped folder

## First setup

1. Open the popup.
2. Set your **Tracked player name** if needed.
3. Open `play.autodarts.io`
4. Start an x01 game.
5. Check whether the overlay starts receiving live data.

## Files

- `manifest.json`
- `shared.js`
- `page-bridge.js`
- `content.js`
- `content.css`
- `popup.html`
- `popup.js`
- `popup.css`
- `coach.html`
- `coach.js`
- `coach.css`
