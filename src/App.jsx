import { useState, useRef, useCallback, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_PALETTE = [
  "#000000","#ffffff","#ff004d","#ffa300",
  "#ffec27","#00e436","#29adff","#7e2553",
  "#83769c","#ff77a8","#ffccaa","#1d2b53",
  "#008751","#ab5236","#5f574f","#c2c3c7",
];
const GRID_OPTIONS = [8, 16, 32];
const MAX_FRAMES = 8;
const MAX_COLORS = 16;
const TILE_TYPES = ["walkable","wall","item","end"];
const TILE_TYPE_COLORS = { walkable:"#4ade80", wall:"#f87171", item:"#fbbf24", end:"#60a5fa" };
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const TUNE_STEPS = 16;

// ─── Sound ────────────────────────────────────────────────────────────────────
let _audioCtx = null;
function getAudioCtx() {
  try { if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return _audioCtx; } catch(e) { return null; }
}
function noteFreq(semi) { return 130.81 * Math.pow(2, semi / 12); }
function playBlip(wave="square", freq=440, dur=0.15, vol=0.25) {
  try {
    const ctx = getAudioCtx(); if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = wave; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
  } catch(e) {}
}

// ─── Pre-made Asset Packs ─────────────────────────────────────────────────────
const ASSET_PACKS = [
  {
    name: "🐝 Bug Pack", color: "#00e436",
    assets: [
      { name:"Bee", itemType:"sprite", tileType:"walkable", dialog:"Bzzzz! I make honey!", grid:[
        [0,0,1,0,0,1,0,0],[0,1,1,0,0,1,1,0],[0,0,4,4,4,4,0,0],[0,0,4,0,0,4,0,0],
        [0,0,4,4,4,4,0,0],[0,0,4,0,0,4,0,0],[0,0,4,4,4,4,0,0],[0,0,0,4,4,0,0,0],
      ]},
      { name:"Ladybug", itemType:"sprite", tileType:"walkable", dialog:"Count my spots!", grid:[
        [0,0,0,0,0,0,0,0],[0,0,0,14,14,0,0,0],[0,0,14,14,14,14,0,0],[0,2,2,14,14,2,2,0],
        [2,2,14,2,2,14,2,2],[0,2,2,2,2,2,2,0],[0,0,2,2,2,2,0,0],[0,0,0,0,0,0,0,0],
      ]},
      { name:"Flower", itemType:"sprite", tileType:"walkable", dialog:"I smell so nice~", grid:[
        [0,0,9,0,0,9,0,0],[0,9,9,9,9,9,9,0],[0,9,9,4,4,9,9,0],[0,0,4,4,4,4,0,0],
        [0,9,9,4,4,9,9,0],[0,9,9,9,9,9,9,0],[0,0,0,12,12,0,0,0],[0,0,12,12,12,0,0,0],
      ]},
      { name:"Grass", itemType:"tile", tileType:"walkable", grid:[
        [5,12,5,5,12,5,5,12],[5,5,5,12,5,5,12,5],[12,5,12,5,5,12,5,5],[5,5,5,5,12,5,5,5],
        [5,12,5,12,5,5,12,5],[5,5,12,5,5,5,5,12],[12,5,5,5,12,5,12,5],[5,5,5,12,5,12,5,5],
      ]},
      { name:"Butterfly", itemType:"sprite", tileType:"walkable", dialog:"I love flying!", grid:[
        [0,6,6,0,0,9,9,0],[6,6,6,0,0,9,9,9],[6,4,6,0,0,9,4,9],[0,6,0,14,14,0,9,0],
        [0,3,0,14,14,0,3,0],[3,3,4,0,0,4,3,3],[3,3,0,0,0,0,3,3],[0,3,0,0,0,0,3,0],
      ]},
      { name:"Caterpillar", itemType:"sprite", tileType:"walkable", dialog:"One day I'll fly...", grid:[
        [0,0,0,0,0,0,0,0],[0,5,5,5,5,5,5,0],[5,5,5,5,5,5,5,5],[12,5,5,5,5,5,5,12],
        [5,5,5,5,5,5,5,5],[0,5,0,5,0,5,0,5],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],
      ]},
      { name:"Mushroom", itemType:"sprite", tileType:"item", dialog:"", grid:[
        [0,0,2,2,2,2,0,0],[0,2,2,1,2,2,2,0],[2,2,2,2,2,1,2,2],[2,2,2,2,2,2,2,2],
        [0,2,2,2,2,2,2,0],[0,0,1,1,1,1,0,0],[0,0,1,1,1,1,0,0],[0,0,0,0,0,0,0,0],
      ]},
      { name:"Leaf", itemType:"sprite", tileType:"item", dialog:"", grid:[
        [0,0,0,5,5,0,0,0],[0,0,5,5,5,5,0,0],[0,5,5,12,5,5,5,0],[5,5,12,5,12,5,5,0],
        [0,5,5,12,5,5,5,0],[0,0,5,5,5,5,0,0],[0,0,0,5,12,0,0,0],[0,0,0,0,12,0,0,0],
      ]},
    ],
  },
  {
    name: "⚔️ Fantasy Pack", color: "#ffa300",
    assets: [
      { name:"Stone Wall", itemType:"tile", tileType:"wall", grid:[
        [14,15,15,14,14,15,15,14],[14,15,15,14,14,15,15,14],[14,14,14,14,14,14,14,14],[15,14,15,15,15,14,15,15],
        [15,14,15,15,15,14,15,15],[14,14,14,14,14,14,14,14],[14,15,15,14,14,15,15,14],[14,15,15,14,14,15,15,14],
      ]},
      { name:"Dungeon Floor", itemType:"tile", tileType:"walkable", grid:[
        [14,14,14,14,14,14,14,14],[14,8,8,14,8,8,8,14],[14,8,8,8,8,14,8,14],[14,14,8,8,14,8,8,14],
        [14,8,14,8,8,8,14,14],[14,8,8,8,14,8,8,14],[14,8,8,14,8,8,8,14],[14,14,14,14,14,14,14,14],
      ]},
      { name:"Chest", itemType:"sprite", tileType:"item", dialog:"", grid:[
        [0,13,13,13,13,13,13,0],[13,3,3,3,3,3,3,13],[13,3,4,3,3,4,3,13],[13,13,13,13,13,13,13,13],
        [13,14,14,4,4,14,14,13],[13,14,4,14,14,4,14,13],[13,14,14,14,14,14,14,13],[0,13,13,13,13,13,13,0],
      ]},
      { name:"Torch", itemType:"sprite", tileType:"walkable", dialog:"The flames light your way.", grid:[
        [0,0,0,2,3,0,0,0],[0,0,2,4,2,2,0,0],[0,0,3,4,4,2,0,0],[0,0,2,3,3,2,0,0],
        [0,0,0,13,0,0,0,0],[0,0,0,13,0,0,0,0],[0,0,0,13,0,0,0,0],[0,0,13,13,13,0,0,0],
      ]},
      { name:"Tree", itemType:"sprite", tileType:"wall", dialog:"", grid:[
        [0,0,5,5,5,0,0,0],[0,5,5,12,5,5,0,0],[5,5,12,5,12,5,5,0],[0,5,5,5,5,5,0,0],
        [0,0,5,12,5,0,0,0],[0,0,13,13,0,0,0,0],[0,0,13,13,0,0,0,0],[0,13,13,13,13,0,0,0],
      ]},
      { name:"Fantasy Grass", itemType:"tile", tileType:"walkable", grid:[
        [5,12,5,5,5,12,5,5],[5,5,5,12,5,5,5,12],[12,5,5,5,12,5,5,5],[5,5,12,5,5,5,12,5],
        [5,12,5,5,12,5,5,5],[5,5,5,12,5,5,5,12],[12,5,5,5,5,12,5,5],[5,5,12,5,5,5,5,12],
      ]},
      { name:"Knight", itemType:"sprite", tileType:"walkable", dialog:"For the kingdom!", grid:[
        [0,0,15,15,15,0,0,0],[0,0,15,1,15,0,0,0],[0,0,8,8,8,0,0,0],[0,8,8,8,8,8,0,0],
        [8,8,8,8,8,8,8,0],[0,0,8,8,8,0,0,0],[0,0,8,0,8,0,0,0],[0,15,15,0,15,15,0,0],
      ]},
      { name:"Wizard", itemType:"sprite", tileType:"walkable", dialog:"The magic is within you.", grid:[
        [0,0,7,4,7,0,0,0],[0,7,7,7,7,7,0,0],[0,0,10,10,10,0,0,0],[0,7,7,10,7,7,0,0],
        [0,7,7,10,7,7,0,0],[7,7,7,10,7,7,7,0],[0,0,7,0,7,0,0,0],[0,0,7,0,7,0,0,0],
      ]},
    ],
  },
  {
    name: "🚀 Space Pack", color: "#29adff",
    assets: [
      { name:"Star Field", itemType:"tile", tileType:"walkable", grid:[
        [11,11,1,11,11,11,11,11],[11,11,11,11,1,11,11,11],[11,11,11,11,11,11,1,11],[11,1,11,11,11,11,11,11],
        [11,11,11,11,11,1,11,11],[11,11,11,1,11,11,11,11],[11,11,11,11,11,11,11,1],[1,11,11,11,11,11,11,11],
      ]},
      { name:"Moon Surface", itemType:"tile", tileType:"walkable", grid:[
        [15,15,15,15,15,15,15,15],[15,8,8,15,15,15,15,15],[15,8,8,8,15,15,15,15],[15,15,8,15,15,8,8,15],
        [15,15,15,15,15,8,8,15],[15,15,15,15,15,15,15,15],[15,15,15,8,8,15,15,15],[15,15,8,8,15,15,15,15],
      ]},
      { name:"Space Wall", itemType:"tile", tileType:"wall", grid:[
        [11,11,11,11,11,11,11,11],[11,14,14,11,14,14,11,11],[11,14,8,14,14,8,14,11],[11,14,14,11,14,14,11,11],
        [11,11,11,11,11,11,11,11],[11,14,11,14,11,14,11,11],[11,14,14,14,14,14,11,11],[11,11,11,11,11,11,11,11],
      ]},
      { name:"Planet", itemType:"sprite", tileType:"walkable", dialog:"A whole new world...", grid:[
        [0,0,6,6,6,0,0,0],[0,6,11,6,6,6,0,0],[6,6,6,11,6,6,6,0],[6,11,6,6,11,6,6,0],
        [6,6,6,6,6,6,6,0],[0,6,6,6,6,6,0,0],[0,0,6,6,6,0,0,0],[0,0,0,0,0,0,0,0],
      ]},
      { name:"Rocket", itemType:"sprite", tileType:"walkable", dialog:"3... 2... 1... Blast off!", grid:[
        [0,0,0,1,0,0,0,0],[0,0,1,1,1,0,0,0],[0,0,15,6,15,0,0,0],[0,0,15,6,15,0,0,0],
        [0,0,15,15,15,0,0,0],[0,2,15,15,15,2,0,0],[0,2,2,15,2,2,0,0],[0,0,2,0,2,0,0,0],
      ]},
      { name:"Alien", itemType:"sprite", tileType:"walkable", dialog:"Greetings, Earthling!", grid:[
        [0,0,5,5,5,5,0,0],[0,5,5,5,5,5,5,0],[0,5,1,5,5,1,5,0],[0,5,0,5,5,0,5,0],
        [0,5,5,5,5,5,5,0],[5,5,5,5,5,5,5,5],[5,0,5,5,5,5,0,5],[0,0,5,0,0,5,0,0],
      ]},
      { name:"Crystal", itemType:"sprite", tileType:"item", dialog:"", grid:[
        [0,0,0,6,0,0,0,0],[0,0,6,1,6,0,0,0],[0,6,1,6,6,6,0,0],[6,6,6,6,6,6,6,0],
        [6,6,6,6,6,6,6,0],[0,6,6,6,6,6,0,0],[0,0,6,6,6,0,0,0],[0,0,0,6,0,0,0,0],
      ]},
      { name:"Asteroid", itemType:"sprite", tileType:"wall", dialog:"", grid:[
        [0,0,14,14,14,0,0,0],[0,14,14,14,14,14,0,0],[14,14,8,14,14,14,14,0],[14,14,14,8,14,8,14,0],
        [14,14,14,14,14,14,0,0],[0,14,14,8,14,0,0,0],[0,0,14,14,0,0,0,0],[0,0,0,0,0,0,0,0],
      ]},
    ],
  },
  {
    name: "🏫 School Pack", color: "#ff77a8",
    assets: [
      { name:"Brick Wall", itemType:"tile", tileType:"wall", grid:[
        [2,2,2,13,2,2,2,13],[2,2,2,13,2,2,2,13],[13,13,13,13,13,13,13,13],[2,13,2,2,2,13,2,2],
        [2,13,2,2,2,13,2,2],[13,13,13,13,13,13,13,13],[2,2,2,13,2,2,2,13],[2,2,2,13,2,2,2,13],
      ]},
      { name:"School Floor", itemType:"tile", tileType:"walkable", grid:[
        [15,15,15,15,15,15,15,15],[15,8,8,8,8,8,8,15],[15,8,15,8,8,15,8,15],[15,8,8,8,8,8,8,15],
        [15,15,8,8,8,8,15,15],[15,8,8,8,8,8,8,15],[15,8,15,8,8,15,8,15],[15,15,15,15,15,15,15,15],
      ]},
      { name:"Locker", itemType:"sprite", tileType:"wall", dialog:"", grid:[
        [14,14,14,14,14,14,0,0],[14,15,15,15,15,14,0,0],[14,15,0,15,15,14,0,0],[14,14,14,14,14,14,0,0],
        [14,15,15,15,15,14,0,0],[14,15,15,15,15,14,0,0],[14,15,15,15,15,14,0,0],[14,14,14,14,14,14,0,0],
      ]},
      { name:"Desk", itemType:"sprite", tileType:"wall", dialog:"", grid:[
        [0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[13,13,13,13,13,13,13,0],[13,13,1,13,13,13,13,0],
        [13,13,13,13,13,13,13,0],[13,13,13,13,13,13,13,0],[0,13,0,0,0,13,0,0],[0,13,0,0,0,13,0,0],
      ]},
      { name:"Student", itemType:"sprite", tileType:"walkable", dialog:"Did you finish homework?", grid:[
        [0,0,13,13,13,0,0,0],[0,13,10,10,10,0,0,0],[0,0,10,0,0,10,0,0],[0,0,10,10,10,0,0,0],
        [0,6,6,6,6,6,0,0],[0,3,6,6,6,3,0,0],[0,0,11,0,11,0,0,0],[0,0,14,0,14,0,0,0],
      ]},
      { name:"Book", itemType:"sprite", tileType:"item", dialog:"", grid:[
        [0,0,0,0,0,0,0,0],[0,2,2,2,2,2,0,0],[0,2,1,1,1,2,0,0],[0,2,1,14,1,2,0,0],
        [0,2,1,1,1,2,0,0],[0,2,1,14,1,2,0,0],[0,2,2,2,2,2,0,0],[0,0,0,0,0,0,0,0],
      ]},
      { name:"Town Tree", itemType:"sprite", tileType:"wall", dialog:"", grid:[
        [0,0,5,5,5,0,0,0],[0,5,5,12,5,5,0,0],[5,5,12,5,12,5,5,0],[0,5,5,5,5,5,0,0],
        [0,0,5,5,5,0,0,0],[0,0,13,13,0,0,0,0],[0,0,13,13,0,0,0,0],[0,13,13,13,13,0,0,0],
      ]},
      { name:"Sidewalk", itemType:"tile", tileType:"walkable", grid:[
        [8,8,8,8,8,8,8,8],[8,15,15,8,8,15,15,8],[8,15,15,8,8,15,15,8],[8,8,8,8,8,8,8,8],
        [8,8,8,8,8,8,8,8],[8,15,15,8,8,15,15,8],[8,15,15,8,8,15,15,8],[8,8,8,8,8,8,8,8],
      ]},
    ],
  },
  {
    name: "⚽ Sports Pack", color: "#ffec27",
    assets: [
      { name:"Soccer Ball", itemType:"sprite", tileType:"item", dialog:"", grid:[
        [0,0,1,1,1,1,0,0],[0,1,1,14,1,1,1,0],[1,1,14,1,1,14,1,0],[1,14,1,1,14,1,1,0],
        [1,1,14,1,1,1,1,0],[1,14,1,14,1,1,1,0],[0,1,1,1,14,1,1,0],[0,0,1,1,1,1,0,0],
      ]},
      { name:"Basketball", itemType:"sprite", tileType:"item", dialog:"", grid:[
        [0,0,3,3,3,3,0,0],[0,3,3,13,3,3,3,0],[3,3,13,3,3,3,3,0],[3,3,3,13,3,3,3,0],
        [3,3,3,3,13,3,3,0],[3,13,3,3,3,13,3,0],[0,3,3,3,3,3,3,0],[0,0,3,3,3,3,0,0],
      ]},
      { name:"Trophy", itemType:"sprite", tileType:"item", dialog:"You win!", grid:[
        [0,4,0,0,0,0,4,0],[4,4,4,4,4,4,4,0],[4,4,4,4,4,4,4,0],[0,4,4,4,4,4,0,0],
        [0,0,4,4,4,0,0,0],[0,0,4,4,4,0,0,0],[0,4,4,4,4,4,0,0],[4,4,4,4,4,4,4,0],
      ]},
      { name:"Goal Post", itemType:"sprite", tileType:"wall", dialog:"", grid:[
        [1,0,0,0,0,0,0,1],[1,1,1,1,1,1,1,1],[1,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,1],
      ]},
      { name:"Coach", itemType:"sprite", tileType:"walkable", dialog:"Great hustle out there!", blip:{wave:"square",freq:330}, grid:[
        [0,0,14,14,14,0,0,0],[0,0,10,10,10,0,0,0],[0,0,10,0,10,0,0,0],[0,0,10,10,10,0,0,0],
        [0,2,2,2,2,2,0,0],[0,0,2,2,2,0,0,0],[0,0,14,0,14,0,0,0],[0,0,14,0,14,0,0,0],
      ]},
      { name:"Track Lane", itemType:"tile", tileType:"walkable", grid:[
        [3,3,3,3,3,3,3,3],[3,3,3,3,3,3,3,3],[1,1,1,1,1,1,1,1],[3,3,3,3,3,3,3,3],
        [3,3,3,3,3,3,3,3],[1,1,1,1,1,1,1,1],[3,3,3,3,3,3,3,3],[3,3,3,3,3,3,3,3],
      ]},
      { name:"Gym Floor", itemType:"tile", tileType:"walkable", grid:[
        [13,13,13,13,13,13,13,13],[3,3,3,3,3,3,3,3],[13,13,13,13,13,13,13,13],[13,13,13,13,13,13,13,13],
        [3,3,3,3,3,3,3,3],[13,13,13,13,13,13,13,13],[13,13,13,13,13,13,13,13],[3,3,3,3,3,3,3,3],
      ]},
      { name:"Scoreboard", itemType:"sprite", tileType:"wall", dialog:"The game is on!", grid:[
        [14,14,14,14,14,14,0,0],[14,1,1,14,1,1,14,0],[14,1,1,14,1,1,14,0],[14,14,14,14,14,14,0,0],
        [14,2,2,14,5,5,14,0],[14,2,2,14,5,5,14,0],[14,14,14,14,14,14,0,0],[0,14,14,14,14,0,0,0],
      ]},
    ],
  },
  {
    name: "🐾 Animal Pack", color: "#ab5236",
    assets: [
      { name:"Cat", itemType:"sprite", tileType:"walkable", dialog:"Meow~", blip:{wave:"sine",freq:660}, grid:[
        [14,0,0,0,0,0,14,0],[0,14,14,14,14,14,0,0],[0,14,1,14,14,1,14,0],[0,14,14,9,14,14,0,0],
        [0,14,14,14,14,14,0,0],[0,0,14,14,14,0,0,0],[0,14,0,0,14,14,14,0],[14,0,0,0,0,14,0,0],
      ]},
      { name:"Dog", itemType:"sprite", tileType:"walkable", dialog:"Woof! Woof!", blip:{wave:"square",freq:220}, grid:[
        [0,13,0,0,0,13,0,0],[0,13,13,13,13,13,0,0],[0,13,1,13,1,13,0,0],[0,13,13,1,13,13,0,0],
        [0,0,13,13,13,0,0,0],[0,0,13,13,13,0,0,0],[0,13,0,0,0,13,0,0],[0,13,0,0,0,13,0,0],
      ]},
      { name:"Rabbit", itemType:"sprite", tileType:"walkable", dialog:"*sniff sniff*", blip:{wave:"triangle",freq:880}, grid:[
        [0,1,0,0,0,1,0,0],[0,1,0,0,0,1,0,0],[0,0,1,1,1,0,0,0],[0,0,1,9,1,0,0,0],
        [0,0,1,1,1,0,0,0],[0,1,1,1,1,1,0,0],[0,1,0,0,0,1,0,0],[0,1,0,0,0,1,0,0],
      ]},
      { name:"Bird", itemType:"sprite", tileType:"walkable", dialog:"Tweet tweet!", blip:{wave:"sine",freq:1320}, grid:[
        [0,0,0,6,6,0,0,0],[0,0,6,6,6,6,0,0],[0,0,6,1,6,6,0,0],[0,6,6,6,6,6,4,0],
        [5,5,5,6,6,6,4,0],[0,0,5,6,6,5,0,0],[0,0,14,6,6,14,0,0],[0,0,0,0,0,0,0,0],
      ]},
      { name:"Deer", itemType:"sprite", tileType:"walkable", dialog:"...", blip:{wave:"triangle",freq:440}, grid:[
        [13,0,0,0,0,0,13,0],[0,13,0,0,0,13,0,0],[0,0,10,10,10,0,0,0],[0,0,10,1,10,0,0,0],
        [0,0,10,10,10,0,0,0],[0,0,13,13,13,0,0,0],[0,13,0,0,0,13,0,0],[0,13,0,0,0,13,0,0],
      ]},
      { name:"Meadow", itemType:"tile", tileType:"walkable", grid:[
        [5,5,5,5,5,5,5,5],[5,4,5,5,5,4,5,5],[5,5,5,12,5,5,5,12],[5,5,12,5,5,5,12,5],
        [5,5,5,5,5,5,5,5],[5,4,5,5,5,4,5,5],[12,5,5,5,12,5,5,5],[5,5,5,12,5,5,5,5],
      ]},
      { name:"Pond", itemType:"tile", tileType:"walkable", grid:[
        [6,6,11,11,11,11,6,6],[6,11,11,11,11,11,11,6],[11,11,1,11,11,1,11,11],[11,11,11,11,11,11,11,11],
        [11,11,11,1,11,11,11,11],[11,1,11,11,11,11,11,11],[6,11,11,11,11,11,11,6],[6,6,11,11,11,11,6,6],
      ]},
      { name:"Forest Floor", itemType:"tile", tileType:"walkable", grid:[
        [13,13,12,13,13,12,13,13],[13,12,13,13,12,13,13,12],[12,13,13,12,13,13,12,13],[13,13,12,13,13,12,13,13],
        [13,12,13,13,12,13,13,12],[12,13,13,12,13,13,12,13],[13,13,12,13,13,12,13,13],[13,12,13,13,12,13,13,12],
      ]},
    ],
  },
];

// ─── Wizard Presets ───────────────────────────────────────────────────────────
const WIZARD_CHARS = [
  { name:"Robot",   grid:[[0,0,15,15,15,15,0,0],[0,15,1,15,15,1,15,0],[15,15,15,15,15,15,15,15],[15,8,0,15,15,0,8,15],[15,15,15,15,15,15,15,15],[0,0,15,8,8,15,0,0],[0,15,15,0,0,15,15,0],[0,15,0,0,0,0,15,0]] },
  { name:"Cat",     grid:[[3,0,0,0,0,0,0,3],[3,3,0,0,0,0,3,3],[0,3,3,3,3,3,3,0],[0,3,6,3,3,6,3,0],[0,3,3,3,3,3,3,0],[0,3,3,2,3,3,3,0],[0,3,3,3,3,3,3,0],[0,0,3,0,0,3,0,0]] },
  { name:"Alien",   grid:[[0,0,5,5,5,5,0,0],[0,5,5,5,5,5,5,0],[5,4,5,5,5,5,4,5],[5,5,5,5,5,5,5,5],[0,5,5,5,5,5,5,0],[0,0,5,1,1,5,0,0],[0,5,5,5,5,5,5,0],[0,0,5,0,0,5,0,0]] },
  { name:"Ghost",   grid:[[0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0],[1,1,6,1,1,6,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,0,1,0,0,1,0,1],[0,0,0,0,0,0,0,0]] },
  { name:"Wizard",  grid:[[0,0,0,4,4,0,0,0],[0,0,4,4,4,4,0,0],[0,7,7,7,7,7,7,0],[7,7,10,7,7,10,7,7],[7,7,7,7,7,7,7,7],[0,7,7,7,7,7,7,0],[0,0,7,7,7,7,0,0],[0,7,7,0,0,7,7,0]] },
  { name:"Knight",  grid:[[0,15,15,15,15,15,15,0],[15,15,15,15,15,15,15,15],[15,8,1,15,15,1,8,15],[0,15,15,15,15,15,15,0],[0,15,15,15,15,15,15,0],[0,15,8,15,15,8,15,0],[0,0,15,15,15,15,0,0],[0,0,15,0,0,15,0,0]] },
  { name:"Fox",     grid:[[3,0,0,0,0,0,0,3],[3,3,0,0,0,0,3,3],[0,3,3,3,3,3,3,0],[0,3,1,3,3,1,3,0],[0,3,3,1,1,3,3,0],[1,3,3,3,3,3,3,1],[0,3,3,3,3,3,3,0],[0,0,3,0,0,3,0,0]] },
  { name:"Hero",    grid:[[0,0,10,10,10,10,0,0],[0,10,10,10,10,10,10,0],[0,10,1,10,10,1,10,0],[0,6,6,6,6,6,6,0],[6,6,6,6,6,6,6,6],[0,6,6,6,6,6,6,0],[0,0,10,0,0,10,0,0],[0,0,10,0,0,10,0,0]] },
];
const WIZARD_WORLDS = [
  { name:"🌲 Forest", floorName:"Grass", wallName:"Tree",
    floor:[[5,12,5,5,5,12,5,5],[5,5,5,12,5,5,5,12],[12,5,5,5,5,5,12,5],[5,5,12,5,12,5,5,5],[5,12,5,5,5,5,12,5],[5,5,5,12,5,12,5,5],[12,5,5,5,5,5,5,12],[5,5,12,5,5,12,5,5]],
    wall:[[0,0,12,12,12,12,0,0],[0,12,12,5,12,12,12,0],[12,12,5,12,5,12,12,12],[12,5,12,12,12,5,12,12],[0,12,12,12,12,12,12,0],[0,0,13,13,0,0,0,0],[0,0,13,13,0,0,0,0],[0,13,13,13,13,0,0,0]] },
  { name:"🏰 Dungeon", floorName:"Stone Floor", wallName:"Brick Wall",
    floor:[[14,14,14,14,15,14,14,14],[14,8,14,14,14,8,14,14],[14,14,14,14,14,14,14,14],[15,14,14,8,14,14,14,15],[14,14,14,14,14,14,14,14],[14,8,14,14,14,8,14,14],[14,14,14,14,14,14,14,14],[14,14,14,15,14,14,14,14]],
    wall:[[11,11,11,11,11,11,11,11],[11,8,8,11,11,8,8,11],[11,8,8,11,11,8,8,11],[11,11,11,11,11,11,11,11],[11,8,11,11,11,11,8,11],[11,8,11,11,11,11,8,11],[11,11,11,11,11,11,11,11],[11,8,8,11,11,8,8,11]] },
  { name:"🚀 Space", floorName:"Star Field", wallName:"Asteroid",
    floor:[[11,11,11,4,11,11,11,11],[11,11,11,11,11,1,11,11],[11,4,11,11,11,11,11,11],[11,11,11,11,11,11,4,11],[11,11,11,1,11,11,11,11],[11,11,11,11,11,4,11,11],[11,1,11,11,11,11,11,11],[11,11,11,11,11,11,1,11]],
    wall:[[0,0,14,14,14,14,0,0],[0,14,14,8,8,14,14,0],[14,14,8,14,14,8,14,14],[14,8,14,14,14,14,8,14],[14,14,14,8,8,14,14,14],[14,8,14,14,14,14,8,14],[0,14,14,14,14,14,14,0],[0,0,14,14,14,14,0,0]] },
  { name:"🏙️ City", floorName:"Sidewalk", wallName:"Building",
    floor:[[15,15,15,15,15,15,15,15],[15,8,15,15,15,15,8,15],[15,15,15,15,15,15,15,15],[15,15,15,8,8,15,15,15],[15,15,15,8,8,15,15,15],[15,15,15,15,15,15,15,15],[15,8,15,15,15,15,8,15],[15,15,15,15,15,15,15,15]],
    wall:[[11,6,6,11,11,6,6,11],[11,6,4,11,11,4,6,11],[11,6,6,11,11,6,6,11],[11,11,11,11,11,11,11,11],[11,6,6,11,11,6,6,11],[11,4,6,11,11,6,4,11],[11,6,6,11,11,6,6,11],[11,11,11,11,11,11,11,11]] },
];

// ─── Utility ──────────────────────────────────────────────────────────────────
function quantizeColors(pixels, maxColors) {
  const colorMap = new Map();
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a < 128) continue;
    const key = `${pixels[i]},${pixels[i+1]},${pixels[i+2]}`;
    colorMap.set(key, (colorMap.get(key) || 0) + 1);
  }
  let buckets = [Array.from(colorMap.entries()).map(([k, count]) => {
    const [r,g,b] = k.split(",").map(Number);
    return { r, g, b, count };
  })];
  while (buckets.length < maxColors) {
    let maxRange = -1, maxIdx = 0;
    buckets.forEach((bucket, idx) => {
      if (bucket.length < 2) return;
      const ranges = ["r","g","b"].map(ch => {
        const vals = bucket.map(c => c[ch]);
        return Math.max(...vals) - Math.min(...vals);
      });
      const range = Math.max(...ranges);
      if (range > maxRange) { maxRange = range; maxIdx = idx; }
    });
    if (maxRange <= 0) break;
    const bucket = buckets[maxIdx];
    const ranges = ["r","g","b"].map(ch => {
      const vals = bucket.map(c => c[ch]);
      return Math.max(...vals) - Math.min(...vals);
    });
    const splitCh = ["r","g","b"][ranges.indexOf(Math.max(...ranges))];
    bucket.sort((a,b) => a[splitCh] - b[splitCh]);
    const mid = Math.floor(bucket.length / 2);
    buckets.splice(maxIdx, 1, bucket.slice(0, mid), bucket.slice(mid));
  }
  return buckets.filter(b => b.length > 0).map(bucket => {
    let tr=0,tg=0,tb=0,total=0;
    bucket.forEach(c => { tr+=c.r*c.count; tg+=c.g*c.count; tb+=c.b*c.count; total+=c.count; });
    return { r:Math.round(tr/total), g:Math.round(tg/total), b:Math.round(tb/total) };
  });
}
function rgbToHex(r,g,b) { return "#"+[r,g,b].map(v=>v.toString(16).padStart(2,"0")).join(""); }
function hexToRgb(hex) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? {r:parseInt(m[1],16),g:parseInt(m[2],16),b:parseInt(m[3],16)} : {r:0,g:0,b:0};
}
function nearestColor(r,g,b,palette) {
  let best=0,bestDist=Infinity;
  palette.forEach((hex,i) => {
    const c=hexToRgb(hex);
    const d=(r-c.r)**2+(g-c.g)**2+(b-c.b)**2;
    if(d<bestDist){bestDist=d;best=i;}
  });
  return best;
}
function emptyGrid(w,h) { return Array.from({length:h},()=>Array(w).fill(0)); }

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  app:{ fontFamily:"'Inter',system-ui,sans-serif", background:"#0f172a", color:"#e2e8f0", minHeight:"100vh", display:"flex", flexDirection:"column" },
  header:{ background:"#1e293b", padding:"7px 16px", display:"flex", alignItems:"center", gap:10, borderBottom:"1px solid rgba(255,255,255,0.06)", boxShadow:"0 1px 12px rgba(0,0,0,0.5)", flexShrink:0 },
  title:{ fontSize:15, fontWeight:800, color:"#38bdf8", letterSpacing:"-0.3px", whiteSpace:"nowrap" },
  modeBar:{ background:"#162032", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", padding:"0 10px", flexShrink:0, gap:2 },
  modeBtn:(active)=>({ padding:"9px 20px", background:active?"#38bdf8":"transparent", color:active?"#0f172a":"#64748b", border:"none", cursor:"pointer", fontSize:13, fontWeight:700, transition:"all .12s", display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }),
  main:{ display:"flex", flex:1, overflow:"hidden" },
  sidebar:{ width:256, background:"#1e293b", padding:"6px", overflowY:"auto", borderRight:"1px solid rgba(255,255,255,0.06)", flexShrink:0 },
  center:{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start", paddingTop:16, paddingBottom:20, paddingLeft:20, paddingRight:20, overflow:"auto", background:"#0f172a" },
  rightPanel:{ width:272, background:"#1e293b", padding:"6px", overflowY:"auto", borderLeft:"1px solid rgba(255,255,255,0.06)", flexShrink:0 },
  section:{ marginBottom:6, background:"rgba(255,255,255,0.025)", borderRadius:8, padding:"9px 10px", border:"1px solid rgba(255,255,255,0.05)" },
  sectionTitle:{ fontSize:10, fontWeight:700, textTransform:"uppercase", color:"#38bdf8", marginBottom:7, letterSpacing:"0.1em" },
  btn:(active)=>({ padding:"5px 10px", background:active?"#38bdf8":"rgba(255,255,255,0.05)", color:active?"#0f172a":"#e2e8f0", border:active?"1px solid #38bdf8":"1px solid rgba(255,255,255,0.08)", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:600, transition:"all .1s", whiteSpace:"nowrap" }),
  btnPrimary:{ padding:"7px 18px", background:"#38bdf8", color:"#0f172a", border:"none", borderRadius:7, cursor:"pointer", fontSize:13, fontWeight:800, boxShadow:"0 2px 12px rgba(56,189,248,0.3)" },
  btnGreen:{ padding:"5px 12px", background:"rgba(74,222,128,0.12)", color:"#4ade80", border:"1px solid rgba(74,222,128,0.25)", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:700 },
  input:{ background:"rgba(0,0,0,0.35)", border:"1px solid rgba(255,255,255,0.08)", color:"#e2e8f0", borderRadius:6, padding:"5px 9px", fontSize:12, width:"100%", boxSizing:"border-box" },
  select:{ background:"rgba(0,0,0,0.35)", border:"1px solid rgba(255,255,255,0.08)", color:"#e2e8f0", borderRadius:6, padding:"4px 8px", fontSize:12 },
  toolBtn:(active)=>({ width:"100%", padding:"7px 10px", background:active?"rgba(56,189,248,0.12)":"transparent", color:active?"#38bdf8":"#94a3b8", border:active?"1px solid rgba(56,189,248,0.3)":"1px solid transparent", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:active?700:400, display:"flex", alignItems:"center", gap:8, transition:"all .1s", textAlign:"left", marginBottom:2 }),
  modal:{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, backdropFilter:"blur(8px)" },
  modalContent:{ background:"#1e293b", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:24, maxWidth:520, width:"92%", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 80px rgba(0,0,0,0.8)" },
  row:{ display:"flex", gap:8, alignItems:"center", marginBottom:8, flexWrap:"wrap" },
  label:{ fontSize:12, color:"#64748b", minWidth:56 },
  colorSwatch:(color,selected)=>({ width:26, height:26, background:color, border:selected?"2px solid #38bdf8":"2px solid rgba(255,255,255,0.07)", borderRadius:4, cursor:"pointer", display:"inline-block", margin:"2px", boxShadow:selected?"0 0 0 2px rgba(56,189,248,0.35)":"none" }),
  canvas:{ border:"1px solid rgba(255,255,255,0.07)", borderRadius:6, cursor:"crosshair", imageRendering:"pixelated", boxShadow:"0 0 0 1px rgba(255,255,255,0.02), 0 16px 56px rgba(0,0,0,0.7)" },
  frameThumb:(active)=>({ border:active?"2px solid #38bdf8":"1px solid rgba(255,255,255,0.08)", borderRadius:4, cursor:"pointer", imageRendering:"pixelated", margin:2, background:"#0f172a", display:"block" }),
};

// ─── Pixel Canvas ─────────────────────────────────────────────────────────────
function PixelCanvas({ grid, palette, onDraw, pixelSize=20, showGrid:showG=true }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);
  const w = grid[0]?.length||8, h = grid.length||8;
  const cw = w*pixelSize, ch = h*pixelSize;

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
      ctx.fillStyle = palette[grid[y][x]]||palette[0];
      ctx.fillRect(x*pixelSize,y*pixelSize,pixelSize,pixelSize);
    }
    if (showG && pixelSize>=8) {
      ctx.strokeStyle="rgba(255,255,255,0.08)"; ctx.lineWidth=1;
      for (let x=0;x<=w;x++) { ctx.beginPath();ctx.moveTo(x*pixelSize+.5,0);ctx.lineTo(x*pixelSize+.5,ch);ctx.stroke(); }
      for (let y=0;y<=h;y++) { ctx.beginPath();ctx.moveTo(0,y*pixelSize+.5);ctx.lineTo(cw,y*pixelSize+.5);ctx.stroke(); }
    }
  });

  const getPos = (e) => {
    const rect = ref.current.getBoundingClientRect();
    return { x:Math.floor((e.clientX-rect.left)*(cw/rect.width)/pixelSize), y:Math.floor((e.clientY-rect.top)*(ch/rect.height)/pixelSize) };
  };
  const handle = (e,force) => {
    if (!drawing.current && !force) return;
    const {x,y}=getPos(e);
    if (x<0||x>=w||y<0||y>=h) return;
    const last=lastPos.current;
    if (last&&(last.x!==x||last.y!==y)) {
      let dx=Math.abs(x-last.x),dy=Math.abs(y-last.y),sx=last.x<x?1:-1,sy=last.y<y?1:-1,err=dx-dy,cx=last.x,cy=last.y;
      while(cx!==x||cy!==y){onDraw(cx,cy);let e2=2*err;if(e2>-dy){err-=dy;cx+=sx;}if(e2<dx){err+=dx;cy+=sy;}}
    }
    onDraw(x,y); lastPos.current={x,y};
  };
  const maxD=520, sc=Math.min(maxD/cw,maxD/ch,1);
  const dw=Math.floor(cw*(cw>maxD||ch>maxD?sc:1)), dh=Math.floor(ch*(cw>maxD||ch>maxD?sc:1));
  return <canvas ref={ref} width={cw} height={ch} style={{...S.canvas,width:dw,height:dh}}
    onMouseDown={e=>{drawing.current=true;lastPos.current=null;handle(e,true);}}
    onMouseMove={e=>handle(e)} onMouseUp={()=>{drawing.current=false;lastPos.current=null;}}
    onMouseLeave={()=>{drawing.current=false;lastPos.current=null;}} />;
}

