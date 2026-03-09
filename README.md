# 🎮 Multicolor Bitsy

A multicolor pixel art game editor inspired by [Bitsy](https://ledoux.itch.io/bitsy), built as a single-page React app. Designed for classroom game jams — students can make a complete game in 30–60 minutes with no coding required.

## ✨ Features

- **Pixel editor** — draw sprites & tiles with up to 16 colors, multiple animation frames
- **Room/map editor** — place tiles, NPCs, and exits to build multi-room worlds
- **PNG import** — convert any image to pixel art using median-cut quantization + Floyd-Steinberg dithering
- **Exits & Entrances** — pink portal tiles that teleport the player between rooms
- **NPC dialog** — multi-page speech (separate pages with `---`)
- **🎵 Tune editor** — 16-step melodic sequencer plays background music during playtest
- **🔊 Blip sounds** — per-NPC sound effects on interaction
- **🎒 Inventory** — items are collected and shown in the playtest HUD
- **🔍 Find** — search sprites/tiles by name
- **Asset packs** — Bug, Fantasy, Space, and School pre-made sprite/tile packs
- **Bitsy export** — exports valid `.bitsy` game data (Bitsy 8.x format) with exits and rooms

## 🚀 Getting Started

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

## 🎮 How to Use

| Tab | What it does |
|-----|-------------|
| 🧑 Sprites | Draw NPCs and the player avatar (sprite 0 = avatar) |
| 🟦 Tiles | Draw background tiles (walkable, wall, item, or end) |
| 🗺 Rooms | Place tiles and NPCs; use the 🚪 Exit tool to add portals |
| 🎵 Tune | Build a looping background melody |

### Room Tools
- **Place** — click/drag to place selected tile (click again to toggle off)
- **Erase** — remove tiles, NPCs, and exits
- **Fill** — flood-fill with the selected tile
- **NPC** — place selected sprite as an NPC (select from sprite list)
- **Exit** — click a cell to place a pink portal; a dialog lets you choose the destination room and position

### Dialog pages
Separate NPC dialog into multiple pages by putting `---` on its own line:
```
Hello traveler!
---
The dungeon is to the north.
---
Watch out for the stone walls!
```

### Exporting
Click **Export .bitsy** in the header to copy game data you can paste into the [Bitsy editor](https://ledoux.itch.io/bitsy).

## 📦 Asset Packs
- 🐝 **Bug Pack** — bee, ladybug, flower, grass, butterfly, caterpillar, mushroom, leaf
- ⚔️ **Fantasy Pack** — stone wall, dungeon floor, chest, torch, tree, knight, wizard
- 🚀 **Space Pack** — star field, moon surface, planet, rocket, alien, crystal, asteroid
- 🏫 **School Pack** — brick wall, school floor, locker, desk, student, book, sidewalk

## 🛠 Tech Stack
- React 18 + Vite
- Web Audio API (tune playback, blip sound effects)
- HTML5 Canvas (pixel editor, room canvas)
- No external CSS frameworks

## 📄 License
MIT
