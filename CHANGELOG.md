# Changelog

All notable changes to **hin's poker**.

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