// ─── Mini Canvas ──────────────────────────────────────────────────────────────
function MiniCanvas({ grid, palette, size=48 }) {
  const ref = useRef(null);
  const w=grid[0]?.length||8, h=grid.length||8;
  useEffect(()=>{
    const ctx=ref.current?.getContext("2d"); if(!ctx)return;
    const ps=Math.max(1,Math.floor(size/Math.max(w,h)));
    ref.current.width=w*ps; ref.current.height=h*ps;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){ctx.fillStyle=palette[grid[y][x]]||palette[0];ctx.fillRect(x*ps,y*ps,ps,ps);}
  },[grid,palette,w,h,size]);
  return <canvas ref={ref} style={{imageRendering:"pixelated",display:"block"}} />;
}

// ─── Room Canvas ──────────────────────────────────────────────────────────────
function RoomCanvas({ room, tiles, sprites, palette, roomW, roomH, tileW, tileH, onPlace, roomTool, selectedTileId, selectedSpriteId, avatarStart }) {
  const ref = useRef(null);
  const dragging = useRef(false);
  const lastCell = useRef(null);
  const ps = Math.max(2, Math.floor(580/Math.max(roomW*tileW,roomH*tileH)));

  const drawRoom = useCallback((ctx) => {
    const cw=roomW*tileW*ps, ch=roomH*tileH*ps;
    ctx.fillStyle=palette[0]; ctx.fillRect(0,0,cw,ch);
    for(let ry=0;ry<roomH;ry++) for(let rx=0;rx<roomW;rx++) {
      const tid=room.tiles[ry]?.[rx];
      const tile=tiles.find(t=>t.id===tid);
      if(!tile)continue;
      const frame=tile.frames[0]||emptyGrid(tileW,tileH);
      for(let py=0;py<tileH;py++) for(let px=0;px<tileW;px++){
        ctx.fillStyle=palette[frame[py]?.[px]||0]||palette[0];
        ctx.fillRect((rx*tileW+px)*ps,(ry*tileH+py)*ps,ps,ps);
      }
    }
    // Draw NPCs
    (room.npcs||[]).forEach(npc=>{
      const spr=sprites.find(s=>s.id===npc.spriteId);
      if(!spr)return;
      const frame=spr.frames[0]||emptyGrid(tileW,tileH);
      for(let py=0;py<Math.min(tileH,frame.length);py++) for(let px=0;px<Math.min(tileW,frame[0].length);px++){
        if(frame[py][px]===0)continue;
        ctx.fillStyle=palette[frame[py][px]]||palette[0];
        ctx.fillRect((npc.x*tileW+px)*ps,(npc.y*tileH+py)*ps,ps,ps);
      }
    });
    // Draw exits (pink portal overlay)
    (room.exits||[]).forEach(exit=>{
      ctx.fillStyle="rgba(255,0,200,0.35)";
      ctx.fillRect(exit.x*tileW*ps,exit.y*tileH*ps,tileW*ps,tileH*ps);
      ctx.fillStyle="#ff44ee";
      const cx=(exit.x+0.5)*tileW*ps, cy=(exit.y+0.5)*tileH*ps, sz=tileW*ps*0.35;
      ctx.beginPath();ctx.moveTo(cx+sz,cy);ctx.lineTo(cx-sz*0.5,cy-sz*0.8);ctx.lineTo(cx-sz*0.5,cy+sz*0.8);ctx.closePath();ctx.fill();
    });
    // Draw avatar start position marker
    if(avatarStart){
      const ax=avatarStart.x, ay=avatarStart.y;
      ctx.fillStyle="rgba(0,255,120,0.25)";
      ctx.fillRect(ax*tileW*ps,ay*tileH*ps,tileW*ps,tileH*ps);
      // Draw avatar sprite if it exists
      const avSpr=sprites[0];
      if(avSpr){
        const frame=avSpr.frames[0]||emptyGrid(tileW,tileH);
        for(let py=0;py<Math.min(tileH,frame.length);py++) for(let px=0;px<Math.min(tileW,(frame[0]||[]).length);px++){
          if(frame[py][px]===0)continue;
          ctx.fillStyle=palette[frame[py][px]]||palette[1]||"#fff";
          ctx.fillRect((ax*tileW+px)*ps,(ay*tileH+py)*ps,ps,ps);
        }
      }
      // Border marker
      ctx.strokeStyle="#00ff78";
      ctx.lineWidth=Math.max(1,ps*0.5);
      ctx.strokeRect(ax*tileW*ps+1,ay*tileH*ps+1,tileW*ps-2,tileH*ps-2);
      ctx.lineWidth=1;
    }
    // Behavior icon overlays on tiles
    const iconSz=Math.max(8,Math.min(tileW*ps*0.55,18));
    ctx.font=`${iconSz}px serif`;
    ctx.textAlign="right"; ctx.textBaseline="bottom";
    for(let ry=0;ry<roomH;ry++) for(let rx=0;rx<roomW;rx++){
      const tid=room.tiles[ry]?.[rx];
      const tile=tiles.find(t=>t.id===tid);
      if(!tile||tile.tileType==="walkable")continue;
      const icon=tile.tileType==="wall"?"🧱":tile.tileType==="item"?"⭐":tile.tileType==="end"?"🚪":"";
      if(icon) ctx.fillText(icon,(rx+1)*tileW*ps-1,(ry+1)*tileH*ps-1);
    }
    // Dialog badge on NPCs
    ctx.font=`${Math.max(7,iconSz*0.7)}px serif`;
    ctx.textAlign="right"; ctx.textBaseline="top";
    (room.npcs||[]).forEach(npc=>{
      const spr=sprites.find(s=>s.id===npc.spriteId);
      if(spr?.dialog?.trim()) ctx.fillText("💬",(npc.x+1)*tileW*ps-1,npc.y*tileH*ps+1);
    });
    // Grid
    ctx.strokeStyle="rgba(255,255,255,0.08)";
    for(let rx=0;rx<=roomW;rx++){ctx.beginPath();ctx.moveTo(rx*tileW*ps,0);ctx.lineTo(rx*tileW*ps,ch);ctx.stroke();}
    for(let ry=0;ry<=roomH;ry++){ctx.beginPath();ctx.moveTo(0,ry*tileH*ps);ctx.lineTo(cw,ry*tileH*ps);ctx.stroke();}
  },[room,tiles,sprites,palette,roomW,roomH,tileW,tileH,ps,avatarStart]);

  useEffect(()=>{
    const ctx=ref.current?.getContext("2d"); if(!ctx)return;
    ref.current.width=roomW*tileW*ps; ref.current.height=roomH*tileH*ps;
    drawRoom(ctx);
  },[drawRoom,roomW,roomH,tileW,tileH,ps]);

  const getCell=(e)=>{
    const rect=ref.current.getBoundingClientRect();
    const scX=ref.current.width/rect.width, scY=ref.current.height/rect.height;
    return { rx:Math.floor((e.clientX-rect.left)*scX/(tileW*ps)), ry:Math.floor((e.clientY-rect.top)*scY/(tileH*ps)) };
  };
  const handle=(e,force)=>{
    if(!dragging.current&&!force)return;
    const{rx,ry}=getCell(e);
    if(rx<0||rx>=roomW||ry<0||ry>=roomH)return;
    if(force){
      // First cell on mousedown
      lastCell.current={rx,ry};
      onPlace(rx,ry,true); // isFirst=true
      return;
    }
    // Bresenham interpolation from lastCell to current cell
    if(lastCell.current){
      let x0=lastCell.current.rx, y0=lastCell.current.ry;
      const x1=rx, y1=ry;
      if(x0===x1&&y0===y1)return; // same cell, nothing new
      let dx=Math.abs(x1-x0), dy=Math.abs(y1-y0);
      let sx=x0<x1?1:-1, sy=y0<y1?1:-1, err=dx-dy, first=true;
      while(true){
        if(!first&&x0>=0&&x0<roomW&&y0>=0&&y0<roomH) onPlace(x0,y0,false);
        first=false;
        if(x0===x1&&y0===y1)break;
        const e2=2*err;
        if(e2>-dy){err-=dy;x0+=sx;}
        if(e2<dx){err+=dx;y0+=sy;}
      }
    } else {
      onPlace(rx,ry,false);
    }
    lastCell.current={rx,ry};
  };
  const cw=roomW*tileW*ps, ch=roomH*tileH*ps;
  const maxD=640, sc=Math.min(maxD/cw,maxD/ch,1);
  return <canvas ref={ref} style={{...S.canvas,width:cw*sc,height:ch*sc,cursor:"pointer"}}
    onMouseDown={e=>{dragging.current=true;lastCell.current=null;handle(e,true);}}
    onMouseMove={e=>handle(e)}
    onMouseUp={()=>{dragging.current=false;lastCell.current=null;}}
    onMouseLeave={()=>{dragging.current=false;lastCell.current=null;}} />;
}

