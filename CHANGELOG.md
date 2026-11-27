# Changelog

All notable changes to **hin's poker**.

## v7.9 — 2026-11-25

### Changed
- Toast sits below top seats (no longer covers 老/林 cards)
- Tools row: remove 记录; remaining buttons centered
- Larger seats/avatars/plates with separated positions (no overlap)
- Hand-over: community board dims so winner five cards stand out

## v7.8 — 2026-11-25

### Fixed
- iOS home-screen PWA: force `<html>`/`body` green under translucent status bar (no white fallback)
- Re-apply status bar chrome on lobby↔game switch

## v7.7 — 2026-11-25

### Changed
- Immersive status bar: dynamic `theme-color` (lobby light / game Macau green)
- `black-translucent` + safe-area strip paints notch area to match screen
- Manifest theme/background aligned with lobby & felt

## v7.6 — 2026-11-25

### Fixed
- Solo mode no longer shows 创建/加入 (`[hidden]` was beaten by `display:grid`)
- Letter avatars: optical vertical center for CJK initials

## v7.5 — 2026-11-25

### Changed
- Lobby → single-screen game home (no scroll, no marketing copy)
- Bottom dock: current mode + primary CTA (开始游戏 / 创建·加入)
- Mode tabs 单机 / 房间; compact name, avatar, optional room code

## v7.4 — 2026-11-25

### Changed
- Mobile chrome: top title + tools + bottom action dock use frosted glass (semi-transparent blur)
- Table is full-viewport under the glass; action-bar height no longer squashes/jumps the felt
- Seats/toast/coach repositioned into the glass-safe band

## v7.3 — 2026-11-25

### Fixed
- Call then stuck on dead “过牌” button (engine advanced before UI; timeout skipped street-end)
- `doAction` re-renders from live game snapshot, not stale `lastState`
- Double-scheduled street advance / betting loop guarded by timers
- Auto-timeout uses the same completion rules as `actHero`
- Regression: `js/call-check.test.mjs`

## v7.2 — 2026-11-25

### Changed
- Felt palette → Macau casino green (`#046a38` / deep `#024a28` / glow `#0a7f4a`)

## v7.1 — 2026-11-25

### Changed
- Remove dealer well cutout from table top
- Opening/status toast sits at top-center (former dealer slot)
- Top seats nudged down to clear the toast pill

## v7.0 — 2026-11-25

### Changed
- Mobile portrait: table fills full stage height (no empty felt letterbox)
- Seats spread around full-height felt; board/pot centered
- Tools row above table; room-meta blinds hidden (shown on felt)
- Toast/coach as compact overlays on felt
- Tighter action bar; hide raise slider when not hero turn
- Larger board cards and action buttons on tall phones

## v6.9 — 2026-11-24

### Changed
- Letter avatars (Apple Contacts style): circle + name initial; no seat/dealer PNG
- Avatar fill: gray background + white initial (all seats)
- Lobby avatar picker → gray letter swatches
- Dealer badge is CSS letter “D” (no dealer.png)
- Felt polish: current-player amber ring, readable plate/toast/coach/win banner
- Lobby copy: 竖屏牌桌 · 底部操作
- Cache bust `?v=gray` for avatar color fix

## v6.8 — 2026-11-24

### Changed
- Game stage: full-bleed deep casino felt (no oval table/rail); lobby stays light
- Action buttons: large circular fold red / call blue / raise amber
- Quick raises: short chips 1/3 · 1/2 · 2/3 · 底池 · 全下
- Seat action status pills (弃牌 / 跟注 / 加注 / ALL IN / 思考中)
- Live hand-strength tag under plate (pair preflop; made hands postflop)
- Table blinds/hand number as semi-transparent felt overlay
- Cache bust `?v=v6.8`

## v6.7 — 2026-09-28

### Changed
- Mobile portrait: top tools strip → centered table → bottom action bar
- Document-flow layout (no overlapping float panels)
- Safe-area padding for notches; compact seat/table for readability
- Dealer button pinned top-center of table on mobile portrait
- Service worker: navigations are network-first; static assets cache-first
- Cache bust `?v=v6.7.2` so stale CSS/JS cannot stick after deploy

## v6.6 — 2026-09-28

### Changed
- Design tokens: 8px grid (16/24/32/40/48), radius 8–12px, light shadows
- Shell UI desaturated; no neon outlines; accent used for data/state only
- Turn indicator: state plate + soft avatar ring (no neon glow)
- Matte lobby, buttons, plates, timer, toast, action log
- Felt/cards remain controlled exceptions for readability

## v6.5 — 2026-09-28

### Added
- Raise button label follows slider as `加注 xx bb`
- Quick raises: 半池 / 全底池 / +3bb
- Action timer visible while opponents act
- Polished game homepage lobby
- Desktop centered table + bottom-center actions

### Fixed
- Raise uses chip target after drag (no more default amount)
- Opponent-turn countdown display

## v5.1 — 2026-09-28

### Added
- PWA installable (manifest + service worker + icons)
- White flat UI, mobile-first
- Game layout: table left, action controls right (all orientations)

## v4.0 — 2026-09-16

### Added
- Online status dots on human seats in multiplayer
- Host-leave / room-closed message returns guests to lobby
- Rebuy (补码) when busted between hands
- Mute toggle for all table SFX
- Rebuy tests (`rebuy.test.mjs`)

### Changed
- Victory banner / best-five panel more polished
- Desktop side-seat spacing slightly widened
- Lobby hides machine-local WS on public pages; advanced server field collapsed
- Action buttons expose aria-labels

## v3.5 — 2026-09-16

### Added
- Mute toggle, rebuy, disconnect auto-fold, safer lobby WS defaults

## v3.4 — 2026-09-15

### Added
- 30s action timer (auto check/fold)
- Quick raise presets (½ pot, ⅔ pot, pot, +3bb, +4bb)
- Chip amounts displayed as xbb (including blinds)

## v2.2 — 2026-09-15

### Added
- Phone portrait layout: vertical racetrack (semicircles top/bottom), dealer on the left, hero bottom-center, one top / two per side
- Winner's best five cards shown as small playing cards after showdown

## v2.1 — 2026-09-15

### Changed
- Slower, more elegant hole-card cascade and community-card reveals
- Longer AI thinking windows (about 1.4–2.6s) before each action
- AI strategy reworked: less random all-in, more personality-driven lines
  - tight / balanced / aggressive / maniac profiles
  - pot-odds calls, draw semi-bluffs, timed pure bluffs, thin value raises
  - avoids converting bluffs into suicide jams

### Docs
- Add this changelog and GitHub Releases history

## v2.0 — 2026-09-15

### Added
- Character portrait avatars for all six seats
- Dealer well with female dealer portrait
- Chip-stack icons beside each player's bet amount
- Wider soft padded table rail
- Deal / flop / turn / river card animations
- Neon yellow ring on the player whose turn it is

### Fixed
- Cards no longer deal to the same seat multiple times after players bust

## v1.0 — 2026-09-14

### Added
- Initial hin's poker release
- Racetrack table (straight top/bottom, semicircular ends)
- 6-max NLHE vs five AI opponents
- Manual raise input + slider
- GitHub Pages deployment
