# Feature Comparison: Standard Bitsy vs Bitsy-Color vs Multicolor-Bitsy

## Legend
- ✅ Supported
- ❌ Not supported
- 🔶 Partial / limited

| Feature | Standard Bitsy | Bitsy-Color | Multicolor-Bitsy |
|---------|---------------|-------------|------------------|
| **Core Drawing** | | | |
| Pixel art editor | ✅ | ✅ | ✅ |
| Multiple animation frames | ✅ (2 frames) | ✅ (2 frames) | ✅ (up to 8 frames) |
| Grid size options | ✅ (8×8) | ✅ (8×8) | ✅ (8, 16, 32) |
| **Colors** | | | |
| Colors per palette | 3 (bg, tile, sprite) | 16+ (indexed) | 16 (indexed) |
| Multicolor sprites | ❌ (1-bit per pixel) | ✅ (DRAW_FORMAT=1) | ✅ |
| Per-tile/sprite color index (COL) | ✅ | ✅ | 🔶 (export only) |
| BGC (background color/transparency) | ✅ (`*` = transparent) | ✅ | ❌ |
| **Transform Tools** | | | |
| Flip horizontal | ✅ | ✅ | ✅ |
| Flip vertical | ✅ | ✅ | ✅ |
| Rotate clockwise | ✅ | ✅ | ✅ |
| Rotate counter-clockwise | ✅ | ✅ | ✅ (new) |
| Mirror horizontal (symmetric) | ❌ | ✅ | ✅ (new) |
| Mirror vertical (symmetric) | ❌ | ✅ | ✅ (new) |
| Nudge (shift pixels in direction) | ❌ | ✅ | ✅ (new) |
| **Room Editing** | | | |
| Room grid editor | ✅ | ✅ | ✅ |
| Room zoom in/out | ❌ | ❌ | ✅ |
| ROOM_FORMAT 1 (multi-char IDs) | ✅ | ✅ | ✅ |
| Room exits (EXT) | ✅ | ✅ | ✅ |
| Room palette selection | ✅ | ✅ | 🔶 (single PAL 0) |
| **Game Elements** | | | |
| Tiles (walkable) | ✅ | ✅ | ✅ |
| Wall tiles (WAL) | ✅ | ✅ | ✅ |
| Item tiles (collectible) | ✅ | ✅ | ✅ |
| End tiles (win trigger) | ✅ | ✅ | ✅ |
| Sprites / NPCs | ✅ | ✅ | ✅ |
| Avatar (player character) | ✅ | ✅ | ✅ |
| **Dialog** | | | |
| Multi-page dialog (---) | ✅ | ✅ | ✅ (separate fields UI) |
| Dialog scripting (conditionals, variables) | ✅ | ✅ | ❌ |
| Dialog effects ({clr}{shk}{wvy} etc.) | ✅ | ✅ | ❌ |
| Variables (VAR) | ✅ | ✅ | ❌ |
| **Audio** | | | |
| Tune editor | ✅ | ✅ | ✅ |
| Blip sounds | ✅ | ✅ | ✅ |
| **Import / Export** | | | |
| Standard .bitsy export | ✅ | ✅ | ✅ |
| Bitsy-color export (DRAW_FORMAT=1) | ❌ | ✅ | ✅ (new) |
| .bitsy file import | ✅ | ✅ | ❌ |
| PNG import | ❌ | ❌ | ✅ |
| HTML game export | ✅ | ✅ | ❌ |
| PNG sprite/room export | ❌ | ❌ | ✅ |
| Spritesheet export | ❌ | ❌ | ✅ |
| **Cloud / Collaboration** | | | |
| Google login | ❌ | ❌ | ✅ |
| Cloud saves (Firestore) | ❌ | ❌ | ✅ |
| **UI / UX** | | | |
| Asset packs (pre-made sprites) | ❌ | ❌ | ✅ |
| In-editor playtest | ✅ | ✅ | ✅ |
| Fill tool | ✅ | ✅ | ✅ |
| Keyboard shortcuts | ✅ | ✅ | ✅ |

## Features to Consider Adding

### High Priority (would significantly improve the editor)

1. **.bitsy file import** — Students could load existing Bitsy games, remix them, or continue work started in the standard editor. This is the most-requested missing feature.

2. **Dialog scripting support** — Bitsy's dialog system supports conditionals (`{if}...{else}...{end}`), variables (`{var}`, `{set}`), and text effects (`{clr}`, `{shk}`, `{wvy}`, `{rbw}`). Even basic variable support would enable more complex game logic.

3. **HTML game export** — The ability to export a playable HTML file that students can share as a standalone web page. Standard Bitsy bundles the game data with an engine into a single HTML file.

4. **BGC (background color/transparency)** — Per-tile/sprite background color override, with `*` for transparency. This enables layered visual effects.

### Medium Priority (nice to have)

5. **Multiple palettes per room** — Standard Bitsy supports assigning different PAL IDs to different rooms for distinct visual themes.

6. **Exit transition effects (FX)** — Room transitions can have visual effects like fade, wave, tunnel etc. (`EXT x,y room x,y FX effect_name`).

7. **Per-sprite/tile COL selection in editor** — Currently COL is only written on export. Letting users pick which palette color index a tile or sprite uses would give more visual control.

8. **Undo/redo** — Critical for any drawing editor, especially for younger users who may make mistakes.

### Lower Priority (advanced features)

9. **Dialog effects UI** — A toolbar or button bar that inserts `{clr}`, `{shk}`, `{wvy}`, `{rbw}` tags into dialog text for text animation effects.

10. **Variable editor** — A simple UI for defining game variables (VAR) and using them in dialog conditionals.

11. **Copy/paste tiles between rooms** — Select a region of tiles in one room and paste into another.

12. **Room duplication** — Quick duplicate an entire room as a starting point.