// ─── Bitsy Import Modal ───────────────────────────────────────────────────────
function BitsyImportModal({ onImport, onClose, gameTitle, palette, sprites, tiles, rooms, tune }) {
  const [file, setFile] = useState(null);
  const [rawText, setRawText] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const handleFile = (e) => {
    const f = e.target.files[0]; if(!f) return;
    setFile(f); setError(null);
    const reader = new FileReader();
    reader.onload = ev => setRawText(ev.target.result);
    reader.readAsText(f);
  };

  const handleBackup = () => {
    try {
      const data = exportBitsyData(gameTitle, palette, sprites, tiles, rooms, tune);
      const blob = new Blob([data], {type:'text/plain'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${gameTitle||'game'}.bitsy`; a.click();
      URL.revokeObjectURL(url);
      setSaved(true);
    } catch(e) { setError('Backup failed: '+e.message); }
  };

  const handleImport = () => {
    if (!rawText) return;
    try { onImport(parseBitsyData(rawText)); }
    catch(e) { setError('Could not parse file: '+e.message); }
  };

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={{...S.modalContent, maxWidth:420}} onClick={e=>e.stopPropagation()}>
        <h3 style={{margin:"0 0 16px", color:"#38bdf8"}}>📂 Import .bitsy File</h3>

        {/* Save prompt */}
        <div style={{padding:"12px 14px", background:"rgba(251,191,36,0.07)", border:"1px solid rgba(251,191,36,0.2)", borderRadius:8, marginBottom:16}}>
          <div style={{fontSize:12, color:"#fbbf24", fontWeight:700, marginBottom:6}}>⚠️ Your current game will be replaced</div>
          <p style={{fontSize:11, color:"#94a3b8", margin:"0 0 10px", lineHeight:1.5}}>Download a backup of <em style={{color:"#e2e8f0"}}>{gameTitle||'your current game'}</em> before importing.</p>
          <button style={{...S.btnGreen, display:"flex", alignItems:"center", gap:6}} onClick={handleBackup}>
            📥 Download backup {saved && <span style={{color:"#4ade80"}}>✓ saved</span>}
          </button>
        </div>

        {/* File picker */}
        <div style={{marginBottom:16}}>
          <div style={S.sectionTitle}>Choose .bitsy file</div>
          <label style={{display:"block", padding:"22px 16px", border:`2px dashed ${file?"rgba(74,222,128,0.4)":"rgba(255,255,255,0.1)"}`, borderRadius:8, cursor:"pointer", textAlign:"center", background:"rgba(255,255,255,0.02)", transition:"border .15s"}}>
            <input type="file" accept=".bitsy,.txt" style={{display:"none"}} onChange={handleFile} />
            {file
              ? <span style={{fontSize:12, color:"#4ade80", fontWeight:700}}>✓ {file.name}</span>
              : <span style={{fontSize:12, color:"#475569"}}>Click to browse or drop a .bitsy file here</span>}
          </label>
        </div>

        {error && <div style={{color:"#f87171", fontSize:11, marginBottom:12, padding:"8px 10px", background:"rgba(248,113,113,0.08)", borderRadius:6}}>⚠️ {error}</div>}

        <div style={{display:"flex", gap:8, justifyContent:"flex-end"}}>
          <button style={S.btn(false)} onClick={onClose}>Cancel</button>
          <button style={file ? S.btnPrimary : S.btn(false)} disabled={!file} onClick={handleImport}>Import →</button>
        </div>
      </div>
    </div>
  );
}

// ─── PNG Import Modal ─────────────────────────────────────────────────────────
function PngImportModal({ onImport, onClose, palette, maxColors }) {
  const [preview,setPreview]=useState(null);
  const [imgData,setImgData]=useState(null);
  const [targetW,setTargetW]=useState(16);
  const [targetH,setTargetH]=useState(16);
  const [importMode,setImportMode]=useState("sprite");
  const [dithering,setDithering]=useState(false);
  const [paletteMode,setPaletteMode]=useState("generate");

  const handleFile=(e)=>{
    const file=e.target.files[0]; if(!file)return;
    const reader=new FileReader();
    reader.onload=(ev)=>{ const img=new Image(); img.onload=()=>{setPreview(img);setImgData(ev.target.result);}; img.src=ev.target.result; };
    reader.readAsDataURL(file);
  };

  const doImport=()=>{
    if(!preview)return;
    try{
    const canvas=document.createElement("canvas"); canvas.width=targetW; canvas.height=targetH;
    const ctx=canvas.getContext("2d"); ctx.imageSmoothingEnabled=false;
    ctx.drawImage(preview,0,0,targetW,targetH);
    const data=ctx.getImageData(0,0,targetW,targetH).data;
    let usePalette;
    if(paletteMode==="generate"){
      const q=quantizeColors(data,maxColors);
      usePalette=q.map(c=>rgbToHex(c.r,c.g,c.b));
      while(usePalette.length<maxColors)usePalette.push("#000000");
    } else usePalette=[...palette];
    const grid=emptyGrid(targetW,targetH);
    if(dithering){
      const err=Array.from({length:targetH},()=>Array.from({length:targetW},()=>({r:0,g:0,b:0})));
      for(let y=0;y<targetH;y++) for(let x=0;x<targetW;x++){
        const i=(y*targetW+x)*4;
        const or=data[i]+err[y][x].r, og=data[i+1]+err[y][x].g, ob=data[i+2]+err[y][x].b;
        const cr=Math.max(0,Math.min(255,Math.round(or))),cg=Math.max(0,Math.min(255,Math.round(og))),cb=Math.max(0,Math.min(255,Math.round(ob)));
        const idx=nearestColor(cr,cg,cb,usePalette); grid[y][x]=idx;
        const pc=hexToRgb(usePalette[idx]); const er=cr-pc.r,eg=cg-pc.g,eb=cb-pc.b;
        const sp=(dx,dy,f)=>{const nx=x+dx,ny=y+dy;if(nx>=0&&nx<targetW&&ny>=0&&ny<targetH){err[ny][nx].r+=er*f;err[ny][nx].g+=eg*f;err[ny][nx].b+=eb*f;}};
        sp(1,0,7/16);sp(-1,1,3/16);sp(0,1,5/16);sp(1,1,1/16);
      }
    } else {
      for(let y=0;y<targetH;y++) for(let x=0;x<targetW;x++){
        const i=(y*targetW+x)*4; grid[y][x]=nearestColor(data[i],data[i+1],data[i+2],usePalette);
      }
    }
    onImport({grid,palette:usePalette,mode:importMode});
    }catch(err){alert("Import failed: "+err.message);}
  };

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalContent} onClick={e=>e.stopPropagation()}>
        <h3 style={{margin:"0 0 14px",color:"#e94560"}}>Import Image</h3>
        <input type="file" accept="image/*" onChange={handleFile} style={{...S.input,marginBottom:10}} />
        {preview&&<div style={{textAlign:"center",marginBottom:10}}>
          <img src={imgData} alt="preview" style={{maxWidth:180,maxHeight:180,imageRendering:"pixelated",border:"1px solid #333",borderRadius:4}} />
          <div style={{fontSize:11,color:"#888",marginTop:4}}>Original: {preview.width}×{preview.height}</div>
        </div>}
        <div style={S.row}><span style={S.label}>Import as:</span>
          <button style={S.btn(importMode==="sprite")} onClick={()=>setImportMode("sprite")}>Sprite/NPC</button>
          <button style={S.btn(importMode==="background")} onClick={()=>setImportMode("background")}>Background Tile</button>
        </div>
        <div style={S.row}><span style={S.label}>Size:</span>
          <input type="number" min={4} max={64} value={targetW} onChange={e=>setTargetW(+e.target.value||8)} style={{...S.input,width:56}} />
          <span>×</span>
          <input type="number" min={4} max={64} value={targetH} onChange={e=>setTargetH(+e.target.value||8)} style={{...S.input,width:56}} />
        </div>
        <div style={S.row}><span style={S.label}>Palette:</span>
          <button style={S.btn(paletteMode==="generate")} onClick={()=>setPaletteMode("generate")}>Auto-generate</button>
          <button style={S.btn(paletteMode==="existing")} onClick={()=>setPaletteMode("existing")}>Use current</button>
        </div>
        <div style={S.row}>
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,cursor:"pointer"}}>
            <input type="checkbox" checked={dithering} onChange={e=>setDithering(e.target.checked)} /> Floyd-Steinberg dithering
          </label>
        </div>
        <div style={{display:"flex",gap:8,marginTop:14}}>
          <button style={{...S.btn(true),flex:1}} onClick={doImport} disabled={!preview}>Import</button>
          <button style={{...S.btn(false),flex:1}} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Exit Config Modal ────────────────────────────────────────────────────────
function ExitConfigModal({ rooms, currentRoom, position, onConfirm, onClose, tiles, palette, roomW, roomH }) {
  const firstOther = rooms.findIndex((_,i)=>i!==currentRoom);
  const [destRoom, setDestRoom] = useState(firstOther>=0?firstOther:0);
  const [twoWay, setTwoWay] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const destRoomObj = rooms[destRoom];
  const defaultArr = destRoomObj?.avatarStart||{x:1,y:1};
  const [arrX, setArrX] = useState(defaultArr.x);
  const [arrY, setArrY] = useState(defaultArr.y);
  useEffect(()=>{
    const r=rooms[destRoom]; const a=r?.avatarStart||{x:1,y:1};
    setArrX(a.x); setArrY(a.y);
  },[destRoom,rooms]);
  const cs=Math.max(4,Math.min(9,Math.floor(160/Math.max(roomW,roomH))));
  const TILE_BG={wall:"#475569",item:"#fbbf24",end:"#60a5fa",walkable:"#1e293b"};
  return (
    <div style={S.modal} onClick={onClose}>
      <div style={{...S.modalContent,maxWidth:440}} onClick={e=>e.stopPropagation()}>
        <h3 style={{margin:"0 0 10px",color:"#e94560"}}>🚪 Configure Exit</h3>
        <p style={{fontSize:12,color:"#aaa",margin:"0 0 10px"}}>Portal at ({position.x},{position.y})</p>

        {/* Ending toggle */}
        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",
          background:"rgba(96,165,250,0.08)",border:"1px solid rgba(96,165,250,0.2)",
          borderRadius:6,padding:"8px 10px",marginBottom:10}}>
          <input type="checkbox" checked={isEnding} onChange={e=>setIsEnding(e.target.checked)} />
          <span>🏁 <b>Game ending</b> — stepping here shows the win screen</span>
        </label>

        {!isEnding&&(<>
          {/* Destination room */}
          <div style={{...S.row,marginBottom:8}}>
            <span style={{...S.label,flexShrink:0}}>Destination:</span>
            <select style={S.select} value={destRoom} onChange={e=>setDestRoom(+e.target.value)}>
              {rooms.map((r,i)=><option key={i} value={i}>{r.name}{i===currentRoom?" (this room)":""}</option>)}
            </select>
          </div>

          {/* Mini room grid for arrival position */}
          <div style={{fontSize:11,color:"#94a3b8",marginBottom:4}}>
            Click a cell to set where the player arrives:
          </div>
          <div style={{display:"inline-grid",gridTemplateColumns:`repeat(${roomW},${cs}px)`,gap:0,
            background:"#0f172a",border:"1px solid rgba(255,255,255,0.12)",borderRadius:4,
            padding:3,marginBottom:6,cursor:"crosshair",userSelect:"none"}}>
            {Array.from({length:roomH},(_,ry)=>Array.from({length:roomW},(_,rx)=>{
              const tid=destRoomObj?.tiles[ry]?.[rx];
              const tile=tiles.find(t=>t.id===tid);
              const tt=tile?.tileType||"walkable";
              const isArr=rx===arrX&&ry===arrY;
              return(
                <div key={`${rx},${ry}`} onClick={()=>{setArrX(rx);setArrY(ry);}}
                  style={{width:cs,height:cs,boxSizing:"border-box",
                    background:isArr?"#38bdf8":TILE_BG[tt]||"#1e293b",
                    border:isArr?"1px solid #fff":"1px solid transparent",
                    borderRadius:isArr?2:0}}
                />
              );
            }))}
          </div>
          <div style={{fontSize:11,color:"#38bdf8",marginBottom:10}}>
            Arrival: ({arrX}, {arrY})
            {destRoomObj?.avatarStart&&destRoomObj.avatarStart.x===arrX&&destRoomObj.avatarStart.y===arrY
              &&<span style={{color:"#64748b"}}> — room start marker</span>}
          </div>

          {/* Two-way toggle */}
          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,cursor:"pointer",marginBottom:12}}>
            <input type="checkbox" checked={twoWay} onChange={e=>setTwoWay(e.target.checked)} />
            <span>↔ <b>Two-way</b> — also creates a return portal in the destination room</span>
          </label>
        </>)}

        <div style={{display:"flex",gap:8,marginTop:4}}>
          <button style={{...S.btn(true),flex:1}} onClick={()=>onConfirm({
            x:position.x,y:position.y,
            destRoom:isEnding?null:destRoom,
            twoWay:!isEnding&&twoWay,
            isEnding,
            arrX:isEnding?undefined:arrX,
            arrY:isEnding?undefined:arrY,
          })}>✓ {isEnding?"Add Ending":"Add Exit"}</button>
          <button style={{...S.btn(false),flex:1}} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Tune Editor ──────────────────────────────────────────────────────────────
function TuneEditor({ tune, onChange, volume, onVolumeChange, savedTunes, onSaveTune, onLoadTune }) {
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(160);
  const [activeStep, setActiveStep] = useState(-1);
  const [tuneName, setTuneName] = useState("My Tune");
  const toRef = useRef(null);
  const stepRef = useRef(0);
  const bpmRef = useRef(160);
  const volRef = useRef(volume);
  const tuneRef = useRef(tune);
  const playingRef = useRef(false);

  // Keep refs in sync so live changes take effect immediately
  useEffect(()=>{ bpmRef.current=bpm; },[bpm]);
  useEffect(()=>{ volRef.current=volume; },[volume]);
  useEffect(()=>{ tuneRef.current=tune; },[tune]);

  const tick = useCallback(()=>{
    if(!playingRef.current)return;
    const s=stepRef.current;
    const note=tuneRef.current[s];
    if(note?.active) playBlip("square",noteFreq(note.semi),0.08,volRef.current);
    setActiveStep(s);
    stepRef.current=(s+1)%TUNE_STEPS;
    toRef.current=setTimeout(tick,Math.round(60000/bpmRef.current/4));
  },[]);

  const startPlay=()=>{ playingRef.current=true; setPlaying(true); stepRef.current=0; tick(); };
  const stopPlay=()=>{ playingRef.current=false; setPlaying(false); setActiveStep(-1); clearTimeout(toRef.current); };
  useEffect(()=>()=>{ playingRef.current=false; clearTimeout(toRef.current); },[]);

  const toggle=(si,semi)=>{
    onChange(tune.map((s,i)=>i===si?(s.active&&s.semi===semi?{semi:0,active:false}:{semi,active:true}):s));
  };

  // Show 2 octaves (C4–B5), top = high
  const ROWS=24;
  return (
    <div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
        <button style={S.btn(playing)} onClick={playing?stopPlay:startPlay}>{playing?"⏹ Stop":"▶ Play"}</button>
        <span style={{fontSize:11,color:"#aaa"}}>BPM:</span>
        <input type="range" min={60} max={240} value={bpm} onChange={e=>setBpm(+e.target.value)} style={{width:70}} />
        <span style={{fontSize:11,minWidth:28}}>{bpm}</span>
        <span style={{fontSize:11,color:"#aaa",marginLeft:4}}>Vol:</span>
        <input type="range" min={0} max={1} step={0.05} value={volume} onChange={e=>onVolumeChange(+e.target.value)} style={{width:60}} />
        <span style={{fontSize:11,minWidth:28}}>{Math.round(volume*100)}%</span>
        <button style={{...S.btn(false),fontSize:10,marginLeft:"auto"}} onClick={()=>onChange(tune.map(()=>({semi:0,active:false})))}>Clear</button>
      </div>
      <div style={{overflowX:"auto",overflowY:"auto",maxHeight:220,border:"1px solid #0f3460",borderRadius:4}}>
        <div style={{display:"grid",gridTemplateColumns:`40px repeat(${TUNE_STEPS},1fr)`,gap:1,minWidth:440}}>
          {Array.from({length:ROWS},(_,ri)=>{
            const semi=ROWS-1-ri+12;
            const oct=Math.floor(semi/12)+3;
            const name=NOTE_NAMES[semi%12];
            const natural=!name.includes("#");
            return [
              <div key={`l${ri}`} style={{fontSize:9,color:natural?"#ccc":"#555",background:"#0d1b3e",display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:3,height:10}}>
                {natural?`${name}${oct}`:""}
              </div>,
              ...Array.from({length:TUNE_STEPS},(_,si)=>{
                const act=tune[si]?.active&&tune[si]?.semi===semi;
                return <div key={`${ri}-${si}`} onClick={()=>toggle(si,semi)} style={{height:10,background:act?"#e94560":si===activeStep?"#1a3050":"#111",border:"1px solid #0a1428",cursor:"pointer",borderRadius:1}} />;
              })
            ];
          }).flat()}
        </div>
      </div>

      {/* Save / Load */}
      <div style={{marginTop:10,display:"flex",gap:6,alignItems:"center"}}>
        <input value={tuneName} onChange={e=>setTuneName(e.target.value)} placeholder="Tune name…" style={{...S.input,flex:1,fontSize:11}} />
        <button style={S.btnGreen} onClick={()=>onSaveTune({id:`tune_${Date.now()}`,name:tuneName||"Tune",steps:[...tune]})}>💾 Save</button>
      </div>
      {savedTunes.length>0&&(
        <div style={{marginTop:6,background:"#0d1b3e",borderRadius:4,padding:"6px 8px"}}>
          <div style={{fontSize:10,color:"#58a6ff",marginBottom:4,fontWeight:700}}>Saved Tunes</div>
          {savedTunes.map((st,i)=>(
            <div key={st.id} style={{display:"flex",gap:4,alignItems:"center",marginBottom:3}}>
              <span style={{flex:1,fontSize:11,color:"#c9d1d9",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{st.name}</span>
              <button style={{...S.btn(false),fontSize:10,padding:"2px 8px"}} onClick={()=>onLoadTune(i)}>Load</button>
            </div>
          ))}
        </div>
      )}
      <div style={{fontSize:10,color:"#555",marginTop:5}}>Click cells to place notes · BPM and note changes apply immediately during playback</div>
    </div>
  );
}

// ─── Playtest Modal ───────────────────────────────────────────────────────────
function PlaytestModal({ rooms, startRoom=0, tiles, sprites, palette, roomW, roomH, tileW, tileH, tune, savedTunes, tuneVolume, winConditions, onClose }) {
  const findStart = (r) => {
    if(!r)return{x:1,y:1};
    if(r.avatarStart)return{x:r.avatarStart.x,y:r.avatarStart.y};
    for(let y=0;y<roomH;y++) for(let x=0;x<roomW;x++){
      const tid=r.tiles[y]?.[x];
      const tile=tiles.find(t=>t.id===tid);
      if(!tile||tile.tileType!=="wall") return {x,y};
    }
    return {x:1,y:1};
  };
  const [roomIdx,setRoomIdx]=useState(startRoom);
  const room=rooms[roomIdx]||{tiles:[],npcs:[],exits:[]};
  const [pos,setPos]=useState(()=>findStart(rooms[startRoom]));
  const [collected,setCollected]=useState([]); // [{name,spriteId?}]
  const [dialog,setDialog]=useState(null);
  const [won,setWon]=useState(false);
  const [wonMsg,setWonMsg]=useState("");
  const [removedItems,setRemovedItems]=useState([]); // tile-based: `${roomIdx},${x},${y}`
  const [removedNpcs,setRemovedNpcs]=useState([]); // sprite-based: `${roomIdx},${x},${y}`
  const [showInv,setShowInv]=useState(false);
  const [muted,setMuted]=useState(false);
  const mutedRef=useRef(false);
  useEffect(()=>{mutedRef.current=muted;},[muted]);
  const safeBlip=(w,f,d,v)=>{ if(!mutedRef.current) playBlip(w,f,d,v); };
  const canvasRef=useRef(null);
  const tuneRef=useRef(null);
  const tuneStep=useRef(0);
  const ps=Math.max(3,Math.floor(400/Math.max(roomW*tileW,roomH*tileH)));
  const playerSpr=sprites[0];

  // Per-room background tune: resolve which steps to play for the current room
  const getRoomTune=useCallback((ri)=>{
    const room=rooms[ri];
    if(!room)return null;
    if(room.tuneId&&savedTunes){
      const st=savedTunes.find(t=>t.id===room.tuneId);
      if(st&&st.steps.some(s=>s.active))return st.steps;
    }
    // Fallback to global tune
    if(tune&&tune.some(s=>s.active))return tune;
    return null;
  },[rooms,savedTunes,tune]);

  // Background tune playback — restarts when room or mute changes
  useEffect(()=>{
    clearTimeout(tuneRef.current);
    if(muted)return;
    const steps=getRoomTune(roomIdx);
    if(!steps)return;
    let s=0;
    const vol=tuneVolume??0.1;
    const tick=()=>{
      if(mutedRef.current){return;}
      const note=steps[s];
      if(note?.active) playBlip("sine",noteFreq(note.semi),0.12,vol);
      s=(s+1)%TUNE_STEPS;
      tuneRef.current=setTimeout(tick,170);
    };
    tuneRef.current=setTimeout(tick,0);
    return()=>clearTimeout(tuneRef.current);
  },[roomIdx,getRoomTune,tuneVolume,muted]);

  const drawAll=useCallback(()=>{
    const ctx=canvasRef.current?.getContext("2d"); if(!ctx)return;
    const cw=roomW*tileW*ps, ch=roomH*tileH*ps;
    ctx.fillStyle=palette[0]; ctx.fillRect(0,0,cw,ch);
    for(let ry=0;ry<roomH;ry++) for(let rx=0;rx<roomW;rx++){
      const tid=room.tiles[ry]?.[rx];
      const tile=tiles.find(t=>t.id===tid); if(!tile)continue;
      const key=`${roomIdx},${rx},${ry}`;
      if(removedItems.includes(key))continue;
      const frame=tile.frames[0]||emptyGrid(tileW,tileH);
      for(let py=0;py<tileH;py++) for(let px=0;px<tileW;px++){
        ctx.fillStyle=palette[frame[py]?.[px]||0]||palette[0];
        ctx.fillRect((rx*tileW+px)*ps,(ry*tileH+py)*ps,ps,ps);
      }
    }
    // Exits (faint pink glow)
    (room.exits||[]).forEach(ex=>{
      ctx.fillStyle="rgba(255,0,200,0.2)";
      ctx.fillRect(ex.x*tileW*ps,ex.y*tileH*ps,tileW*ps,tileH*ps);
    });
    // NPCs (skip removed sprite items)
    (room.npcs||[]).forEach(npc=>{
      if(removedNpcs.includes(`${roomIdx},${npc.x},${npc.y}`))return;
      const spr=sprites.find(s=>s.id===npc.spriteId); if(!spr)return;
      const frame=spr.frames[0]||emptyGrid(tileW,tileH);
      for(let py=0;py<Math.min(tileH,frame.length);py++) for(let px=0;px<Math.min(tileW,frame[0].length);px++){
        if(frame[py][px]===0)continue;
        ctx.fillStyle=palette[frame[py][px]]||palette[0];
        ctx.fillRect((npc.x*tileW+px)*ps,(npc.y*tileH+py)*ps,ps,ps);
      }
    });
    // Player
    if(playerSpr){
      const frame=playerSpr.frames[0]||emptyGrid(tileW,tileH);
      for(let py=0;py<Math.min(tileH,frame.length);py++) for(let px=0;px<Math.min(tileW,frame[0].length);px++){
        if(frame[py][px]===0)continue;
        ctx.fillStyle=palette[frame[py][px]]||palette[0];
        ctx.fillRect((pos.x*tileW+px)*ps,(pos.y*tileH+py)*ps,ps,ps);
      }
    } else {
      // fallback: white square
      ctx.fillStyle="#fff";
      ctx.fillRect(pos.x*tileW*ps+ps,pos.y*tileH*ps+ps,(tileW-2)*ps,(tileH-2)*ps);
    }
  },[room,tiles,sprites,palette,roomW,roomH,tileW,tileH,ps,pos,playerSpr,removedItems,removedNpcs,roomIdx]);

  useEffect(()=>{ const c=canvasRef.current; if(c){c.width=roomW*tileW*ps;c.height=roomH*tileH*ps;} drawAll(); },[drawAll,roomW,roomH,tileW,tileH,ps]);

  useEffect(()=>{
    const handler=(e)=>{
      if(won)return;
      if(dialog){
        if([" ","Enter","ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)){
          e.preventDefault();
          const next=dialog.pageIdx+1;
          if(next>=dialog.pages.length) setDialog(null);
          else setDialog(d=>({...d,pageIdx:next}));
        }
        return;
      }
      const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
      const d=dirs[e.key]; if(!d)return;
      e.preventDefault();
      const nx=pos.x+d[0], ny=pos.y+d[1];
      if(nx<0||nx>=roomW||ny<0||ny>=roomH)return;
      // Check exits (including isEnding exits)
      const exit=(room.exits||[]).find(ex=>ex.x===nx&&ex.y===ny);
      if(exit){
        if(exit.isEnding){ setWonMsg(""); setWon(true); return; }
        const ax=exit.arrX??rooms[exit.destRoom]?.avatarStart?.x??1;
        const ay=exit.arrY??rooms[exit.destRoom]?.avatarStart?.y??1;
        setRoomIdx(exit.destRoom);
        setPos({x:ax,y:ay});
        safeBlip("sine",660,0.18,0.2);
        return;
      }
      // Check NPC — item sprites get collected, others show dialog
      const npcKey=`${roomIdx},${nx},${ny}`;
      const npc=(room.npcs||[]).find(n=>n.x===nx&&n.y===ny&&!removedNpcs.includes(`${roomIdx},${n.x},${n.y}`));
      if(npc){
        const spr=sprites.find(s=>s.id===npc.spriteId);
        if(spr?.tileType==="item"){
          // Collectible sprite — walk onto it to collect
          if(!removedNpcs.includes(npcKey)){
            const newRemNpcs=[...removedNpcs,npcKey];
            const newCollected=[...collected,{name:spr.name||"item",spriteId:spr.id}];
            setRemovedNpcs(newRemNpcs);
            setCollected(newCollected);
            setPos({x:nx,y:ny});
            safeBlip("triangle",880,0.2,0.3);
            // Check win conditions
            if(winConditions){
              const cnt=newCollected.filter(c=>c.spriteId===spr.id).length;
              const target=winConditions[spr.id];
              if(target>0&&cnt>=target){ setWonMsg(`You collected all ${spr.name||"items"}!`); setWon(true); }
            }
          }
          return;
        }
        if(spr?.dialog){
          const pages=spr.dialog.split(/\n?---\n?/).map(p=>p.trim()).filter(Boolean);
          setDialog({pages:pages.length?pages:[spr.dialog],pageIdx:0,name:spr.name});
          const w=spr.blip?.wave||"square", f=spr.blip?.freq||440;
          safeBlip(w,f,0.1,0.2);
        }
        return;
      }
      const tid=room.tiles[ny]?.[nx];
      const tile=tiles.find(t=>t.id===tid);
      const tt=tile?.tileType||"walkable";
      if(tt==="wall")return;
      setPos({x:nx,y:ny});
      if(tt==="item"){
        const key=`${roomIdx},${nx},${ny}`;
        if(!removedItems.includes(key)){
          setRemovedItems(p=>[...p,key]);
          setCollected(p=>[...p,{name:tile.name||"item"}]);
          safeBlip("triangle",880,0.2,0.3);
        }
      }
      if(tt==="end"){ setWonMsg(""); setWon(true); }
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[pos,dialog,won,room,roomIdx,tiles,sprites,roomW,roomH,removedItems,removedNpcs,collected,winConditions]);

  const cw=roomW*tileW*ps, ch=roomH*tileH*ps;
  const maxD=400, sc=Math.min(maxD/cw,maxD/ch,1);
  const restart=()=>{ setRoomIdx(0);setPos(findStart(rooms[0]));setCollected([]);setRemovedItems([]);setRemovedNpcs([]);setWon(false);setWonMsg("");setDialog(null);setShowInv(false); };

  return (
    <div style={S.modal}>
      <div style={{...S.modalContent,maxWidth:520}}>
        {/* HUD bar */}
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,background:"rgba(0,0,0,0.25)",borderRadius:7,padding:"6px 10px"}}>
          <span style={{fontSize:12,fontWeight:700,color:"#38bdf8",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>▶ {rooms[roomIdx]?.name||"Playtest"}</span>
          <span style={{fontSize:11,color:"#64748b"}}>Room {roomIdx+1}/{rooms.length}</span>
          <button style={{...S.btn(showInv),fontSize:11,padding:"3px 8px"}} onClick={()=>setShowInv(v=>!v)}>🎒 {collected.length}</button>
          <button style={{...S.btn(muted),fontSize:11,padding:"3px 8px"}} onClick={()=>setMuted(v=>!v)} title="Mute">{muted?"🔇":"🔊"}</button>
          <button style={{...S.btn(false),padding:"3px 8px",fontSize:11}} onClick={restart}>↺</button>
          <button style={{...S.btn(false),padding:"3px 8px"}} onClick={onClose}>✕</button>
        </div>
        {won ? (
          <div style={{textAlign:"center",padding:32}}>
            <div style={{fontSize:40,marginBottom:12}}>🎉</div>
            <div style={{fontSize:22,color:"#fbbf24",fontWeight:700,marginBottom:8}}>You Win!</div>
            {wonMsg&&<div style={{color:"#38bdf8",marginBottom:6,fontSize:14}}>{wonMsg}</div>}
            <div style={{color:"#64748b",marginBottom:16}}>Items collected: {collected.length}</div>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <button style={S.btnPrimary} onClick={restart}>↺ Play Again</button>
              <button style={S.btn(false)} onClick={onClose}>Back to Editor</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{position:"relative",minHeight:ch*sc+10}}>
              <canvas ref={canvasRef} style={{...S.canvas,display:"block",margin:"0 auto",width:cw*sc,height:ch*sc}} />
              {dialog && (
                <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(15,23,42,0.96)",border:"1px solid rgba(56,189,248,0.35)",borderRadius:6,padding:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div style={{color:"#38bdf8",fontSize:11,fontWeight:700}}>{dialog.name}</div>
                    {dialog.pages.length>1&&<div style={{fontSize:10,color:"#475569"}}>{dialog.pageIdx+1}/{dialog.pages.length}</div>}
                  </div>
                  <div style={{fontSize:14,lineHeight:1.5,whiteSpace:"pre-wrap",color:"#e2e8f0"}}>{dialog.pages[dialog.pageIdx]}</div>
                  <div style={{fontSize:11,color:"#475569",marginTop:6}}>{dialog.pageIdx<dialog.pages.length-1?"Space / ↵ →":"Space / ↵ to close"}</div>
                </div>
              )}
            </div>
            {showInv&&(()=>{
              const grouped=collected.reduce((acc,it)=>{const f=acc.find(g=>g.name===it.name);if(f)f.count++;else acc.push({...it,count:1});return acc;},[]);
              const itemTiles=tiles.filter(t=>t.tileType==="item");
              return(
                <div style={{background:"rgba(251,191,36,0.06)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:6,padding:10,marginTop:8}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#fbbf24",marginBottom:6}}>🎒 Inventory</div>
                  {grouped.length===0?<div style={{fontSize:11,color:"#475569"}}>Empty.</div>:(
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {grouped.map((it,i)=>{
                        const t=itemTiles.find(t=>t.name===it.name);
                        return(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:4,background:"rgba(0,0,0,0.3)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:4,padding:"3px 8px"}}>
                            {t&&<MiniCanvas grid={t.frames[0]} palette={palette} size={16} />}
                            <span style={{fontSize:12,color:"#fbbf24"}}>{it.name}</span>
                            {it.count>1&&<span style={{fontSize:11,color:"#94a3b8"}}>×{it.count}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
            <div style={{marginTop:8,fontSize:11,color:"#334155",textAlign:"center"}}>↑↓←→ move · Space dismiss dialog · 🌸 exit portal</div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Export Bitsy Data ────────────────────────────────────────────────────────
// Clamp a pixel value to a valid base-36 digit (0–35), guarding against NaN /
// undefined that can appear in imported-JPEG grids due to quantization edge cases.
const safePixel = v => (Number.isFinite(v) ? Math.max(0, Math.min(35, Math.round(v))) : 0);

// ─── Bitsy Import Parser ───────────────────────────────────────────────────────
function parseBitsyData(rawText) {
  const lines = rawText.replace(/\r\n/g,'\n').split('\n');
  let gameTitle='Imported Game';
  const rawTiles=[]; // [{bitsyId, name, frames, isWall}]
  const rawSprites=[]; // [{bitsyId, name, frames, dlgRef, posRoom, posX, posY}]
  const rawItems=[]; // [{bitsyId, name, frames, dlgRef}]
  const rawRooms=[]; // [{bitsyId, name, tileGrid, itemPlacements, exits}]
  const dialogs={}; // id→text
  const palettes={}; // id→[{r,g,b}]

  // Grab title from first non-directive line
  for(const l of lines){
    const t=l.trim();
    if(t&&!t.startsWith('#')&&!t.startsWith('!')&&!/^(PAL|ROOM|TIL|SPR|ITM|DLG|TUNE|BLIP|END|VAR|NAME|WAL|COL|EXT|POS)\b/.test(t)){
      gameTitle=t; break;
    }
  }

  const parsePixels=(rows)=>{
    const frames=[]; let cur=[];
    for(const r of rows){
      if(r==='>'){if(cur.length)frames.push(cur);cur=[];}
      else cur.push(r.split('').map(c=>Math.min(15,parseInt(c,16)||0)));
    }
    if(cur.length)frames.push(cur);
    return frames.length?frames:[emptyGrid(8,8)];
  };

  let i=0;
  while(i<lines.length){
    const l=lines[i].trim();
    if(l.startsWith('PAL ')){
      const id=l.slice(4).trim(); const colors=[]; i++;
      while(i<lines.length&&lines[i].trim()&&!lines[i].trim().match(/^(PAL|ROOM|TIL|SPR|ITM|DLG|TUNE|BLIP|END|VAR)\s/)){
        const m=lines[i].trim().match(/^(\d+),(\d+),(\d+)$/);
        if(m)colors.push({r:+m[1],g:+m[2],b:+m[3]});
        i++;
      }
      palettes[id]=colors;
    } else if(l.startsWith('ROOM ')){
      const id=l.slice(5).trim(); let name=`room ${id}`;
      const tileGrid=[],itemPlacements=[],exits=[]; i++;
      while(i<lines.length){
        const r=lines[i].trim();
        if(!r){i++;break;}
        if(r.startsWith('NAME '))name=r.slice(5);
        else if(r.startsWith('EXT ')){
          const m=r.match(/EXT (\d+),(\d+)\s+(?:ROOM\s+)?(\d+)\s+(?:AT\s+)?(\d+),(\d+)/);
          if(m)exits.push({x:+m[1],y:+m[2],destRoom:+m[3],arrX:+m[4],arrY:+m[5]});
        } else if(r.startsWith('ITM ')){
          const m=r.match(/ITM (\w+) (\d+),(\d+)/);
          if(m)itemPlacements.push({bitsyId:m[1],x:+m[2],y:+m[3]});
        } else if(/^[a-z0-9,]+$/.test(r)&&r.includes(','))tileGrid.push(r.split(','));
        i++;
      }
      rawRooms.push({bitsyId:id,name,tileGrid,itemPlacements,exits});
    } else if(l.startsWith('TIL ')){
      const id=l.slice(4).trim(); let name=`tile_${id}`,isWall=false;
      const pixRows=[]; i++;
      while(i<lines.length){
        const r=lines[i].trim();
        if(!r){i++;break;}
        if(r.startsWith('NAME '))name=r.slice(5);
        else if(r==='WAL true')isWall=true;
        else if(/^[0-9a-f>]+$/i.test(r)&&(r.length>=4||r==='>'))pixRows.push(r);
        i++;
      }
      rawTiles.push({bitsyId:id,name,frames:parsePixels(pixRows),isWall});
    } else if(l.startsWith('SPR ')){
      const id=l.slice(4).trim(); let name=id==='A'?'avatar':`sprite_${id}`;
      let dlgRef=null,posRoom=0,posX=1,posY=1;
      const pixRows=[]; i++;
      while(i<lines.length){
        const r=lines[i].trim();
        if(!r){i++;break;}
        if(r.startsWith('NAME '))name=r.slice(5);
        else if(r.startsWith('DLG '))dlgRef=r.slice(4).trim().split(/\s/)[0];
        else if(r.startsWith('POS ')){const m=r.match(/POS (\d+) (\d+),(\d+)/);if(m){posRoom=+m[1];posX=+m[2];posY=+m[3];}}
        else if(/^[01>]+$/.test(r)&&(r.length>=4||r==='>'))pixRows.push(r);
        i++;
      }
      rawSprites.push({bitsyId:id,name,frames:parsePixels(pixRows),dlgRef,posRoom,posX,posY});
    } else if(l.startsWith('ITM ')){
      const id=l.slice(4).trim(); let name=`item_${id}`,dlgRef=null;
      const pixRows=[]; i++;
      let hasPixels=false;
      while(i<lines.length){
        const r=lines[i].trim();
        if(!r){i++;break;}
        if(r.startsWith('NAME '))name=r.slice(5);
        else if(r.startsWith('DLG '))dlgRef=r.slice(4).trim().split(/\s/)[0];
        else if(/^[01>]+$/.test(r)&&(r.length>=4||r==='>')){{pixRows.push(r);hasPixels=true;}}
        i++;
      }
      if(hasPixels)rawItems.push({bitsyId:id,name,frames:parsePixels(pixRows),dlgRef});
    } else if(l.startsWith('DLG ')){
      const id=l.slice(4).trim().split(/\s/)[0]; i++;
      const textLines=[];
      while(i<lines.length){
        const r=lines[i];
        if(!r.trim()){i++;break;}
        if(!r.trim().startsWith('NAME ')&&r.trim()!=='END')textLines.push(r);
        i++;
      }
      while(textLines.length&&!textLines[textLines.length-1].trim())textLines.pop();
      dialogs[id]=textLines.join('\n');
    } else { i++; }
  }

  // Build palette from PAL 0
  const toHex=({r,g,b})=>'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
  const newPalette=[...DEFAULT_PALETTE];
  if(palettes['0']?.length>=1)newPalette[0]=toHex(palettes['0'][0]);
  if(palettes['0']?.length>=2)newPalette[1]=toHex(palettes['0'][1]);
  if(palettes['0']?.length>=3)newPalette[2]=toHex(palettes['0'][2]);

  // Tile id map: bitsyId letter → our uid
  const tileIdMap={};
  const newTiles=rawTiles.map(t=>{
    const id=uid(); tileIdMap[t.bitsyId]=id;
    return {id,name:t.name,frames:t.frames,tileType:t.isWall?'wall':'walkable'};
  });

  // Item sprites
  const itemIdMap={};
  const itemSprites=rawItems.map(it=>{
    const id=uid(); itemIdMap[it.bitsyId]=id;
    return {id,name:it.name,frames:it.frames,tileType:'item',
      dialog:it.dlgRef!=null?(dialogs[it.dlgRef]||''):'',blip:{wave:'square',freq:440}};
  });

  // Sprites: A=avatar first
  const spriteIdMap={};
  const avatarRaw=rawSprites.find(s=>s.bitsyId==='A');
  const npcRaws=rawSprites.filter(s=>s.bitsyId!=='A');
  const avatarSpr={
    id:uid(), name:avatarRaw?.name||'avatar',
    frames:avatarRaw?.frames||[emptyGrid(8,8)],
    tileType:'walkable',dialog:'',blip:{wave:'square',freq:440},
    _pr:avatarRaw?.posRoom??0,_px:avatarRaw?.posX??1,_py:avatarRaw?.posY??1,
  };
  if(avatarRaw)spriteIdMap['A']=avatarSpr.id;
  const npcSprs=npcRaws.map(s=>{
    const id=uid(); spriteIdMap[s.bitsyId]=id;
    return {id,name:s.name,frames:s.frames,tileType:'walkable',
      dialog:s.dlgRef!=null?(dialogs[s.dlgRef]||''):'',blip:{wave:'square',freq:440},
      _pr:s.posRoom,_px:s.posX,_py:s.posY};
  });
  const allSprites=[avatarSpr,...npcSprs,...itemSprites];

  // Rooms
  const newRooms=rawRooms.map(room=>{
    const id=uid();
    const tileGrid=room.tileGrid.map(row=>row.map(cell=>
      (cell==='0'||!cell)?null:(tileIdMap[cell]||null)
    ));
    while(tileGrid.length<16)tileGrid.push(Array(16).fill(null));
    tileGrid.forEach(row=>{while(row.length<16)row.push(null);});
    const roomIdxNum=+room.bitsyId;
    // NPCs from sprite POS
    const npcs=[...npcSprs,...itemSprites]
      .filter(s=>s._pr===roomIdxNum)
      .map(s=>({spriteId:s.id,x:s._px,y:s._py}));
    // Item placements from room ITM lines
    room.itemPlacements.forEach(({bitsyId:bid,x,y})=>{
      const sid=itemIdMap[bid]; if(sid&&!npcs.find(n=>n.spriteId===sid))npcs.push({spriteId:sid,x,y});
    });
    const avatarStart=(avatarSpr._pr===roomIdxNum)?{x:avatarSpr._px,y:avatarSpr._py}:null;
    const exits=room.exits.map(ex=>({x:ex.x,y:ex.y,destRoom:ex.destRoom}));
    return {id,name:room.name,tiles:tileGrid,npcs,exits,avatarStart,tuneId:null,rules:[]};
  });

  // Clean up internal _pr/_px/_py
  const cleanSprites=allSprites.map(({_pr,_px,_py,...s})=>s);
  return {gameTitle,palette:newPalette,sprites:cleanSprites,tiles:newTiles,rooms:newRooms};
}

function exportBitsyData(gameTitle, palette, sprites, tiles, rooms, tune) {
  let out = `${gameTitle || "My Game"}\n\n`;

  // Bitsy 8.x requires these version directive lines or the editor won't parse correctly
  out += `! VER_MAJ 8\n! VER_MIN 12\n! ROOM_FORMAT 1\n! DLG_COMPAT 0\n! TXT_MODE 0\n\n`;

  // ── PAL ──────────────────────────────────────────────────────────────────
  out += `PAL 0\n`;
  palette.forEach(hex => { const c = hexToRgb(hex); out += `${c.r},${c.g},${c.b}\n`; });
  out += `\n`;

  // ── ROOM (must come before TIL and SPR in Bitsy's parse order) ───────────
  rooms.forEach((room, ri) => {
    out += `ROOM ${ri}\n`;
    (room.tiles || []).forEach(row => {
      out += row.map(id => {
        if (!id) return "0";
        const ti = tiles.findIndex(t => t.id === id);
        return ti >= 0 ? String.fromCharCode(97 + ti) : "0";
      }).join(",") + "\n";
    });
    (room.exits||[]).forEach(ex=>{
      if(ex.isEnding) return; // Endings are handled via tileType:"end" tiles, not EXT lines
      const ax=ex.arrX??rooms[ex.destRoom]?.avatarStart?.x??1;
      const ay=ex.arrY??rooms[ex.destRoom]?.avatarStart?.y??1;
      out += `EXT ${ex.x},${ex.y} ROOM ${ex.destRoom} AT ${ax},${ay}\n`;
    });
    if (room.name) out += `NAME ${room.name}\n`;
    out += `PAL 0\n\n`;
  });

  // ── TIL ──────────────────────────────────────────────────────────────────
  tiles.forEach((tile, i) => {
    out += `TIL ${String.fromCharCode(97 + i)}\n`;
    tile.frames.forEach((frame, fi) => {
      frame.forEach(row => out += row.map(safePixel).map(v => v.toString(36)).join("") + "\n");
      if (fi < tile.frames.length - 1) out += ">\n";
    });
    if (tile.name) out += `NAME ${tile.name}\n`;
    out += `COL ${[...new Set(tile.frames[0].flat().map(safePixel))].join(",")}\n`;
    if (tile.tileType === "wall") out += `WAL true\n`;
    out += `\n`;
  });

  // ── SPR ──────────────────────────────────────────────────────────────────
  // sprites[0] → SPR A (avatar/player); sprites[1..n] → SPR a, b, c… (NPCs)
  let dlgIndex = 0;
  sprites.forEach((spr, i) => {
    const sprId = i === 0 ? "A" : String.fromCharCode(97 + (i - 1));
    out += `SPR ${sprId}\n`;
    spr.frames.forEach((frame, fi) => {
      frame.forEach(row => out += row.map(safePixel).map(v => v.toString(36)).join("") + "\n");
      if (fi < spr.frames.length - 1) out += ">\n";
    });
    if (spr.name) out += `NAME ${spr.name}\n`;
    out += `COL ${[...new Set(spr.frames[0].flat().map(safePixel))].join(",")}\n`;
    // Dialog ref uses a plain integer (not a named string) per Bitsy spec
    if (i > 0 && spr.dialog) { out += `DLG ${dlgIndex}\n`; dlgIndex++; }
    // Find actual room placement — for avatar check avatarStart; for NPCs check npcs array
    let posRoom = 0, posX = i === 0 ? 4 : (i * 2) % 14, posY = i === 0 ? 4 : 2;
    if (i === 0) {
      // Avatar: use explicit avatarStart if set on any room
      for (let ri = 0; ri < rooms.length; ri++) {
        if (rooms[ri].avatarStart) { posRoom = ri; posX = rooms[ri].avatarStart.x; posY = rooms[ri].avatarStart.y; break; }
      }
    } else {
      for (let ri = 0; ri < rooms.length; ri++) {
        const placed = (rooms[ri].npcs || []).find(n => n.spriteId === spr.id);
        if (placed) { posRoom = ri; posX = placed.x; posY = placed.y; break; }
      }
    }
    out += `POS ${posRoom} ${posX},${posY}\n\n`;
  });

  // ── DLG ──────────────────────────────────────────────────────────────────
  let dlgOut = 0;
  sprites.forEach((spr, i) => {
    if (i > 0 && spr.dialog) {
      out += `DLG ${dlgOut}\n${spr.dialog}\nEND\n\n`;
      dlgOut++;
    }
  });

  // ── TUNE (if any steps active) ────────────────────────────────────────────
  if (tune && tune.some(s=>s.active)) {
    out += `TUNE 0\n`;
    out += `NAME theme\n`;
    tune.forEach((s,i) => {
      out += (s.active ? s.semi : '-') + (i<tune.length-1?',':'\n');
    });
    out += `\n`;
  }

  return out;
}

// ─── Help Modal ───────────────────────────────────────────────────────────────
function HelpModal({ onClose }) {
  const shortcuts=[["B","Draw / Pencil"],["E","Erase"],["F","Fill"],["I","Pick Color"],["G","Toggle Grid"],["1–9","Select Color"],["?","This Help"],["↑↓←→","Move (Playtest)"],["Space / ↵","Next Dialog (Playtest)"]];
  return (
    <div style={S.modal} onClick={onClose}>
      <div style={{...S.modalContent,maxWidth:380}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h3 style={{margin:0,color:"#38bdf8"}}>⌨️ Keyboard Shortcuts</h3>
          <button style={S.btn(false)} onClick={onClose}>✕</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"max-content 1fr",gap:"8px 16px",alignItems:"center"}}>
          {shortcuts.map(([key,desc])=>[
            <kbd key={key} style={{background:"#0f172a",border:"1px solid rgba(255,255,255,0.12)",borderRadius:4,padding:"2px 8px",color:"#38bdf8",fontFamily:"monospace",fontSize:12,textAlign:"center",display:"block"}}>{key}</kbd>,
            <span key={desc} style={{fontSize:13,color:"#e2e8f0"}}>{desc}</span>
          ])}
        </div>
        <div style={{marginTop:14,padding:"10px 12px",background:"rgba(56,189,248,0.05)",borderRadius:6,border:"1px solid rgba(56,189,248,0.1)",fontSize:11,color:"#64748b",lineHeight:1.7}}>
          <b style={{color:"#94a3b8"}}>Quick start:</b> Draw tiles → place in room → add NPCs → ▶ Play
        </div>
      </div>
    </div>
  );
}

// ─── New Game Wizard ──────────────────────────────────────────────────────────
function WizardModal({ palette, onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [chosenChar, setChosenChar] = useState(null);
  const [chosenWorld, setChosenWorld] = useState(null);

  const stepTitles = ["Choose your character", "Choose your world"];
  const stepEmojis = ["🧑", "🌍"];

  return (
    <div style={S.modal}>
      <div style={{...S.modalContent, maxWidth:540}}>
        {/* Header */}
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:28,marginBottom:6}}>{stepEmojis[step]}</div>
          <h2 style={{margin:0,color:"#38bdf8",fontSize:18}}>{stepTitles[step]}</h2>
          <div style={{display:"flex",justifyContent:"center",gap:6,marginTop:10}}>
            {[0,1].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:i<=step?"#38bdf8":"rgba(255,255,255,0.1)"}} />)}
          </div>
        </div>

        {step===0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
            {WIZARD_CHARS.map((ch,i)=>(
              <button key={i} onClick={()=>setChosenChar(i)}
                style={{background:chosenChar===i?"rgba(56,189,248,0.15)":"rgba(255,255,255,0.03)",border:chosenChar===i?"2px solid #38bdf8":"2px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"12px 8px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6,transition:"all .15s"}}>
                <MiniCanvas grid={ch.grid} palette={palette} size={48} />
                <span style={{fontSize:11,color:chosenChar===i?"#38bdf8":"#94a3b8",fontWeight:chosenChar===i?700:400}}>{ch.name}</span>
              </button>
            ))}
          </div>
        )}

        {step===1&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:20}}>
            {WIZARD_WORLDS.map((w,i)=>(
              <button key={i} onClick={()=>setChosenWorld(i)}
                style={{background:chosenWorld===i?"rgba(56,189,248,0.15)":"rgba(255,255,255,0.03)",border:chosenWorld===i?"2px solid #38bdf8":"2px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"14px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"all .15s"}}>
                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                  <MiniCanvas grid={w.floor} palette={palette} size={28} />
                  <MiniCanvas grid={w.wall} palette={palette} size={28} />
                </div>
                <div style={{textAlign:"left"}}>
                  <div style={{fontSize:13,color:chosenWorld===i?"#38bdf8":"#e2e8f0",fontWeight:700}}>{w.name}</div>
                  <div style={{fontSize:10,color:"#64748b",marginTop:2}}>{w.floorName} + {w.wallName}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <button style={{...S.btn(false),color:"#475569",fontSize:11}} onClick={onSkip}>Skip →</button>
          <div style={{display:"flex",gap:8}}>
            {step>0&&<button style={S.btn(false)} onClick={()=>setStep(s=>s-1)}>← Back</button>}
            {step===0&&<button style={chosenChar===null?S.btn(false):S.btnPrimary} disabled={chosenChar===null} onClick={()=>setStep(1)}>Next →</button>}
            {step===1&&<button style={chosenWorld===null?S.btn(false):S.btnPrimary} disabled={chosenWorld===null}
              onClick={()=>onComplete(chosenChar,chosenWorld)}>🎮 Start Creating!</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Game Progress Checklist ──────────────────────────────────────────────────
function ProgressChecklist({ sprites, tiles, rooms }) {
  const avatar = sprites[0];
  const checks = [
    { label:"Draw your player",   done: avatar?.frames[0].flat().some(v=>v!==0) },
    { label:"Design a tile",      done: tiles.some(t=>t.frames[0].flat().some(v=>v!==0)) },
    { label:"Build a room",       done: rooms.some(r=>r.tiles.flat().some(v=>v!==null)) },
    { label:"Add a collectible",  done: sprites.some(s=>s.tileType==="item") },
    { label:"Give someone dialog",done: sprites.some(s=>s.dialog?.trim()) },
    { label:"Add an exit",        done: rooms.some(r=>r.exits?.length>0) },
  ];
  const doneCount = checks.filter(c=>c.done).length;
  const pct = Math.round(doneCount/checks.length*100);

  return (
    <div style={{...S.section,marginBottom:0}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <div style={S.sectionTitle}>Game Checklist</div>
        <span style={{fontSize:10,color:pct===100?"#4ade80":"#64748b",fontWeight:700}}>{doneCount}/{checks.length}</span>
      </div>
      <div style={{height:3,background:"rgba(255,255,255,0.06)",borderRadius:2,marginBottom:8,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:pct===100?"#4ade80":"#38bdf8",borderRadius:2,transition:"width .4s"}} />
      </div>
      {checks.map(({label,done},i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:7,marginBottom:4,fontSize:11,color:done?"#e2e8f0":"#475569",transition:"color .3s"}}>
          <span style={{fontSize:13,transition:"transform .3s",transform:done?"scale(1.1)":"scale(1)"}}>{done?"✅":"⬜"}</span>
          <span style={{textDecoration:done?"line-through":"none",opacity:done?0.6:1}}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Pre-Play Hints Modal ─────────────────────────────────────────────────────
function PrePlayModal({ sprites, tiles, rooms, onPlay, onClose }) {
  const hints = [];
  const avatar = sprites[0];
  const hasAvatarPixels = avatar?.frames[0].flat().some(v=>v!==0);
  const hasRoomTiles = rooms.some(r=>r.tiles.flat().some(v=>v!==null));
  const hasExit = rooms.some(r=>r.exits?.length>0);
  if(!hasAvatarPixels) hints.push({emoji:"🧑",text:"Your player has no pixels yet — draw something in the Sprites tab!"});
  if(!hasRoomTiles) hints.push({emoji:"🗺️",text:"Your room is empty — place some tiles in the Rooms tab first!"});
  if(!hasExit) hints.push({emoji:"🚪",text:"No exit yet — players will be stuck! Use the Exit tool to add a door."});
  if(hints.length===0){ onPlay(); return null; }
  return (
    <div style={S.modal} onClick={onClose}>
      <div style={{...S.modalContent,maxWidth:400}} onClick={e=>e.stopPropagation()}>
        <h3 style={{margin:"0 0 4px",color:"#fbbf24"}}>⚠️ Before you play…</h3>
        <p style={{fontSize:12,color:"#64748b",marginBottom:16}}>Your game will work, but here's what's missing:</p>
        {hints.map(({emoji,text},i)=>(
          <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:12,padding:"10px 12px",background:"rgba(251,191,36,0.07)",borderRadius:8,border:"1px solid rgba(251,191,36,0.15)"}}>
            <span style={{fontSize:18}}>{emoji}</span>
            <span style={{fontSize:12,color:"#e2e8f0",lineHeight:1.5}}>{text}</span>
          </div>
        ))}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
          <button style={S.btn(false)} onClick={onClose}>Fix it first</button>
          <button style={S.btnPrimary} onClick={onPlay}>▶ Play anyway</button>
        </div>
      </div>
    </div>
  );
}

// ─── Export Modal ─────────────────────────────────────────────────────────────
function ExportModal({ data, onClose }) {
  const [copied, setCopied] = useState(false);
  const textRef = useRef(null);

  const copy = () => {
    if (data.type === "text") {
      navigator.clipboard.writeText(data.content).then(() => {
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        // Fallback: select all in textarea
        textRef.current?.select(); document.execCommand("copy");
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={{ ...S.modalContent, maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, color: "#e94560" }}>{data.title}</h3>
          <button style={S.btn(false)} onClick={onClose}>✕</button>
        </div>

        {data.type === "text" && (
          <>
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>
              Copy this text and paste it into a <code style={{ color: "#ffec27" }}>.txt</code> file, then rename it to <code style={{ color: "#ffec27" }}>.bitsy</code> — or paste it into the Bitsy editor directly.
            </div>
            <textarea
              ref={textRef}
              readOnly
              value={data.content}
              style={{ ...S.input, height: 280, fontFamily: "monospace", fontSize: 11, resize: "vertical", whiteSpace: "pre" }}
              onFocus={e => e.target.select()}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button style={{ ...S.btnPrimary, flex: 1 }} onClick={()=>{
                const blob=new Blob([data.content],{type:"text/plain"});
                const url=URL.createObjectURL(blob);
                const a=document.createElement("a");
                a.href=url; a.download=(data.title||"game").replace(/\.bitsy$/i,"")+".bitsy"; a.click();
                URL.revokeObjectURL(url);
              }}>📥 Download .bitsy</button>
              <button style={{ ...S.btn(copied), flex: 1 }} onClick={copy}>
                {copied ? "✓ Copied!" : "📋 Copy"}
              </button>
            </div>
          </>
        )}

        {data.type === "image" && (
          <>
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>
              Right-click the image below and choose <b>Save Image As…</b> to download it.
            </div>
            <div style={{ textAlign: "center", background: "#0d1b3e", borderRadius: 6, padding: 16, marginBottom: 10 }}>
              <img src={data.content} alt={data.title} style={{ imageRendering: "pixelated", maxWidth: "100%", maxHeight: 300, border: "1px solid #333" }} />
            </div>
            <div style={{ fontSize: 11, color: "#666", textAlign: "center" }}>
              Right-click → Save Image As… · or long-press on mobile
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── ID gen ───────────────────────────────────────────────────────────────────
let nextId=1;
function uid(){ return `id_${nextId++}`; }

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,setTab]=useState("sprite");
  const [palette,setPalette]=useState([...DEFAULT_PALETTE]);
  const [selectedColor,setSelectedColor]=useState(1);
  const [tool,setTool]=useState("draw");
  const [showGrid,setShowGrid]=useState(true);
  const [showImport,setShowImport]=useState(false);
  const [showPlaytest,setShowPlaytest]=useState(false);
  const [exportModal,setExportModal]=useState(null); // {type,title,content}
  const [gameTitle,setGameTitle]=useState("My Multicolor Bitsy Game");
  const [activePack,setActivePack]=useState(null);
  const [exitModal,setExitModal]=useState(null); // {x,y} being configured
  const npcDragModeRef=useRef("place"); // "place"|"remove" — set on mousedown, held for drag
  const [findQuery,setFindQuery]=useState("");
  const [zoom,setZoom]=useState(1);
  const [showHelp,setShowHelp]=useState(false);
  const [showWizard,setShowWizard]=useState(true);
  const [showPrePlay,setShowPrePlay]=useState(false);
  const [showBitsyImport,setShowBitsyImport]=useState(false);
  const [winConditions,setWinConditions]=useState({}); // {spriteId: targetCount}
  const [tune,setTune]=useState(Array.from({length:TUNE_STEPS},()=>({semi:12,active:false})));
  const [tuneVolume,setTuneVolume]=useState(0.15);
  const [savedTunes,setSavedTunes]=useState([]);

  // Grid config
  const [spriteW,setSpriteW]=useState(8); const [spriteH,setSpriteH]=useState(8);
  const [tileW,setTileW]=useState(8);   const [tileH,setTileH]=useState(8);
  const [roomW,setRoomW]=useState(16);  const [roomH,setRoomH]=useState(16);

  const [sprites,setSprites]=useState([{id:uid(),name:"avatar",frames:[emptyGrid(8,8)],dialog:"",tileType:"walkable",blip:{wave:"square",freq:440}}]);
  const [tiles,setTiles]=useState([{id:uid(),name:"wall",frames:[emptyGrid(8,8)],tileType:"wall"}]);
  const [selectedSprite,setSelectedSprite]=useState(0);
  const [selectedTile,setSelectedTile]=useState(0);
  const [selectedFrame,setSelectedFrame]=useState(0);

  const [rooms,setRooms]=useState([{id:uid(),name:"room 0",tiles:emptyGrid(16,16).map(r=>r.map(()=>null)),npcs:[],exits:[],avatarStart:null,tuneId:null,rules:[]}]);
  const [selectedRoom,setSelectedRoom]=useState(0);
  const [roomTool,setRoomTool]=useState("place"); // place | erase | fill | npc | avatarStart

  const [animFrame,setAnimFrame]=useState(0);
  const [playing,setPlaying]=useState(false);

  useEffect(()=>{ if(!playing)return; const t=setInterval(()=>setAnimFrame(f=>f+1),200); return()=>clearInterval(t); },[playing]);

  // Keyboard shortcuts
  useEffect(()=>{
    const h=(e)=>{
      if(e.target.tagName==="INPUT"||e.target.tagName==="SELECT"||e.target.tagName==="TEXTAREA")return;
      switch(e.key.toLowerCase()){
        case"b":setTool("draw");break; case"d":setTool("draw");break;
        case"e":setTool("erase");break; case"f":setTool("fill");break;
        case"i":setTool("pick");break; case"g":setShowGrid(v=>!v);break;
        case"?":setShowHelp(v=>!v);break;
        case" ":e.preventDefault();setShowPrePlay(true);break;
        default: if(e.key>="1"&&e.key<="9"){const i=parseInt(e.key)-1;if(i<palette.length)setSelectedColor(i);}
      }
    };
    window.addEventListener("keydown",h); return()=>window.removeEventListener("keydown",h);
  },[palette.length]);

  const currentItems=tab==="sprite"?sprites:tiles;
  const selectedIdx=tab==="sprite"?selectedSprite:selectedTile;
  const currentItem=currentItems[selectedIdx];
  const currentFrame=currentItem?.frames[selectedFrame]||emptyGrid(8,8);
  const itemW=tab==="sprite"?spriteW:tileW;
  const itemH=tab==="sprite"?spriteH:tileH;

  // Flood fill
  const floodFill=useCallback((grid,x,y,newColor)=>{
    const w=grid[0].length,h=grid.length,old=grid[y][x];
    if(old===newColor)return grid;
    const ng=grid.map(r=>[...r]);
    const stack=[[x,y]];
    while(stack.length){
      const[cx,cy]=stack.pop();
      if(cx<0||cx>=w||cy<0||cy>=h||ng[cy][cx]!==old)continue;
      ng[cy][cx]=newColor;
      stack.push([cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]);
    }
    return ng;
  },[]);

  const handleDraw=useCallback((x,y)=>{
    if(tool==="pick"){
      const colorIdx=currentFrameRef.current[y]?.[x];
      if(colorIdx!==undefined)setSelectedColor(colorIdx);
      setTool("draw");
      return;
    }
    const setItems=tab==="sprite"?setSprites:setTiles;
    const idx=tab==="sprite"?selectedSprite:selectedTile;
    setItems(prev=>{
      const items=[...prev];
      const item={...items[idx],frames:[...items[idx].frames]};
      let frame=item.frames[selectedFrame]?.map(r=>[...r]);
      if(!frame)return prev;
      if(tool==="draw")frame[y][x]=selectedColor;
      else if(tool==="erase")frame[y][x]=0;
      else if(tool==="fill")frame=floodFill(frame,x,y,selectedColor);
      item.frames[selectedFrame]=frame;
      items[idx]=item;
      return items;
    });
  },[tab,selectedSprite,selectedTile,selectedFrame,selectedColor,tool,floodFill]);

  const updateBlip=(field,val)=>{
    setSprites(prev=>{const items=[...prev];items[selectedSprite]={...items[selectedSprite],blip:{...items[selectedSprite].blip,[field]:val}};return items;});
  };
  const addItem=()=>{
    const w=tab==="sprite"?spriteW:tileW, h=tab==="sprite"?spriteH:tileH;
    const newItem={id:uid(),name:`${tab} ${currentItems.length}`,frames:[emptyGrid(w,h)],tileType:"walkable",dialog:"",blip:{wave:"square",freq:440}};
    if(tab==="sprite"){setSprites(p=>[...p,newItem]);setSelectedSprite(sprites.length);}
    else{setTiles(p=>[...p,newItem]);setSelectedTile(tiles.length);}
    setSelectedFrame(0);
  };
  const deleteItem=()=>{
    if(currentItems.length<=1)return;
    const setItems=tab==="sprite"?setSprites:setTiles;
    const setSelected=tab==="sprite"?setSelectedSprite:setSelectedTile;
    const idx=tab==="sprite"?selectedSprite:selectedTile;
    setItems(p=>p.filter((_,i)=>i!==idx));
    setSelected(Math.max(0,idx-1)); setSelectedFrame(0);
  };
  const addFrame=()=>{
    if(!currentItem||currentItem.frames.length>=MAX_FRAMES)return;
    const setItems=tab==="sprite"?setSprites:setTiles;
    const idx=tab==="sprite"?selectedSprite:selectedTile;
    setItems(prev=>{const items=[...prev];items[idx]={...items[idx],frames:[...items[idx].frames,emptyGrid(itemW,itemH)]};return items;});
    setSelectedFrame(currentItem.frames.length);
  };
  const deleteFrame=()=>{
    if(!currentItem||currentItem.frames.length<=1)return;
    const setItems=tab==="sprite"?setSprites:setTiles;
    const idx=tab==="sprite"?selectedSprite:selectedTile;
    setItems(prev=>{const items=[...prev];items[idx]={...items[idx],frames:items[idx].frames.filter((_,i)=>i!==selectedFrame)};return items;});
    setSelectedFrame(Math.max(0,selectedFrame-1));
  };
  const duplicateFrame=()=>{
    if(!currentItem||currentItem.frames.length>=MAX_FRAMES)return;
    const setItems=tab==="sprite"?setSprites:setTiles;
    const idx=tab==="sprite"?selectedSprite:selectedTile;
    setItems(prev=>{const items=[...prev];const copy=currentItem.frames[selectedFrame].map(r=>[...r]);items[idx]={...items[idx],frames:[...items[idx].frames,copy]};return items;});
    setSelectedFrame(currentItem.frames.length);
  };
  const renameItem=(v)=>{
    const setItems=tab==="sprite"?setSprites:setTiles;
    const idx=tab==="sprite"?selectedSprite:selectedTile;
    setItems(prev=>{const items=[...prev];items[idx]={...items[idx],name:v};return items;});
  };
  const updateDialog=(v)=>{
    const idx=selectedSprite;
    setSprites(prev=>{const items=[...prev];items[idx]={...items[idx],dialog:v};return items;});
  };
  const updateTileType=(v)=>{
    const idx=tab==="sprite"?selectedSprite:selectedTile;
    const setItems=tab==="sprite"?setSprites:setTiles;
    setItems(prev=>{const items=[...prev];items[idx]={...items[idx],tileType:v};return items;});
  };

  const updateColor=(i,hex)=>setPalette(prev=>{const p=[...prev];p[i]=hex;return p;});

  // Import
  const handleImport=({grid,palette:newPalette,mode})=>{
    if(newPalette)setPalette(newPalette.slice(0,MAX_COLORS));
    if(mode==="sprite"){
      const n={id:uid(),name:"imported",frames:[grid],tileType:"walkable",dialog:"",blip:{wave:"square",freq:440}};
      setSprites(p=>{const next=[...p,n];setSelectedSprite(next.length-1);return next;});
      setSpriteW(grid[0].length);setSpriteH(grid.length);setTab("sprite");
    } else {
      const n={id:uid(),name:"imported_tile",frames:[grid],tileType:"walkable"};
      setTiles(p=>{setSelectedTile(p.length);return[...p,n];});
      setTileW(grid[0].length);setTileH(grid.length);setTab("tile");
    }
    setSelectedFrame(0);setShowImport(false);
  };

  // Copy any sprite's pixels into the avatar (sprites[0])
  const setAsAvatar=(sourceIdx)=>{
    const source=sprites[sourceIdx];
    if(!source)return;
    setSprites(prev=>{
      const items=[...prev];
      // Replace avatar frames with copies of the source's frames
      items[0]={ ...items[0], frames: source.frames.map(f=>f.map(r=>[...r])) };
      return items;
    });
    setSpriteW(source.frames[0][0].length);
    setSpriteH(source.frames[0].length);
    setSelectedSprite(0);
    setSelectedFrame(0);
  };

  // Add from asset pack
  // If the asset is a sprite AND the avatar (sprites[0]) is currently selected,
  // offer to replace the avatar directly; otherwise always add as a new item.
  const addFromPack=(asset)=>{
    const grid=asset.grid.map(r=>[...r]);
    if(asset.itemType==="sprite"){
      if(tab==="sprite"&&selectedSprite===0){
        // Replace the avatar's pixels in-place
        setSprites(prev=>{
          const items=[...prev];
          items[0]={ ...items[0], frames:[grid] };
          return items;
        });
        setSpriteW(grid[0].length);setSpriteH(grid.length);
        setSelectedFrame(0);
      } else {
        const n={id:uid(),name:asset.name,frames:[grid],tileType:asset.tileType||"walkable",dialog:asset.dialog||"",blip:asset.blip||{wave:"square",freq:440}};
        setSprites(p=>{setSelectedSprite(p.length);return[...p,n];});
        setSpriteW(grid[0].length);setSpriteH(grid.length);setTab("sprite");
        setSelectedFrame(0);
      }
    } else {
      const n={id:uid(),name:asset.name,frames:[grid],tileType:asset.tileType||"walkable"};
      setTiles(p=>{setSelectedTile(p.length);return[...p,n];});
      setTileW(grid[0].length);setTileH(grid.length);setTab("tile");
      setSelectedFrame(0);
    }
  };

  // ── Exports (modal-based — sandboxed iframes block programmatic downloads) ──
  const makeSpriteCanvas=(frame,scale)=>{
    const w=frame[0].length,h=frame.length;
    const c=document.createElement("canvas");c.width=w*scale;c.height=h*scale;
    const ctx=c.getContext("2d");
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){ctx.fillStyle=palette[frame[y][x]]||palette[0];ctx.fillRect(x*scale,y*scale,scale,scale);}
    return c;
  };
  const exportPng=()=>{
    if(!currentItem)return;
    try{
      const frame=currentItem.frames[selectedFrame];
      const scale=Math.max(4,Math.floor(320/Math.max(frame[0].length,frame.length)));
      const dataUrl=makeSpriteCanvas(frame,scale).toDataURL("image/png");
      setExportModal({type:"image",title:`${currentItem.name||"sprite"}.png`,content:dataUrl});
    }catch(err){alert("Export failed: "+err.message);}
  };
  const exportSpritesheet=()=>{
    if(!currentItem||currentItem.frames.length<2)return;
    try{
      const frames=currentItem.frames,w=frames[0][0].length,h=frames[0].length;
      const scale=Math.max(4,Math.floor(320/Math.max(w,h)));
      const c=document.createElement("canvas");c.width=w*scale*frames.length;c.height=h*scale;
      const ctx=c.getContext("2d");
      frames.forEach((frame,fi)=>{for(let y=0;y<h;y++)for(let x=0;x<w;x++){ctx.fillStyle=palette[frame[y][x]]||palette[0];ctx.fillRect((fi*w+x)*scale,y*scale,scale,scale);}});
      setExportModal({type:"image",title:`${currentItem.name||"sprite"} spritesheet`,content:c.toDataURL("image/png")});
    }catch(err){alert("Export failed: "+err.message);}
  };
  const exportGameData=()=>{
    try{
      const data=exportBitsyData(gameTitle,palette,sprites,tiles,rooms,tune);
      setExportModal({type:"text",title:"Game Data (.bitsy)",content:data});
    }catch(err){alert("Export failed: "+err.message);}
  };
  const exportRoomPng=(room)=>{
    try{
      const scale=3;
      const c=document.createElement("canvas");c.width=roomW*tileW*scale;c.height=roomH*tileH*scale;
      const ctx=c.getContext("2d");ctx.fillStyle=palette[0];ctx.fillRect(0,0,c.width,c.height);
      for(let ry=0;ry<roomH;ry++)for(let rx=0;rx<roomW;rx++){
        const tid=room.tiles[ry]?.[rx];const tile=tiles.find(t=>t.id===tid);if(!tile)continue;
        const frame=tile.frames[0];
        for(let py=0;py<tileH;py++)for(let px=0;px<tileW;px++){ctx.fillStyle=palette[frame[py]?.[px]||0]||palette[0];ctx.fillRect((rx*tileW+px)*scale,(ry*tileH+py)*scale,scale,scale);}
      }
      setExportModal({type:"image",title:`${room.name||"room"}.png`,content:c.toDataURL("image/png")});
    }catch(err){alert("Export failed: "+err.message);}
  };

  // Room handling — isFirst=true on mousedown, false on drag
  const handleRoomPlace=(rx,ry,isFirst=false)=>{
    setRooms(prev=>{
      const rs=[...prev];
      const room={...rs[selectedRoom],tiles:rs[selectedRoom].tiles.map(r=>[...r]),npcs:[...(rs[selectedRoom].npcs||[])]};
      if(roomTool==="erase"){
        room.tiles[ry][rx]=null;
        room.npcs=room.npcs.filter(n=>!(n.x===rx&&n.y===ry));
        room.exits=(room.exits||[]).filter(e=>!(e.x===rx&&e.y===ry));
      } else if(roomTool==="exit"){
        if(!isFirst)return prev; // only act on initial click, not drag
        const existing=(room.exits||[]).find(e=>e.x===rx&&e.y===ry);
        if(existing){ room.exits=(room.exits||[]).filter(e=>!(e.x===rx&&e.y===ry)); rs[selectedRoom]=room; return rs; }
        setExitModal({x:rx,y:ry});
        return prev;
      } else if(roomTool==="fill"){
        if(!isFirst)return prev; // fill only on click, not drag
        const old=room.tiles[ry][rx];
        const newId=tiles[selectedTile]?.id||null;
        if(old===newId)return prev;
        const stack=[[rx,ry]];
        while(stack.length){
          const[cx,cy]=stack.pop();
          if(cx<0||cx>=roomW||cy<0||cy>=roomH||room.tiles[cy][cx]!==old)continue;
          room.tiles[cy][cx]=newId;
          stack.push([cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]);
        }
      } else if(roomTool==="npc"){
        if(isFirst){
          // On first click: decide whether this drag places or removes
          const alreadyHere=room.npcs.find(n=>n.x===rx&&n.y===ry&&n.spriteId===sprites[selectedSprite]?.id);
          npcDragModeRef.current=alreadyHere?"remove":"place";
        }
        room.npcs=room.npcs.filter(n=>!(n.x===rx&&n.y===ry));
        if(npcDragModeRef.current==="place"&&sprites[selectedSprite]&&selectedSprite>0){
          room.npcs.push({spriteId:sprites[selectedSprite].id,x:rx,y:ry});
        }
      } else if(roomTool==="avatarStart"){
        if(!isFirst)return prev; // avatar start only on initial click
        const same=room.avatarStart&&room.avatarStart.x===rx&&room.avatarStart.y===ry;
        room.avatarStart=same?null:{x:rx,y:ry};
      } else {
        // Place tile — always place (no toggle during drag); erase tool handles removal
        const selectedId=tiles[selectedTile]?.id||null;
        room.tiles[ry][rx]=selectedId;
      }
      rs[selectedRoom]=room;
      return rs;
    });
  };
  const addRoom=()=>{
    const n={id:uid(),name:`room ${rooms.length}`,tiles:emptyGrid(roomW,roomH).map(r=>r.map(()=>null)),npcs:[],exits:[],avatarStart:null,tuneId:null,rules:[]};
    setRooms(p=>[...p,n]);setSelectedRoom(rooms.length);
  };
  const moveRoom=(i,delta)=>{
    const ni=i+delta;
    if(ni<0||ni>=rooms.length)return;
    setRooms(prev=>{const rs=[...prev];[rs[i],rs[ni]]=[rs[ni],rs[i]];return rs;});
    setSelectedRoom(ni);
  };

  const handleWizardComplete=(charIdx,worldIdx)=>{
    const ch=WIZARD_CHARS[charIdx];
    const wo=WIZARD_WORLDS[worldIdx];
    // Set avatar pixels
    setSprites(prev=>{
      const s=[...prev];
      s[0]={...s[0],frames:[ch.grid.map(r=>[...r])]};
      return s;
    });
    // Create floor + wall tiles
    const floorId=uid(), wallId=uid();
    const floorTile={id:floorId,name:wo.floorName,frames:[wo.floor.map(r=>[...r])],tileType:"walkable"};
    const wallTile={id:wallId,name:wo.wallName,frames:[wo.wall.map(r=>[...r])],tileType:"wall"};
    setTiles([floorTile,wallTile]);
    // Generate starter room: border=wall, interior=floor, exit at bottom-right
    const W=roomW, H=roomH;
    const grid=Array.from({length:H},(_,ry)=>Array.from({length:W},(_,rx)=>{
      if(rx===0||ry===0||rx===W-1||ry===H-1) return wallId;
      return floorId;
    }));
    const exitX=W-2, exitY=H-2;
    setRooms(prev=>{
      const rs=[...prev];
      rs[0]={...rs[0],tiles:grid,avatarStart:{x:1,y:1},exits:[{x:exitX,y:exitY,destRoom:0}]};
      return rs;
    });
    setSelectedRoom(0);
    setTab("room");
    setShowWizard(false);
  };

  const handleBitsyImport=({gameTitle:gt,palette:pal,sprites:sprs,tiles:tils,rooms:rms})=>{
    setGameTitle(gt);
    setPalette(pal.slice(0,MAX_COLORS));
    setSprites(sprs.length?sprs:[{id:uid(),name:"avatar",frames:[emptyGrid(8,8)],dialog:"",tileType:"walkable",blip:{wave:"square",freq:440}}]);
    setTiles(tils.length?tils:[{id:uid(),name:"wall",frames:[emptyGrid(8,8)],tileType:"wall"}]);
    setRooms(rms.length?rms:[{id:uid(),name:"room 0",tiles:emptyGrid(16,16).map(r=>r.map(()=>null)),npcs:[],exits:[],avatarStart:null,tuneId:null,rules:[]}]);
    setSelectedRoom(0); setSelectedSprite(0); setSelectedTile(0); setSelectedFrame(0);
    setTab("sprite");
    setShowBitsyImport(false);
    setShowWizard(false);
  };

  // Tune save/load
  const saveTune=(st)=>setSavedTunes(p=>[...p.filter(t=>t.name!==st.name),st]);
  const loadTune=(i)=>{const st=savedTunes[i];if(st)setTune([...st.steps]);};

  const confirmExit=(exitData)=>{
    setRooms(prev=>{
      const rs=[...prev];
      // Add forward exit to current room
      const room={...rs[selectedRoom],exits:[...(rs[selectedRoom].exits||[]).filter(e=>!(e.x===exitData.x&&e.y===exitData.y)),exitData]};
      rs[selectedRoom]=room;
      // If two-way and not an ending, add reverse exit in destination room pointing back here
      if(exitData.twoWay&&!exitData.isEnding&&exitData.destRoom!=null){
        const destRoomObj=rs[exitData.destRoom];
        // Reverse: placed at arrival pos in dest room, returns player to the source tile in this room
        const reverseExit={x:exitData.arrX??1,y:exitData.arrY??1,destRoom:selectedRoom,arrX:exitData.x,arrY:exitData.y,twoWay:true};
        rs[exitData.destRoom]={...destRoomObj,exits:[...(destRoomObj.exits||[]).filter(e=>!(e.x===reverseExit.x&&e.y===reverseExit.y)),reverseExit]};
      }
      return rs;
    });
    setExitModal(null);
  };

  // Resize grids
  const resizeSprite=(nw,nh)=>{
    setSpriteW(nw);setSpriteH(nh);
    setSprites(p=>p.map(s=>({...s,frames:s.frames.map(f=>{const g=emptyGrid(nw,nh);for(let y=0;y<Math.min(f.length,nh);y++)for(let x=0;x<Math.min(f[0].length,nw);x++)g[y][x]=f[y][x];return g;})})));
  };
  const resizeTile=(nw,nh)=>{
    setTileW(nw);setTileH(nh);
    setTiles(p=>p.map(t=>({...t,frames:t.frames.map(f=>{const g=emptyGrid(nw,nh);for(let y=0;y<Math.min(f.length,nh);y++)for(let x=0;x<Math.min(f[0].length,nw);x++)g[y][x]=f[y][x];return g;})})));
  };

  const basePixelSize=Math.max(4,Math.floor(340/Math.max(itemW,itemH)));
  const pixelSize=Math.max(1,Math.round(basePixelSize*zoom));
  const currentFrameRef=useRef(currentFrame);
  useEffect(()=>{currentFrameRef.current=currentFrame;},[currentFrame]);
  const previewFrame=currentItem?currentItem.frames[animFrame%currentItem.frames.length]:emptyGrid(8,8);
  const currentTileType=currentItem?.tileType||"walkable";

  return (
    <div style={S.app}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={S.header}>
        <span style={S.title}>🎮 Multicolor Bitsy</span>
        <div style={{width:1,height:20,background:"rgba(255,255,255,0.08)",flexShrink:0}} />
        <input value={gameTitle} onChange={e=>setGameTitle(e.target.value)}
          style={{...S.input,width:180,fontSize:12,flex:"0 0 auto"}} placeholder="Game title…" />
        <div style={{flex:1}} />
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button style={S.btnPrimary} onClick={()=>setShowPrePlay(true)}>▶ Play</button>
          <button style={S.btn(false)} onClick={()=>setShowImport(true)}>⬆ PNG</button>
          <button style={S.btn(false)} onClick={()=>setShowBitsyImport(true)}>📂 .bitsy</button>
          <button style={S.btn(false)} onClick={exportPng}>PNG</button>
          {currentItem?.frames.length>1&&<button style={S.btn(false)} onClick={exportSpritesheet}>Sheet</button>}
          <button style={{...S.btn(false),color:"#fb923c",borderColor:"rgba(251,146,60,0.3)"}} onClick={exportGameData}>Export .bitsy</button>
          <button style={{...S.btn(false),fontWeight:700,fontSize:13,padding:"4px 9px"}} onClick={()=>setShowHelp(true)} title="Keyboard shortcuts">?</button>
        </div>
      </div>

      {/* ── Mode Bar ───────────────────────────────────────────────────────── */}
      <div style={S.modeBar}>
        {[["sprite","🎨","Sprites"],["tile","🧱","Tiles"],["room","🗺","Rooms"],["tune","🎵","Audio"]].map(([t,emoji,label])=>(
          <button key={t} style={S.modeBtn(tab===t)} onClick={()=>{setTab(t);setSelectedFrame(0);}}>
            {emoji} {label}
          </button>
        ))}
      </div>

      <div style={S.main}>
        {/* Left Sidebar */}
        <div style={S.sidebar}>
          {/* Progress Checklist */}
          <ProgressChecklist sprites={sprites} tiles={tiles} rooms={rooms} />
          {/* Palette */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Palette</div>
            <div style={{display:"flex",flexWrap:"wrap"}}>
              {palette.map((color,i)=>(
                <div key={i} style={S.colorSwatch(color,i===selectedColor)} onClick={()=>setSelectedColor(i)} title={`${i}: ${color}`} />
              ))}
            </div>
            <div style={{display:"flex",gap:6,marginTop:6,alignItems:"center"}}>
              <input type="color" value={palette[selectedColor]} onChange={e=>updateColor(selectedColor,e.target.value)} style={{width:30,height:22,border:"none",background:"none",cursor:"pointer"}} />
              <input type="text" value={palette[selectedColor]} onChange={e=>updateColor(selectedColor,e.target.value)} style={{...S.input,width:76}} />
            </div>
          </div>

          {/* Tool Palette */}
          {tab!=="room"&&tab!=="tune"&&(
            <div style={S.section}>
              <div style={S.sectionTitle}>Tools</div>
              {[["draw","✏️","Pencil","B"],["erase","🧹","Eraser","E"],["fill","🪣","Fill","F"],["pick","💧","Pick Color","I"]].map(([t,emoji,label,key])=>(
                <button key={t} style={S.toolBtn(tool===t)} onClick={()=>setTool(t)}>
                  <span style={{fontSize:15}}>{emoji}</span>
                  <span style={{flex:1}}>{label}</span>
                  <kbd style={{fontSize:9,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:3,padding:"1px 5px",color:"#475569",fontFamily:"monospace"}}>{key}</kbd>
                </button>
              ))}
              <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,cursor:"pointer",color:"#94a3b8",padding:"4px 10px",marginTop:2}}>
                <input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)} />
                <span>Show grid</span>
                <kbd style={{marginLeft:"auto",fontSize:9,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:3,padding:"1px 5px",color:"#475569",fontFamily:"monospace"}}>G</kbd>
              </label>
            </div>
          )}

          {/* Size */}
          {tab!=="room"&&(
            <div style={S.section}>
              <div style={S.sectionTitle}>Size</div>
              <div style={{display:"flex",gap:4,alignItems:"center"}}>
                <select style={S.select} value={itemW}
                  onChange={e=>tab==="sprite"?resizeSprite(+e.target.value,spriteH):resizeTile(+e.target.value,tileH)}>
                  {GRID_OPTIONS.map(v=><option key={v} value={v}>{v}</option>)}
                </select>
                <span style={{color:"#888"}}>×</span>
                <select style={S.select} value={itemH}
                  onChange={e=>tab==="sprite"?resizeSprite(spriteW,+e.target.value):resizeTile(tileW,+e.target.value)}>
                  {GRID_OPTIONS.map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Room tools */}
          {tab==="room"&&(
            <div style={S.section}>
              <div style={S.sectionTitle}>Tools</div>
              <div style={{fontSize:10,color:"#475569",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>Tile</div>
              {[["place","🟦","Paint","T"],["erase","🧹","Erase","E"],["fill","🪣","Fill","F"]].map(([t,emoji,label,key])=>(
                <button key={t} style={S.toolBtn(roomTool===t)} onClick={()=>setRoomTool(t)}>
                  <span style={{fontSize:14}}>{emoji}</span>
                  <span style={{flex:1}}>{label}</span>
                  <kbd style={{fontSize:9,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:3,padding:"1px 5px",color:"#475569",fontFamily:"monospace"}}>{key}</kbd>
                </button>
              ))}
              <div style={{fontSize:10,color:"#475569",marginBottom:4,marginTop:8,textTransform:"uppercase",letterSpacing:"0.05em"}}>Objects</div>
              {[["npc","👥","NPC","N"],["exit","🚪","Exit","X"],["avatarStart","🧍","Start","S"]].map(([t,emoji,label,key])=>(
                <button key={t} style={S.toolBtn(roomTool===t)} onClick={()=>setRoomTool(t)}>
                  <span style={{fontSize:14}}>{emoji}</span>
                  <span style={{flex:1}}>{label}</span>
                  <kbd style={{fontSize:9,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:3,padding:"1px 5px",color:"#475569",fontFamily:"monospace"}}>{key}</kbd>
                </button>
              ))}
              <div style={{marginTop:8,padding:"6px 8px",background:"rgba(0,0,0,0.25)",borderRadius:5,fontSize:11,minHeight:28,color:"#64748b",lineHeight:1.4,border:"1px solid rgba(255,255,255,0.04)"}}>
                {roomTool==="place"&&<><span style={{color:"#38bdf8"}}>●</span> {`Painting: ${tiles[selectedTile]?.name||"none"}`}</>}
                {roomTool==="erase"&&<><span style={{color:"#f87171"}}>●</span> {" Erasing tiles, NPCs & exits"}</>}
                {roomTool==="fill"&&<><span style={{color:"#38bdf8"}}>●</span> {` Flood-fill: ${tiles[selectedTile]?.name||"none"}`}</>}
                {roomTool==="npc"&&<><span style={{color:"#fbbf24"}}>●</span> {` Placing: ${sprites[selectedSprite]?.name||"none"}`}</>}
                {roomTool==="exit"&&<><span style={{color:"#a78bfa"}}>●</span> {" Click cell to place exit"}</>}
                {roomTool==="avatarStart"&&<><span style={{color:"#4ade80"}}>●</span> {" Click cell for avatar start"}</>}
              </div>
              <div style={{marginTop:8,display:"flex",gap:4,alignItems:"center"}}>
                <span style={{fontSize:11,color:"#64748b"}}>Room size:</span>
                <select style={S.select} value={roomW} onChange={e=>setRoomW(+e.target.value)}>{[8,12,16,20,24,32].map(v=><option key={v} value={v}>{v}</option>)}</select>
                <span style={{color:"#475569"}}>×</span>
                <select style={S.select} value={roomH} onChange={e=>setRoomH(+e.target.value)}>{[8,12,16,20,24,32].map(v=><option key={v} value={v}>{v}</option>)}</select>
              </div>
            </div>
          )}

          {/* Find / Search */}
          {tab!=="room"&&tab!=="tune"&&(
            <div style={S.section}>
              <input value={findQuery} onChange={e=>setFindQuery(e.target.value)} placeholder="🔍 Find by name…" style={{...S.input,fontSize:11}} />
            </div>
          )}

          {/* Item list */}
          <div style={S.section}>
            <div style={S.sectionTitle}>{tab==="room"?"Rooms":tab==="sprite"?"Sprites":"Tiles"}</div>
            {tab==="room"?(
              <>
                {rooms.map((room,i)=>(
                  <div key={room.id} onClick={()=>setSelectedRoom(i)}
                    style={{padding:"3px 5px",background:i===selectedRoom?"#0f3460":"transparent",borderRadius:4,cursor:"pointer",fontSize:12,marginBottom:2,border:i===selectedRoom?"1px solid #e94560":"1px solid transparent",display:"flex",alignItems:"center",gap:4}}>
                    <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{room.name}</span>
                    <div style={{display:"flex",flexDirection:"column",gap:1,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                      <button style={{background:"none",border:"none",color:i>0?"#8b949e":"#333",cursor:i>0?"pointer":"default",fontSize:9,padding:"0 2px",lineHeight:1}} onClick={()=>moveRoom(i,-1)} disabled={i===0} title="Move up">▲</button>
                      <button style={{background:"none",border:"none",color:i<rooms.length-1?"#8b949e":"#333",cursor:i<rooms.length-1?"pointer":"default",fontSize:9,padding:"0 2px",lineHeight:1}} onClick={()=>moveRoom(i,1)} disabled={i===rooms.length-1} title="Move down">▼</button>
                    </div>
                  </div>
                ))}
                <button style={{...S.btn(false),marginTop:4,width:"100%",fontSize:11}} onClick={addRoom}>+ Add Room</button>
              </>
            ):(
              <>
                {currentItems.filter(it=>!findQuery||it.name.toLowerCase().includes(findQuery.toLowerCase())).map((item)=>{const i=currentItems.indexOf(item);return(
                  <div key={item.id} onClick={()=>{tab==="sprite"?setSelectedSprite(i):setSelectedTile(i);setSelectedFrame(0);setFindQuery("");}}
                    style={{padding:"3px 6px",background:i===selectedIdx?"#0f3460":"transparent",borderRadius:4,cursor:"pointer",fontSize:12,marginBottom:2,display:"flex",alignItems:"center",gap:6,border:i===selectedIdx?"1px solid #e94560":"1px solid transparent"}}>
                    <div style={{width:20,height:20,overflow:"hidden",flexShrink:0}}>
                      <MiniCanvas grid={item.frames[0]} palette={palette} size={20} />
                    </div>
                    <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</span>
                    {item.tileType&&item.tileType!=="walkable"&&<span style={{fontSize:9,color:TILE_TYPE_COLORS[item.tileType]||"#888",fontWeight:700}}>{item.tileType}</span>}
                    {item.frames?.length>1&&<span style={{color:"#888",fontSize:10}}>{item.frames.length}f</span>}
                  </div>
                );})}
                <div style={{display:"flex",gap:4,marginTop:4}}>
                  <button style={{...S.btn(false),flex:1,fontSize:11}} onClick={addItem}>+ Add</button>
                  <button style={{...S.btn(false),flex:1,fontSize:11}} onClick={deleteItem} disabled={currentItems.length<=1}>Del</button>
                </div>
              </>
            )}
          </div>

          {/* Tile + Sprite selectors for room mode */}
          {tab==="room"&&(
            <>
              <div style={S.section}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                  <div style={S.sectionTitle}>Tiles</div>
                  <span style={{fontSize:10,color:["place","erase","fill"].includes(roomTool)?"#e94560":"#444",fontWeight:600}}>
                    {["place","erase","fill"].includes(roomTool)?"▶ active":"click to select"}
                  </span>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                  {tiles.map((tile,i)=>(
                    <div key={tile.id} onClick={()=>{setSelectedTile(i);setRoomTool("place");}}
                      style={{border:i===selectedTile&&["place","fill"].includes(roomTool)?"2px solid #e94560":"2px solid #444",borderRadius:3,cursor:"pointer",position:"relative"}}
                      title={tile.name+(tile.tileType&&tile.tileType!=="walkable"?" ("+tile.tileType+")":"")}>
                      <MiniCanvas grid={tile.frames[0]} palette={palette} size={28} />
                      {tile.tileType&&tile.tileType!=="walkable"&&<div style={{position:"absolute",bottom:0,right:0,fontSize:7,background:TILE_TYPE_COLORS[tile.tileType],color:"#000",padding:"0 2px",fontWeight:700,borderRadius:"2px 0 0 0"}}>{tile.tileType[0]}</div>}
                    </div>
                  ))}
                </div>
              </div>
              <div style={S.section}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                  <div style={S.sectionTitle}>NPCs</div>
                  <span style={{fontSize:10,color:["npc","avatarStart"].includes(roomTool)?"#e94560":"#444",fontWeight:600}}>
                    {["npc","avatarStart"].includes(roomTool)?"▶ active":"click to select"}
                  </span>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                  {sprites.map((spr,i)=>(
                    <div key={spr.id}
                      onClick={()=>{setSelectedSprite(i);setRoomTool(i===0?"avatarStart":"npc");}}
                      style={{border:(i===selectedSprite&&["npc","avatarStart"].includes(roomTool))?"2px solid #e94560":"2px solid #444",borderRadius:3,cursor:"pointer",position:"relative"}}
                      title={i===0?"Avatar — click room to set start position":spr.name+" (NPC)"}>
                      <MiniCanvas grid={spr.frames[0]} palette={palette} size={28} />
                      {i===0&&<div style={{position:"absolute",bottom:0,right:0,fontSize:7,background:"#00ff78",color:"#000",padding:"0 2px",fontWeight:700,borderRadius:"2px 0 0 0"}}>A</div>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Asset Packs */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Asset Packs</div>
            {tab==="sprite"&&selectedSprite===0&&(
              <div style={{fontSize:10,color:"#29adff",background:"#082040",borderRadius:3,padding:"4px 6px",marginBottom:6,border:"1px solid #29adff"}}>
                Avatar selected — clicking a character sprite below will replace the avatar's pixels directly.
              </div>
            )}
            {ASSET_PACKS.map((pack,pi)=>(
              <div key={pi} style={{marginBottom:6}}>
                <button onClick={()=>setActivePack(activePack===pi?null:pi)}
                  style={{...S.btn(activePack===pi),width:"100%",textAlign:"left",marginBottom:2,fontSize:11}}>
                  {pack.name} {activePack===pi?"▲":"▼"}
                </button>
                {activePack===pi&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:3,padding:4,background:"#0d1b3e",borderRadius:4}}>
                    {pack.assets.map((asset,ai)=>(
                      <div key={ai} onClick={()=>addFromPack(asset)}
                        title={`Add ${asset.name} (${asset.itemType}${asset.tileType?", "+asset.tileType:""})`}
                        style={{cursor:"pointer",border:"1px solid #333",borderRadius:3,position:"relative",transition:"border .1s"}}
                        onMouseEnter={e=>e.currentTarget.style.border="1px solid #e94560"}
                        onMouseLeave={e=>e.currentTarget.style.border="1px solid #333"}>
                        <MiniCanvas grid={asset.grid} palette={palette} size={32} />
                        <div style={{fontSize:8,color:"#aaa",textAlign:"center",marginTop:1,maxWidth:32,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",padding:"0 2px"}}>{asset.name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Center Canvas */}
        <div style={S.center}>
          {tab==="tune"?(
            <div style={{width:"100%",maxWidth:640,padding:8}}>
              <div style={{fontWeight:700,color:"#e94560",marginBottom:12,fontSize:14}}>🎵 Background Tune</div>
              <TuneEditor tune={tune} onChange={setTune} volume={tuneVolume} onVolumeChange={setTuneVolume} savedTunes={savedTunes} onSaveTune={saveTune} onLoadTune={loadTune} />
              <div style={{marginTop:16,fontSize:11,color:"#555",lineHeight:1.8}}>
                The tune loops in the background while your game is playing. Save a tune and assign it to rooms in the <b style={{color:"#58a6ff"}}>🗺 Rooms</b> tab right panel.
              </div>
            </div>
          ):tab==="room"?(
            <>
            <RoomCanvas room={rooms[selectedRoom]||{tiles:[],npcs:[]}} tiles={tiles} sprites={sprites}
              palette={palette} roomW={roomW} roomH={roomH} tileW={tileW} tileH={tileH}
              onPlace={handleRoomPlace} roomTool={roomTool}
              selectedTileId={tiles[selectedTile]?.id} selectedSpriteId={sprites[selectedSprite]?.id}
              avatarStart={rooms[selectedRoom]?.avatarStart} />
            <div style={{marginTop:8,fontSize:11,color:"#484f58",background:"rgba(255,255,255,0.03)",borderRadius:4,padding:"3px 10px",border:"1px solid rgba(255,255,255,0.05)"}}>
              {rooms[selectedRoom]?.name||"room"} &nbsp;·&nbsp; {roomW}×{roomH} tiles &nbsp;·&nbsp; {tileW}×{tileH}px each
            </div>
            </>
          ):(tab!=="tune"&&(
            <>
              <PixelCanvas grid={currentFrame} palette={palette} onDraw={handleDraw} pixelSize={pixelSize} showGrid={showGrid} />
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:6}}>
                <button onClick={()=>setZoom(z=>Math.max(0.5,+(z-0.25).toFixed(2)))}
                  style={{...S.btn(false),padding:"2px 9px",fontSize:14,lineHeight:1,minWidth:28}}>−</button>
                <span style={{fontSize:11,color:"#64748b",minWidth:32,textAlign:"center"}}>{zoom}×</span>
                <button onClick={()=>setZoom(z=>Math.min(4,+(z+0.25).toFixed(2)))}
                  style={{...S.btn(false),padding:"2px 9px",fontSize:14,lineHeight:1,minWidth:28}}>+</button>
                <button onClick={()=>setZoom(1)} style={{...S.btn(false),padding:"2px 7px",fontSize:10,color:"#475569",marginLeft:2}}>reset</button>
                {currentItem&&<span style={{marginLeft:"auto",fontSize:11,color:"#475569"}}>{currentItem.name} · {itemW}×{itemH}px</span>}
              </div>
            </>
          ))}
        </div>

        {/* Right Panel */}
        <div style={S.rightPanel}>
          {tab==="room"&&rooms[selectedRoom]&&(
            <>
              <div style={S.section}>
                <div style={S.sectionTitle}>Room Name</div>
                <input value={rooms[selectedRoom].name} onChange={e=>setRooms(prev=>{const rs=[...prev];rs[selectedRoom]={...rs[selectedRoom],name:e.target.value};return rs;})} style={S.input} />
              </div>

              <div style={S.section}>
                <div style={S.sectionTitle}>Exits</div>
                {(rooms[selectedRoom].exits||[]).length===0?(
                  <div style={{fontSize:11,color:"#555",lineHeight:1.6}}>No exits yet. Use the 🚪 Exit tool, click a cell to add a portal.</div>
                ):(
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {(rooms[selectedRoom].exits||[]).map((ex,i)=>{
                      const destName=rooms[ex.destRoom]?.name||`room ${ex.destRoom}`;
                      const arr=rooms[ex.destRoom]?.avatarStart||{x:1,y:1};
                      return(
                        <div key={i} style={{background:"#0d1b3e",borderRadius:4,padding:"5px 8px",fontSize:11,border:"1px solid rgba(255,68,238,0.25)"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span style={{color:"#ff44ee",fontWeight:700}}>🚪 ({ex.x},{ex.y}){ex.twoWay?" ↔":"→"}</span>
                            <button style={{...S.btn(false),fontSize:9,padding:"1px 6px",color:"#e94560",borderColor:"rgba(233,69,96,0.3)"}}
                              onClick={()=>setRooms(prev=>{const rs=[...prev];rs[selectedRoom]={...rs[selectedRoom],exits:(rs[selectedRoom].exits||[]).filter((_,j)=>j!==i)};return rs;})}>✕</button>
                          </div>
                          <div style={{color:"#8b949e",marginTop:2}}>{destName} at ({arr.x},{arr.y})</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Inventory */}
              <div style={S.section}>
                <div style={S.sectionTitle}>Collectibles & Inventory</div>
                {sprites.filter(s=>s.tileType==="item").length===0?(
                  <div style={{fontSize:11,color:"#475569",lineHeight:1.6}}>No collectibles yet. In the Sprites tab, select a sprite and apply the <b style={{color:"#fbbf24"}}>⭐ Collectible</b> template or set its behavior to <b>item</b>.</div>
                ):(
                  sprites.filter(s=>s.tileType==="item").map(spr=>{
                    const placed=rooms.reduce((n,r)=>n+(r.npcs||[]).filter(nn=>nn.spriteId===spr.id).length,0);
                    const target=winConditions[spr.id]||0;
                    return(
                      <div key={spr.id} style={{background:"rgba(251,191,36,0.06)",border:"1px solid rgba(251,191,36,0.15)",borderRadius:7,padding:"8px 10px",marginBottom:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                          <MiniCanvas grid={spr.frames[0]} palette={palette} size={20}/>
                          <span style={{fontSize:12,color:"#fbbf24",fontWeight:700,flex:1}}>{spr.name}</span>
                          <span style={{fontSize:11,color:"#64748b"}}>{placed} placed</span>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:11,color:"#94a3b8",whiteSpace:"nowrap"}}>Win when</span>
                          <input type="number" min={0} max={99} value={target}
                            onChange={e=>setWinConditions(prev=>({...prev,[spr.id]:Math.max(0,+e.target.value)}))}
                            style={{...S.input,width:44,padding:"2px 6px",textAlign:"center",fontSize:12}}/>
                          <span style={{fontSize:11,color:"#64748b",whiteSpace:"nowrap"}}>{target===1?"collected":"collected"}</span>
                        </div>
                        {target>0&&placed<target&&<div style={{fontSize:10,color:"#f87171",marginTop:4}}>⚠ Only {placed}/{target} placed in rooms</div>}
                        {target>0&&placed>=target&&<div style={{fontSize:10,color:"#4ade80",marginTop:4}}>✓ Enough placed ({placed}/{target})</div>}
                        {target===0&&<div style={{fontSize:10,color:"#475569",marginTop:4}}>Set to 0 = no win requirement</div>}
                      </div>
                    );
                  })
                )}
              </div>

              <div style={S.section}>
                <div style={S.sectionTitle}>Background Tune</div>
                {savedTunes.length===0?(
                  <div style={{fontSize:11,color:"#555",lineHeight:1.6}}>No saved tunes yet.<br/>Go to the 🎵 Tune tab, compose a tune and click <b style={{color:"#7ee787"}}>💾 Save</b>.</div>
                ):(
                  <>
                    <select style={{...S.select,width:"100%",marginBottom:6}}
                      value={rooms[selectedRoom].tuneId||""}
                      onChange={e=>{const v=e.target.value;setRooms(prev=>{const rs=[...prev];rs[selectedRoom]={...rs[selectedRoom],tuneId:v||null};return rs;});}}>
                      <option value="">None (silent)</option>
                      {savedTunes.map(st=><option key={st.id} value={st.id}>{st.name}</option>)}
                    </select>
                    <div style={{fontSize:10,color:"#555"}}>This tune loops when the player enters this room.</div>
                  </>
                )}
              </div>

              <div style={S.section}>
                <div style={S.sectionTitle}>Legend</div>
                <div style={{fontSize:11,color:"#aaa",lineHeight:1.8}}>
                  {TILE_TYPES.map(t=>(
                    <div key={t} style={{color:TILE_TYPE_COLORS[t]||"#aaa"}}>
                      {t==="walkable"?"🟢":t==="wall"?"🔴":t==="item"?"🟡":"🔵"} {t}
                      {t==="wall"?" — blocks":t==="item"?" — collectible":t==="end"?" — win!":""}
                    </div>
                  ))}
                </div>
              </div>

              <div style={S.section}>
                <div style={S.sectionTitle}>Actions</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <button style={{...S.btn(false),fontSize:11}} onClick={()=>{
                    setRooms(prev=>{const rs=[...prev];rs[selectedRoom]={...rs[selectedRoom],tiles:emptyGrid(roomW,roomH).map(r=>r.map(()=>null)),npcs:[],exits:[]};return rs;});
                  }}>Clear Room</button>
                  <button style={{...S.btn(false),fontSize:11}} onClick={()=>exportRoomPng(rooms[selectedRoom])}>Export PNG</button>
                </div>
              </div>
            </>
          )}
          {tab!=="room"&&tab!=="tune"&&currentItem&&(
            <>
              <div style={S.section}>
                <div style={S.sectionTitle}>Name</div>
                <input value={currentItem.name} onChange={e=>renameItem(e.target.value)} style={S.input} />
              </div>

              {/* Set as Avatar — shown on any non-avatar sprite */}
              {tab==="sprite"&&selectedSprite===0&&(
                <div style={{background:"#0d1b3e",border:"1px solid #1a1a5e",borderRadius:4,padding:"6px 10px",marginBottom:12,fontSize:11,color:"#888"}}>
                  🧑 <b style={{color:"#e94560"}}>This is the Avatar</b> — the player character.<br/>
                  To set its look: select it here, then click any character sprite in an Asset Pack below to replace its pixels instantly.
                </div>
              )}
              {tab==="sprite"&&selectedSprite>0&&(
                <>
                  <div style={{marginBottom:8}}>
                    <button style={{...S.btn(false),width:"100%",fontSize:11,background:"#082040",borderColor:"#29adff",color:"#29adff"}}
                      onClick={()=>setAsAvatar(selectedSprite)}>
                      👤 Set as Avatar (replace player appearance)
                    </button>
                  </div>
                  {/* Quick-start templates */}
                  <div style={S.section}>
                    <div style={S.sectionTitle}>Quick Templates</div>
                    <div style={{display:"flex",flexDirection:"column",gap:3}}>
                      {[
                        {emoji:"💬",label:"NPC",     tileType:"walkable", dialog:"Hello there!\n---\nNice to meet you!",          name:"npc"},
                        {emoji:"⭐",label:"Collectible",tileType:"item",   dialog:"You picked it up!",                            name:"gem"},
                        {emoji:"🪧",label:"Sign",     tileType:"walkable", dialog:"→ This way",                                   name:"sign"},
                        {emoji:"🚪",label:"Ending",   tileType:"end",      dialog:"You did it! The adventure is complete.",       name:"door"},
                      ].map(({emoji,label,tileType,dialog,name})=>(
                        <button key={label} style={{...S.toolBtn(currentItem.tileType===tileType&&label!=="NPC"&&label!=="Sign"), justifyContent:"flex-start"}}
                          onClick={()=>{
                            setSprites(prev=>{
                              const ss=[...prev];
                              const cur=ss[selectedSprite];
                              ss[selectedSprite]={...cur, tileType,
                                dialog: cur.dialog?.trim() ? cur.dialog : dialog,
                                name: (cur.name==="avatar"||cur.name.startsWith("sprite_")||cur.name==="npc"||cur.name==="gem"||cur.name==="sign"||cur.name==="door") ? name : cur.name,
                              };
                              return ss;
                            });
                          }}>
                          <span style={{fontSize:13}}>{emoji}</span>
                          <span style={{flex:1,fontSize:11}}>{label}</span>
                        </button>
                      ))}
                    </div>
                    <div style={{fontSize:10,color:"#475569",marginTop:5}}>Sets behavior + starter dialog in one click</div>
                  </div>
                </>
              )}

              {/* Tile type (shown for both sprites and tiles) */}
              <div style={S.section}>
                <div style={S.sectionTitle}>Behavior Tag</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {TILE_TYPES.map(t=>(
                    <button key={t} onClick={()=>updateTileType(t)}
                      style={{...S.btn(currentTileType===t),fontSize:11,color:currentTileType===t?"#fff":TILE_TYPE_COLORS[t]||"#aaa",borderColor:TILE_TYPE_COLORS[t]||"#333"}}>
                      {t==="walkable"?"🟢":t==="wall"?"🔴":t==="item"?"🟡":"🔵"} {t}
                    </button>
                  ))}
                </div>
                <div style={{fontSize:10,color:"#666",marginTop:4}}>
                  🟢 walkable · 🔴 wall (blocks player) · 🟡 item (collect it!) · 🔵 end (win the game)
                </div>
              </div>

              {/* Dialog (sprites only) */}
              {tab==="sprite"&&(
                <div style={S.section}>
                  <div style={S.sectionTitle}>NPC Dialog</div>
                  <textarea value={currentItem.dialog||""} onChange={e=>updateDialog(e.target.value)}
                    placeholder="What does this character say? Separate pages with --- on its own line."
                    style={{...S.input,height:64,resize:"vertical",fontFamily:"inherit"}} />
                  <div style={{fontSize:10,color:"#666",marginTop:3}}>Separate pages with <code>---</code> · Sprite 0 is the player — dialog ignored.</div>
                </div>
              )}

              {/* Blip (sprites only, non-avatar) */}
              {tab==="sprite"&&selectedSprite>0&&(
                <div style={S.section}>
                  <div style={S.sectionTitle}>Blip Sound</div>
                  <div style={{display:"flex",gap:4,marginBottom:4,flexWrap:"wrap"}}>
                    {["square","sine","triangle","sawtooth"].map(w=>(
                      <button key={w} style={{...S.btn(currentItem.blip?.wave===w),fontSize:10}} onClick={()=>updateBlip("wave",w)}>{w}</button>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
                    <span style={{fontSize:11,color:"#aaa"}}>Pitch:</span>
                    <input type="range" min={110} max={1760} step={10} value={currentItem.blip?.freq||440}
                      onChange={e=>updateBlip("freq",+e.target.value)} style={{flex:1}} />
                    <span style={{fontSize:11,color:"#aaa",minWidth:36}}>{currentItem.blip?.freq||440}Hz</span>
                  </div>
                  <button style={{...S.btn(false),fontSize:10,width:"100%"}}
                    onClick={()=>playBlip(currentItem.blip?.wave||"square",currentItem.blip?.freq||440,0.15)}>
                    ▶ Preview Blip
                  </button>
                </div>
              )}

              {/* Frames */}
              <div style={S.section}>
                <div style={S.sectionTitle}>Animation Frames</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:6}}>
                  {currentItem.frames.map((frame,i)=>(
                    <div key={i} onClick={()=>setSelectedFrame(i)}
                      style={{...S.frameThumb(i===selectedFrame),position:"relative",width:40,height:40,overflow:"hidden"}}>
                      <MiniCanvas grid={frame} palette={palette} size={40} />
                      <div style={{position:"absolute",bottom:1,right:2,fontSize:8,color:"#e94560",fontWeight:700}}>{i+1}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {[["+ Frame",addFrame,currentItem.frames.length>=MAX_FRAMES],["Dup",duplicateFrame,currentItem.frames.length>=MAX_FRAMES],["Del",deleteFrame,currentItem.frames.length<=1]].map(([label,fn,disabled])=>(
                    <button key={label} style={{...S.btn(false),fontSize:11}} onClick={fn} disabled={disabled}>{label}</button>
                  ))}
                </div>
              </div>

              {/* Anim preview */}
              {currentItem.frames.length>1&&(
                <div style={S.section}>
                  <div style={S.sectionTitle}>Preview</div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <MiniCanvas grid={previewFrame} palette={palette} size={64} />
                    <button style={S.btn(playing)} onClick={()=>{setPlaying(!playing);setAnimFrame(0);}}>
                      {playing?"⏹ Stop":"▶ Play"}
                    </button>
                  </div>
                </div>
              )}

              {/* Transforms */}
              <div style={S.section}>
                <div style={S.sectionTitle}>Transform</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {[
                    ["Flip H",f=>f.map(r=>[...r].reverse())],
                    ["Flip V",f=>[...f].reverse().map(r=>[...r])],
                    ["Rot CW",f=>{const h=f.length,w=f[0].length;return Array.from({length:w},(_,x)=>Array.from({length:h},(_,y)=>f[h-1-y][x]));}],
                    ["Clear",()=>emptyGrid(itemW,itemH)],
                  ].map(([label,fn])=>(
                    <button key={label} style={{...S.btn(false),fontSize:11}} onClick={()=>{
                      const setItems=tab==="sprite"?setSprites:setTiles;
                      const idx=tab==="sprite"?selectedSprite:selectedTile;
                      setItems(prev=>{const items=[...prev];const item={...items[idx],frames:[...items[idx].frames]};item.frames[selectedFrame]=fn(item.frames[selectedFrame]);items[idx]=item;return items;});
                    }}>{label}</button>
                  ))}
                </div>
              </div>
            </>
          )}


          {/* Shortcuts */}
          <div style={{...S.section,marginTop:12}}>
            <div style={S.sectionTitle}>Shortcuts</div>
            <div style={{fontSize:10,color:"#555",lineHeight:1.8}}>
              D draw · E erase · F fill · G grid<br/>1–9 select color
            </div>
          </div>
        </div>
      </div>

      {showImport&&<PngImportModal onImport={handleImport} onClose={()=>setShowImport(false)} palette={palette} maxColors={MAX_COLORS} />}
      {showPlaytest&&<PlaytestModal rooms={rooms} startRoom={0} tiles={tiles} sprites={sprites}
        palette={palette} roomW={roomW} roomH={roomH} tileW={tileW} tileH={tileH} tune={tune}
        savedTunes={savedTunes} tuneVolume={tuneVolume} winConditions={winConditions} onClose={()=>setShowPlaytest(false)} />}
      {exportModal&&<ExportModal data={exportModal} onClose={()=>setExportModal(null)} />}
      {exitModal&&<ExitConfigModal rooms={rooms} currentRoom={selectedRoom} position={exitModal} onConfirm={confirmExit} onClose={()=>setExitModal(null)} tiles={tiles} palette={palette} roomW={roomW} roomH={roomH} tileW={tileW} tileH={tileH} />}
      {showHelp&&<HelpModal onClose={()=>setShowHelp(false)} />}
      {showBitsyImport&&<BitsyImportModal onImport={handleBitsyImport} onClose={()=>setShowBitsyImport(false)}
        gameTitle={gameTitle} palette={palette} sprites={sprites} tiles={tiles} rooms={rooms} tune={tune} />}
      {showWizard&&<WizardModal palette={palette} onComplete={handleWizardComplete} onSkip={()=>setShowWizard(false)} />}
      {showPrePlay&&<PrePlayModal sprites={sprites} tiles={tiles} rooms={rooms}
        onPlay={()=>{setShowPrePlay(false);setShowPlaytest(true);}}
        onClose={()=>setShowPrePlay(false)} />}
      {/* Build timestamp footer */}
      <div style={{position:"fixed",bottom:6,left:10,fontSize:10,color:"rgba(100,116,139,0.6)",pointerEvents:"none",userSelect:"none",zIndex:1}}>
        {(()=>{try{const d=new Date(__BUILD_TIME__);return"Updated "+d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})+" "+d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});}catch{return "";}})()}
      </div>
    </div>
  );
}
