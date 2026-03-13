import { useState, useRef, useCallback, useEffect } from "react";
import { FIREBASE_READY, signInWithGoogle, signOutUser, watchAuthState, saveGame, loadAllGames, deleteGame } from "./firebase";

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
const TILE_TYPE_COLORS = { walkable:"#00e436", wall:"#ff004d", item:"#ffec27", end:"#29adff" };
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
        [0,0,10,10,10,0,0,0],[0,0,10,10,10,0,0,0],[0,0,10,10,10,0,0,0],[0,0,6,6,6,0,0,0],
        [0,6,6,6,6,6,0,0],[0,0,6,6,6,0,0,0],[0,10,0,0,0,10,0,0],[0,10,0,0,0,10,0,0],
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
  app:{ fontFamily:"'Inter',system-ui,sans-serif", background:"#1a1a2e", color:"#e0e0e0", minHeight:"100vh", display:"flex", flexDirection:"column" },
  header:{ background:"#16213e", padding:"10px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"2px solid #0f3460", gap:12 },
  title:{ fontSize:20, fontWeight:700, color:"#e94560", letterSpacing:1, whiteSpace:"nowrap" },
  main:{ display:"flex", flex:1, overflow:"hidden" },
  sidebar:{ width:256, background:"#16213e", padding:12, overflowY:"auto", borderRight:"2px solid #0f3460", flexShrink:0 },
  center:{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:16, overflow:"auto" },
  centerRoom:{ flex:1, display:"flex", flexDirection:"column", alignItems:"stretch", justifyContent:"flex-start", overflow:"hidden", minWidth:0 },
  rightPanel:{ width:290, background:"#16213e", padding:12, overflowY:"auto", borderLeft:"2px solid #0f3460", flexShrink:0 },
  section:{ marginBottom:14 },
  sectionTitle:{ fontSize:11, fontWeight:700, textTransform:"uppercase", color:"#e94560", marginBottom:6, letterSpacing:0.5 },
  btn:(active)=>({ padding:"5px 10px", background:active?"#e94560":"#0f3460", color:active?"#fff":"#e0e0e0", border:active?"1px solid #e94560":"1px solid #1a1a5e", borderRadius:4, cursor:"pointer", fontSize:12, fontWeight:600, transition:"all .12s" }),
  btnGreen:{ padding:"5px 10px", background:"#008751", color:"#fff", border:"1px solid #00e436", borderRadius:4, cursor:"pointer", fontSize:12, fontWeight:600 },
  input:{ background:"#0d1b3e", border:"1px solid #1a1a5e", color:"#e0e0e0", borderRadius:4, padding:"4px 8px", fontSize:12, width:"100%", boxSizing:"border-box" },
  select:{ background:"#0d1b3e", border:"1px solid #1a1a5e", color:"#e0e0e0", borderRadius:4, padding:"4px 6px", fontSize:12 },
  tab:(active)=>({ padding:"7px 14px", background:active?"#e94560":"#0f3460", color:active?"#fff":"#aaa", border:"none", borderRadius:"4px 4px 0 0", cursor:"pointer", fontSize:13, fontWeight:600, marginRight:2 }),
  modal:{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 },
  modalContent:{ background:"#1a1a2e", border:"2px solid #0f3460", borderRadius:8, padding:24, maxWidth:520, width:"92%", maxHeight:"90vh", overflowY:"auto" },
  row:{ display:"flex", gap:8, alignItems:"center", marginBottom:8, flexWrap:"wrap" },
  label:{ fontSize:12, color:"#aaa", minWidth:56 },
  colorSwatch:(color,selected)=>({ width:26, height:26, background:color, border:selected?"3px solid #e94560":"2px solid #333", borderRadius:4, cursor:"pointer", display:"inline-block", margin:2, boxShadow:selected?"0 0 6px #e94560":"none" }),
  canvas:{ border:"2px solid #0f3460", borderRadius:4, cursor:"crosshair", imageRendering:"pixelated" },
  frameThumb:(active)=>({ border:active?"2px solid #e94560":"2px solid #444", borderRadius:4, cursor:"pointer", imageRendering:"pixelated", margin:2, background:"#111", display:"block" }),
};

// ─── Pixel Canvas ─────────────────────────────────────────────────────────────
function PixelCanvas({ grid, palette, onDraw, onStrokeEnd, pixelSize=20, showGrid:showG=true }) {
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
  const maxD=460, sc=Math.min(maxD/cw,maxD/ch,1);
  const dw=Math.floor(cw*(cw>maxD||ch>maxD?sc:1)), dh=Math.floor(ch*(cw>maxD||ch>maxD?sc:1));
  const endStroke=()=>{ if(drawing.current){drawing.current=false;lastPos.current=null;onStrokeEnd?.();} };
  return <canvas ref={ref} width={cw} height={ch} style={{...S.canvas,width:dw,height:dh}}
    onMouseDown={e=>{drawing.current=true;lastPos.current=null;handle(e,true);}}
    onMouseMove={e=>handle(e)} onMouseUp={endStroke} onMouseLeave={endStroke} />;
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
function RoomCanvas({ room, tiles, sprites, palette, roomW, roomH, tileW, tileH, onPlace, onStrokeEnd, roomTool, selectedTileId, selectedSpriteId, zoom=1 }) {
  const ref = useRef(null);
  const dragging = useRef(false);
  const basePs = Math.max(2, Math.floor(440/Math.max(roomW*tileW,roomH*tileH)));
  const ps = Math.max(1, Math.round(basePs * zoom));

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
    // Grid
    ctx.strokeStyle="rgba(255,255,255,0.08)";
    for(let rx=0;rx<=roomW;rx++){ctx.beginPath();ctx.moveTo(rx*tileW*ps,0);ctx.lineTo(rx*tileW*ps,ch);ctx.stroke();}
    for(let ry=0;ry<=roomH;ry++){ctx.beginPath();ctx.moveTo(0,ry*tileH*ps);ctx.lineTo(cw,ry*tileH*ps);ctx.stroke();}
  },[room,tiles,sprites,palette,roomW,roomH,tileW,tileH,ps]);

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
    if(rx>=0&&rx<roomW&&ry>=0&&ry<roomH) onPlace(rx,ry);
  };
  const cw=roomW*tileW*ps, ch=roomH*tileH*ps;
  return (
    <div style={{ overflow:"auto", maxWidth:"100%", maxHeight:"65vh", border:"2px solid #0f3460", borderRadius:4, background:palette[0]||"#000" }}>
      <canvas ref={ref} style={{ ...S.canvas, border:"none", borderRadius:0, width:cw, height:ch, cursor:"pointer", display:"block" }}
        onMouseDown={e=>{dragging.current=true;handle(e,true);}} onMouseMove={e=>handle(e)}
        onMouseUp={()=>{if(dragging.current){dragging.current=false;onStrokeEnd?.();}}}
        onMouseLeave={()=>{if(dragging.current){dragging.current=false;onStrokeEnd?.();}}} />
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
function ExitConfigModal({ rooms, currentRoom, position, onConfirm, onClose }) {
  const firstOther = rooms.findIndex((_,i)=>i!==currentRoom);
  const [destRoom, setDestRoom] = useState(firstOther>=0?firstOther:0);
  const [destX, setDestX] = useState(4);
  const [destY, setDestY] = useState(4);
  return (
    <div style={S.modal} onClick={onClose}>
      <div style={{...S.modalContent,maxWidth:340}} onClick={e=>e.stopPropagation()}>
        <h3 style={{margin:"0 0 12px",color:"#e94560"}}>🚪 Configure Exit</h3>
        <p style={{fontSize:12,color:"#aaa",margin:"0 0 12px"}}>Exit at ({position.x},{position.y}) teleports player to:</p>
        <div style={S.row}>
          <span style={S.label}>Destination:</span>
          <select style={S.select} value={destRoom} onChange={e=>setDestRoom(+e.target.value)}>
            {rooms.map((r,i)=><option key={i} value={i}>{i}: {r.name}{i===currentRoom?" (same)":""}</option>)}
          </select>
        </div>
        <div style={S.row}>
          <span style={S.label}>Arrive X:</span>
          <input type="number" min={0} max={31} value={destX} onChange={e=>setDestX(+e.target.value||0)} style={{...S.input,width:54}} />
          <span style={S.label}>Y:</span>
          <input type="number" min={0} max={31} value={destY} onChange={e=>setDestY(+e.target.value||0)} style={{...S.input,width:54}} />
        </div>
        <div style={{display:"flex",gap:8,marginTop:14}}>
          <button style={{...S.btn(true),flex:1}} onClick={()=>onConfirm({x:position.x,y:position.y,destRoom,destX,destY})}>✓ Add Exit</button>
          <button style={{...S.btn(false),flex:1}} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Tune Editor ──────────────────────────────────────────────────────────────
function TuneEditor({ tune, onChange }) {
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(160);
  const [activeStep, setActiveStep] = useState(-1);
  const ivRef = useRef(null);
  const stepRef = useRef(0);

  const toggle = (si, semi) => {
    onChange(tune.map((s,i)=> i===si ? (s.active&&s.semi===semi?{semi:0,active:false}:{semi,active:true}) : s));
  };

  const startPlay = () => {
    setPlaying(true); stepRef.current=0;
    ivRef.current = setInterval(()=>{
      const s=stepRef.current;
      const note=tune[s];
      if(note?.active) playBlip("square",noteFreq(note.semi),0.08,0.25);
      setActiveStep(s);
      stepRef.current=(s+1)%TUNE_STEPS;
    }, Math.round(60000/bpm/4));
  };
  const stopPlay = ()=>{ setPlaying(false); setActiveStep(-1); clearInterval(ivRef.current); };
  useEffect(()=>()=>clearInterval(ivRef.current),[]);

  // Show 2 octaves (C4–B5), top = high
  const ROWS = 24;
  return (
    <div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
        <button style={S.btn(playing)} onClick={playing?stopPlay:startPlay}>{playing?"⏹ Stop":"▶ Play"}</button>
        <span style={{fontSize:11,color:"#aaa"}}>BPM:</span>
        <input type="range" min={60} max={240} value={bpm} onChange={e=>setBpm(+e.target.value)} style={{width:70}} />
        <span style={{fontSize:11}}>{bpm}</span>
        <button style={{...S.btn(false),fontSize:10,marginLeft:"auto"}} onClick={()=>onChange(tune.map(()=>({semi:0,active:false})))}>Clear</button>
      </div>
      <div style={{overflowX:"auto",overflowY:"auto",maxHeight:220,border:"1px solid #0f3460",borderRadius:4}}>
        <div style={{display:"grid",gridTemplateColumns:`40px repeat(${TUNE_STEPS},1fr)`,gap:1,minWidth:440}}>
          {Array.from({length:ROWS},(_,ri)=>{
            const semi=ROWS-1-ri+12; // C4(12 semitones above C3) to B5
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
      <div style={{fontSize:10,color:"#555",marginTop:5}}>Click cells to place notes · Each column = one 16th note step</div>
    </div>
  );
}

// ─── Playtest Modal ───────────────────────────────────────────────────────────
function PlaytestModal({ rooms, startRoom=0, tiles, sprites, palette, roomW, roomH, tileW, tileH, tune, onClose }) {
  const findStart = (r) => {
    if(!r)return{x:1,y:1};
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
  const [collected,setCollected]=useState([]);
  const [dialog,setDialog]=useState(null); // {pages,pageIdx,name}
  const [won,setWon]=useState(false);
  const [removedItems,setRemovedItems]=useState([]); // "roomIdx,x,y"
  const [showInv,setShowInv]=useState(false);
  const canvasRef=useRef(null);
  const tuneRef=useRef(null);
  const tuneStep=useRef(0);
  const ps=Math.max(3,Math.floor(400/Math.max(roomW*tileW,roomH*tileH)));
  const playerSpr=sprites[0];

  // Background tune playback
  useEffect(()=>{
    if(!tune)return;
    const active=tune.filter(s=>s.active);
    if(!active.length)return;
    let s=0;
    tuneRef.current=setInterval(()=>{
      const note=tune[s];
      if(note?.active) playBlip("sine",noteFreq(note.semi),0.12,0.08);
      s=(s+1)%TUNE_STEPS;
    },170);
    return()=>clearInterval(tuneRef.current);
  },[tune]);

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
    // NPCs
    (room.npcs||[]).forEach(npc=>{
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
  },[room,tiles,sprites,palette,roomW,roomH,tileW,tileH,ps,pos,playerSpr,removedItems]);

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
      // Check exits
      const exit=(room.exits||[]).find(ex=>ex.x===nx&&ex.y===ny);
      if(exit){
        setRoomIdx(exit.destRoom);
        setPos({x:exit.destX,y:exit.destY});
        playBlip("sine",660,0.18,0.2);
        return;
      }
      // Check NPC
      const npc=(room.npcs||[]).find(n=>n.x===nx&&n.y===ny);
      if(npc){
        const spr=sprites.find(s=>s.id===npc.spriteId);
        if(spr?.dialog){
          const pages=spr.dialog.split(/\n?---\n?/).map(p=>p.trim()).filter(Boolean);
          setDialog({pages:pages.length?pages:[spr.dialog],pageIdx:0,name:spr.name});
          const w=spr.blip?.wave||"square", f=spr.blip?.freq||440;
          playBlip(w,f,0.1,0.2);
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
          playBlip("triangle",880,0.2,0.3);
        }
      }
      if(tt==="end")setWon(true);
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[pos,dialog,won,room,roomIdx,tiles,sprites,roomW,roomH,removedItems]);

  const cw=roomW*tileW*ps, ch=roomH*tileH*ps;
  const maxD=400, sc=Math.min(maxD/cw,maxD/ch,1);
  const restart=()=>{ setRoomIdx(0);setPos(findStart(rooms[0]));setCollected([]);setRemovedItems([]);setWon(false);setDialog(null);setShowInv(false); };

  return (
    <div style={S.modal}>
      <div style={{...S.modalContent,maxWidth:560}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <h3 style={{margin:0,color:"#e94560"}}>▶ Playtest</h3>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <span style={{fontSize:11,color:"#888",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rooms[roomIdx]?.name}</span>
            <button style={{...S.btn(showInv),fontSize:11}} onClick={()=>setShowInv(v=>!v)}>🎒 {collected.length}</button>
            <button style={S.btn(false)} onClick={onClose}>✕</button>
          </div>
        </div>
        {won ? (
          <div style={{textAlign:"center",padding:32}}>
            <div style={{fontSize:40,marginBottom:12}}>🎉</div>
            <div style={{fontSize:22,color:"#ffec27",fontWeight:700,marginBottom:8}}>You Win!</div>
            <div style={{color:"#aaa",marginBottom:16}}>Items collected: {collected.length}</div>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <button style={S.btn(true)} onClick={restart}>↺ Play Again</button>
              <button style={S.btn(false)} onClick={onClose}>Back to Editor</button>
            </div>
          </div>
        ) : (
          <>
            <canvas ref={canvasRef} style={{...S.canvas,display:"block",margin:"0 auto",width:cw*sc,height:ch*sc}} />
            {dialog && (
              <div style={{background:"#0f3460",border:"1px solid #e94560",borderRadius:6,padding:12,marginTop:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <div style={{color:"#e94560",fontSize:11,fontWeight:700}}>{dialog.name}</div>
                  {dialog.pages.length>1&&<div style={{fontSize:10,color:"#888"}}>{dialog.pageIdx+1}/{dialog.pages.length}</div>}
                </div>
                <div style={{fontSize:14,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{dialog.pages[dialog.pageIdx]}</div>
                <div style={{fontSize:11,color:"#555",marginTop:6}}>{dialog.pageIdx<dialog.pages.length-1?"Space / ↵ to continue →":"Space / ↵ to close"}</div>
              </div>
            )}
            {showInv&&(
              <div style={{background:"#0d1b3e",border:"1px solid #0f3460",borderRadius:6,padding:10,marginTop:8}}>
                <div style={{fontSize:11,fontWeight:700,color:"#ffec27",marginBottom:5}}>🎒 Inventory</div>
                {collected.length===0?<div style={{fontSize:11,color:"#555"}}>Nothing yet.</div>:(
                  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                    {collected.map((it,i)=><span key={i} style={{background:"#1a1a2e",border:"1px solid #333",borderRadius:4,padding:"2px 8px",fontSize:12,color:"#ffec27"}}>{it.name}</span>)}
                  </div>
                )}
              </div>
            )}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:10,fontSize:11,color:"#555",flexWrap:"wrap",gap:4}}>
              <span>Arrow keys to move · NPCs talk · 🌸 = exit portal</span>
              <span>Rooms: {roomIdx+1}/{rooms.length}</span>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:8}}>
              <button style={S.btn(false)} onClick={restart}>↺ Restart</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Bitsy File Import ────────────────────────────────────────────────────────
function parsePixelFrame(rows, drawFormat) {
  return rows.map(row => {
    if (drawFormat === 1) return row.split(',').map(v => parseInt(v.trim()) || 0);
    return row.split('').map(c => c === '1' ? 1 : 0);
  });
}

function parseBitsyData(text) {
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  let i = 0;
  let roomFormat = 0, drawFormat = 0;
  let gameTitle = '';
  const palettes = {}, roomDefs = {}, tileDefs = {}, sprDefs = {}, itmDefs = {}, dlgDefs = {}, endDefs = {};

  const skipBlanks = () => { while(i < lines.length && lines[i].trim() === '') i++; };
  const readBlock = () => { const b=[]; while(i < lines.length && lines[i].trim() !== '') b.push(lines[i++]); return b; };

  // Title: first non-empty, non-directive, non-section line
  skipBlanks();
  if (i < lines.length && !lines[i].startsWith('!') && !/^[A-Z]{2,}\s/.test(lines[i]) && !/^[A-Z]{2,}$/.test(lines[i].trim())) {
    gameTitle = lines[i].trim(); i++;
  }

  while (i < lines.length) {
    skipBlanks(); if (i >= lines.length) break;
    const line = lines[i].trim();
    if (line.startsWith('!')) {
      const m = line.match(/^!\s*(\w+)\s+(.*)/);
      if (m) { if(m[1]==='ROOM_FORMAT') roomFormat=parseInt(m[2]); else if(m[1]==='DRAW_FORMAT') drawFormat=parseInt(m[2]); }
      i++; continue;
    }
    if (line.startsWith('PAL ')) {
      const id = line.slice(4).trim(); i++;
      const colors=[];
      while(i<lines.length && lines[i].trim()!=='') { const rgb=lines[i].trim().split(',').map(Number); if(rgb.length>=3)colors.push({r:rgb[0],g:rgb[1],b:rgb[2]}); i++; }
      palettes[id]=colors; continue;
    }
    if (line.startsWith('ROOM ')) {
      const id=line.slice(5).trim(); i++;
      const room={id,name:'',tiles:[],items:[],ends:[],exits:[],palId:'0'};
      while(i<lines.length && lines[i].trim()!=='') {
        const rline=lines[i].trim();
        if(rline.startsWith('ITM ')&&rline.match(/^ITM\s+\S+\s+\d+,\d+/)){const m=rline.match(/^ITM\s+(\S+)\s+(\d+),(\d+)/);if(m)room.items.push({itmId:m[1],x:+m[2],y:+m[3]});i++;}
        else if(rline.startsWith('END ')&&rline.match(/^END\s+\S+\s+\d+,\d+/)){const m=rline.match(/^END\s+(\S+)\s+(\d+),(\d+)/);if(m)room.ends.push({endId:m[1],x:+m[2],y:+m[3]});i++;}
        else if(rline.startsWith('EXT ')){const m=rline.match(/^EXT\s+(\d+),(\d+)\s+(\S+)\s+(\d+),(\d+)/);if(m)room.exits.push({x:+m[1],y:+m[2],destRoom:m[3],destX:+m[4],destY:+m[5]});i++;}
        else if(rline.startsWith('NAME ')){room.name=rline.slice(5);i++;}
        else if(rline.startsWith('PAL ')){room.palId=rline.slice(4).trim();i++;}
        else if(rline.startsWith('ENS ')||rline.startsWith('TUT ')){i++;} // skip unsupported
        else { room.tiles.push(roomFormat===1?rline.split(',').map(s=>s.trim()):rline.split('')); i++; }
      }
      roomDefs[id]=room; continue;
    }
    // Helper: parse a pixel+properties block (TIL / SPR / ITM definition)
    const parseDrawBlock=(defId, kind)=>{
      i++;
      const frames=[]; let rows=[];
      const props={name:'',wal:false,col:kind==='SPR'?2:kind==='ITM'?2:1,dlgId:null,pos:null};
      while(i<lines.length && lines[i].trim()!=='') {
        const r=lines[i].trim();
        if(r==='>'){frames.push(rows);rows=[];i++;}
        else if(/^(NAME|WAL|COL|DLG|POS|BGC|BLIP)\s/.test(r)||/^(WAL|COL|DLG|POS|BGC|BLIP|NAME)$/.test(r)){
          if(r.startsWith('NAME '))props.name=r.slice(5);
          else if(r==='WAL true')props.wal=true;
          else if(r.startsWith('COL '))props.col=+r.slice(4);
          else if(r.startsWith('DLG '))props.dlgId=r.slice(4).trim();
          else if(r.startsWith('POS ')){const m=r.match(/^POS\s+(\S+)\s+(\d+),(\d+)/);if(m)props.pos={room:m[1],x:+m[2],y:+m[3]};}
          i++;
        } else { rows.push(r); i++; }
      }
      if(rows.length>0)frames.push(rows);
      return {id:defId,frames:frames.map(f=>parsePixelFrame(f,drawFormat)),...props};
    };
    if(line.startsWith('TIL ')){const d=parseDrawBlock(line.slice(4).trim(),'TIL');tileDefs[d.id]=d;continue;}
    if(line.startsWith('SPR ')){const d=parseDrawBlock(line.slice(4).trim(),'SPR');sprDefs[d.id]=d;continue;}
    if(line.startsWith('ITM ')&&!line.match(/^ITM\s+\S+\s+\d+,\d+/)){const d=parseDrawBlock(line.slice(4).trim(),'ITM');itmDefs[d.id]=d;continue;}
    if(line.startsWith('DLG ')){const id=line.slice(4).trim();i++;const txt=[];while(i<lines.length&&lines[i].trim()!=='')txt.push(lines[i++]);dlgDefs[id]=txt.join('\n');continue;}
    if(line.startsWith('END ')&&!line.match(/^END\s+\S+\s+\d+,\d+/)){const id=line.slice(4).trim();i++;const txt=[];while(i<lines.length&&lines[i].trim()!=='')txt.push(lines[i++]);endDefs[id]=txt.join('\n');continue;}
    i++; // skip unrecognized lines
  }

  // Build palette
  const palData=palettes['0']||[{r:0,g:0,b:0},{r:255,g:255,b:255},{r:255,g:0,b:77}];
  const palette=Array.from({length:MAX_COLORS},(_,ci)=>ci<palData.length?rgbToHex(palData[ci].r,palData[ci].g,palData[ci].b):DEFAULT_PALETTE[ci]||'#000000');

  // Build tiles
  const newTiles=[];
  const tileBitsyToId={}, itmBitsyToId={}, endBitsyToId={};
  Object.values(tileDefs).forEach(t=>{const id=uid();tileBitsyToId[t.id]=id;newTiles.push({id,name:t.name||`tile_${t.id}`,frames:t.frames.length?t.frames:[emptyGrid(8,8)],tileType:t.wal?'wall':'walkable'});});
  Object.values(itmDefs).forEach(t=>{const id=uid();itmBitsyToId[t.id]=id;newTiles.push({id,name:t.name||`item_${t.id}`,frames:t.frames.length?t.frames:[emptyGrid(8,8)],tileType:'item'});});
  Object.keys(endDefs).forEach(endId=>{const id=uid();endBitsyToId[endId]=id;const f=emptyGrid(8,8);for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(y===0||y===7||x===0||x===7)f[y][x]=2;newTiles.push({id,name:`end_${endId}`,frames:[f],tileType:'end'});});

  // Build sprites
  const newSprites=[];
  const sprBitsyToIdx={};
  const avatar=sprDefs['A'];
  newSprites.push({id:uid(),name:avatar?.name||'avatar',frames:avatar?.frames?.length?avatar.frames:[emptyGrid(8,8)],tileType:'walkable',dialog:'',blip:{wave:'square',freq:440}});
  sprBitsyToIdx['A']=0;
  Object.entries(sprDefs).forEach(([sid,spr])=>{
    if(sid==='A')return;
    const idx=newSprites.length; sprBitsyToIdx[sid]=idx;
    newSprites.push({id:uid(),name:spr.name||`sprite_${sid}`,frames:spr.frames.length?spr.frames:[emptyGrid(8,8)],tileType:'walkable',dialog:spr.dlgId?dlgDefs[spr.dlgId]||'':'',blip:{wave:'square',freq:440}});
  });

  // Build rooms
  const newRooms=[];
  const roomBitsyToIdx={};
  Object.entries(roomDefs).forEach(([rid,room],idx)=>{
    roomBitsyToIdx[rid]=idx;
    const tileGrid=room.tiles.map(row=>row.map(bId=>{if(!bId||bId==='0'||bId==='')return null;return tileBitsyToId[bId]||null;}));
    room.items.forEach(itm=>{if(tileGrid[itm.y]&&itm.x<(tileGrid[itm.y]?.length||0)){const id=itmBitsyToId[itm.itmId];if(id)tileGrid[itm.y][itm.x]=id;}});
    room.ends.forEach(end=>{if(tileGrid[end.y]&&end.x<(tileGrid[end.y]?.length||0)){const id=endBitsyToId[end.endId];if(id)tileGrid[end.y][end.x]=id;}});
    const npcs=[];
    Object.entries(sprDefs).forEach(([sid,spr])=>{if(sid==='A')return;if(spr.pos&&spr.pos.room===rid){const idx2=sprBitsyToIdx[sid];if(idx2!==undefined)npcs.push({spriteId:newSprites[idx2].id,x:spr.pos.x,y:spr.pos.y});}});
    newRooms.push({id:uid(),name:room.name||`room ${idx}`,tiles:tileGrid,npcs,exits:[]});
  });
  // Fix exits
  Object.entries(roomDefs).forEach(([rid,room])=>{
    const idx=roomBitsyToIdx[rid];if(idx===undefined)return;
    newRooms[idx].exits=room.exits.map(ex=>({x:ex.x,y:ex.y,destRoom:roomBitsyToIdx[ex.destRoom]??0,destX:ex.destX,destY:ex.destY}));
  });

  const firstRoom=Object.values(roomDefs)[0];
  const detectedRoomW=firstRoom?.tiles?.[0]?.length||16;
  const detectedRoomH=firstRoom?.tiles?.length||16;
  const detectedTileW=Object.values(tileDefs)[0]?.frames?.[0]?.[0]?.length||Object.values(sprDefs)[0]?.frames?.[0]?.[0]?.length||8;
  const detectedTileH=Object.values(tileDefs)[0]?.frames?.[0]?.length||Object.values(sprDefs)[0]?.frames?.[0]?.length||8;

  return {
    gameTitle:gameTitle||'Imported Game',
    palette,
    sprites:newSprites.length?newSprites:[{id:uid(),name:'avatar',frames:[emptyGrid(8,8)],tileType:'walkable',dialog:'',blip:{wave:'square',freq:440}}],
    tiles:newTiles.length?newTiles:[{id:uid(),name:'wall',frames:[emptyGrid(8,8)],tileType:'wall'}],
    rooms:newRooms.length?newRooms:[{id:uid(),name:'room 0',tiles:emptyGrid(16,16).map(r=>r.map(()=>null)),npcs:[],exits:[]}],
    roomW:detectedRoomW, roomH:detectedRoomH, tileW:detectedTileW, tileH:detectedTileH
  };
}

// ─── Export Bitsy Data ────────────────────────────────────────────────────────
// Convert a pixel color-index to standard Bitsy binary: 0 = background, 1 = foreground
const bitsyPixel = v => (Number.isFinite(v) && v !== 0) ? 1 : 0;

// Render one animation frame as standard Bitsy binary rows ("0"/"1" chars)
function bitsyFrameRows(frame) {
  return frame.map(row => row.map(bitsyPixel).join("")).join("\n");
}

// Render one animation frame as bitsy-color comma-separated integer rows
function bitsyColorFrameRows(frame) {
  return frame.map(row => row.map(v => Number.isFinite(v) ? v : 0).join(",")).join("\n");
}

function exportBitsyData(gameTitle, palette, sprites, tiles, rooms, tune, colorMode=false) {
  const frameRowsFn = colorMode ? bitsyColorFrameRows : bitsyFrameRows;
  let out = `${gameTitle || "My Game"}\n\n`;

  // Version directives
  out += `! VER_MAJ 8\n! VER_MIN 12\n! ROOM_FORMAT 1\n! DLG_COMPAT 0\n! TXT_MODE 0\n`;
  if (colorMode) out += `! DRAW_FORMAT 1\n`;
  out += `\n`;

  // ── Separate tiles by type ───────────────────────────────────────────────
  const regularTiles = tiles.filter(t => t.tileType !== "item" && t.tileType !== "end");
  const itemTiles = tiles.filter(t => t.tileType === "item");
  const endTiles = tiles.filter(t => t.tileType === "end");

  // Build ID maps: internal tile.id → Bitsy text ID
  const tileIdMap = new Map();
  regularTiles.forEach((tile, i) => tileIdMap.set(tile.id, String.fromCharCode(97 + i)));
  const itemIdMap = new Map();
  itemTiles.forEach((tile, i) => itemIdMap.set(tile.id, String(i)));
  const endIdMap = new Map();
  endTiles.forEach((tile, i) => endIdMap.set(tile.id, `end_${i}`));

  // ── PAL ────────────────────────────────────────────────────────────────────
  // In color mode: output all palette colors used; in standard mode: 3 colors
  out += `PAL 0\n`;
  const palCount = colorMode ? palette.length : Math.min(3, palette.length);
  for (let i = 0; i < palCount; i++) {
    const c = hexToRgb(palette[i] || (i === 0 ? "#000000" : "#ffffff"));
    out += `${c.r},${c.g},${c.b}\n`;
  }
  out += `\n`;

  // ── ROOM ─────────────────────────────────────────────────────────────────
  rooms.forEach((room, ri) => {
    out += `ROOM ${ri}\n`;
    // Tile grid — regular tiles only; items/ends get "0" (empty)
    (room.tiles || []).forEach(row => {
      out += row.map(id => {
        if (!id) return "0";
        if (tileIdMap.has(id)) return tileIdMap.get(id);
        return "0";
      }).join(",") + "\n";
    });
    // ITM placements for item tiles
    (room.tiles || []).forEach((row, ry) => {
      row.forEach((id, rx) => {
        if (id && itemIdMap.has(id)) out += `ITM ${itemIdMap.get(id)} ${rx},${ry}\n`;
      });
    });
    // END placements (v7+ spec: END endingId x,y directly in ROOM block)
    (room.tiles || []).forEach((row, ry) => {
      row.forEach((id, rx) => {
        if (id && endIdMap.has(id)) {
          const endIdx = endTiles.findIndex(t => t.id === id);
          if (endIdx >= 0) out += `END ${endIdx} ${rx},${ry}\n`;
        }
      });
    });
    // Exits: EXT x,y destRoom destX,destY
    (room.exits||[]).forEach(ex => {
      out += `EXT ${ex.x},${ex.y} ${ex.destRoom} ${ex.destX},${ex.destY}\n`;
    });
    if (room.name) out += `NAME ${room.name}\n`;
    out += `PAL 0\n\n`;
  });

  // ── TIL (regular tiles — walkable/wall) ────────────────────────────────
  regularTiles.forEach((tile, i) => {
    const id = String.fromCharCode(97 + i);
    out += `TIL ${id}\n`;
    tile.frames.forEach((frame, fi) => {
      out += frameRowsFn(frame) + "\n";
      if (fi < tile.frames.length - 1) out += ">\n";
    });
    if (tile.name) out += `NAME ${tile.name}\n`;
    if (tile.tileType === "wall") out += `WAL true\n`;
    if (colorMode) out += `COL 1\n`;
    out += `\n`;
  });

  // ── SPR (avatar + NPCs) ─────────────────────────────────────────────────
  let dlgIndex = 0;
  sprites.forEach((spr, i) => {
    const sprId = i === 0 ? "A" : String.fromCharCode(97 + (i - 1));
    out += `SPR ${sprId}\n`;
    spr.frames.forEach((frame, fi) => {
      out += frameRowsFn(frame) + "\n";
      if (fi < spr.frames.length - 1) out += ">\n";
    });
    if (spr.name) out += `NAME ${spr.name}\n`;
    if (i > 0 && spr.dialog) { out += `DLG ${dlgIndex}\n`; dlgIndex++; }
    // Position: find actual room placement or fall back to defaults
    let posRoom = 0, posX = i === 0 ? 4 : (i * 2) % 14, posY = i === 0 ? 4 : 2;
    for (let ri = 0; ri < rooms.length; ri++) {
      const placed = (rooms[ri].npcs || []).find(n => n.spriteId === spr.id);
      if (placed) { posRoom = ri; posX = placed.x; posY = placed.y; break; }
    }
    out += `POS ${posRoom} ${posX},${posY}\n`;
    if (colorMode) out += `COL 2\n`;
    out += `\n`;
  });

  // ── ITM (from "item" tiles) ──────────────────────────────────────────────
  itemTiles.forEach((tile, i) => {
    out += `ITM ${i}\n`;
    tile.frames.forEach((frame, fi) => {
      out += frameRowsFn(frame) + "\n";
      if (fi < tile.frames.length - 1) out += ">\n";
    });
    if (tile.name) out += `NAME ${tile.name}\n`;
    if (colorMode) out += `COL 2\n`;
    out += `\n`;
  });

  // ── DLG (NPC dialogs) ───────────────────────────────────────────────────
  let dlgOut = 0;
  sprites.forEach((spr, i) => {
    if (i > 0 && spr.dialog) {
      out += `DLG ${dlgOut}\n${spr.dialog}\n\n`;
      dlgOut++;
    }
  });

  // ── END (ending screens) ────────────────────────────────────────────────
  endTiles.forEach((tile, i) => {
    out += `END ${i}\nYou reached the ${tile.name || "end"}!\n\n`;
  });

  // ── TUNE (if any steps active) ──────────────────────────────────────────
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

// ─── HTML Game Export ─────────────────────────────────────────────────────────
function buildHtmlExport(gameTitle, palette, sprites, tiles, rooms, tune, tileW, tileH, roomW, roomH) {
  const stateJson = JSON.stringify({gameTitle,palette,sprites,tiles,rooms,tune,tileW,tileH,roomW,roomH}).replace(/<\/script>/gi,'<\\/script>');
  const engine = `(function(){
var S=${stateJson};
var pal=S.palette,sprs=S.sprites,tls=S.tiles,rms=S.rooms,tn=S.tune;
var TW=S.tileW,TH=S.tileH,RW=S.roomW,RH=S.roomH;
var cv=document.getElementById('game'),ctx=cv.getContext('2d');
var PS=Math.max(2,Math.floor(Math.min(window.innerWidth*.95,window.innerHeight*.9)/Math.max(RW*TW,RH*TH)));
cv.width=RW*TW*PS;cv.height=RH*TH*PS;
cv.style.cssText='image-rendering:pixelated;image-rendering:crisp-edges;display:block;';
var ri=0,pos={x:4,y:4},collected=[],removed={},dlg=null,won=false,wonTxt='',tick=0;
function findStart(rm){if(!rm)return{x:1,y:1};for(var ry=0;ry<RH;ry++)for(var rx=0;rx<RW;rx++){var t=tls.find(function(t){return t.id===(rm.tiles[ry]&&rm.tiles[ry][rx]);});if(!t||t.tileType!=='wall')return{x:rx,y:ry};}return{x:1,y:1};}
pos=findStart(rms[0]);
var ac=null;
function getAC(){if(!ac)ac=new(window.AudioContext||window.webkitAudioContext)();return ac;}
function blip(w,f,d,v){try{var a=getAC(),o=a.createOscillator(),g=a.createGain();o.type=w||'square';o.frequency.value=f||440;g.gain.value=v||0.15;g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+(d||0.15));o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+(d||0.15));}catch(e){}}
function nf(s){return 130.81*Math.pow(2,s/12);}
var ts2=0,tsi=null;
function startTune(){if(!tn||!tn.some(function(s){return s.active;}))return;tsi=setInterval(function(){var n=tn[ts2];if(n&&n.active)blip('sine',nf(n.semi),0.12,0.08);ts2=(ts2+1)%tn.length;},170);}
startTune();
function frame(item){var f=item.frames;return f&&f[tick%(f.length||1)]||f&&f[0]||null;}
function drawSprite(f,cx,cy){if(!f)return;for(var py=0;py<TH;py++)for(var px=0;px<TW;px++){var v=f[py]&&f[py][px];if(!v)continue;ctx.fillStyle=pal[v]||pal[0];ctx.fillRect((cx*TW+px)*PS,(cy*TH+py)*PS,PS,PS);}}
function render(){
  var rm=rms[ri];if(!rm)return;
  ctx.fillStyle=pal[0]||'#000';ctx.fillRect(0,0,cv.width,cv.height);
  for(var ry=0;ry<RH;ry++)for(var rx=0;rx<RW;rx++){
    var tid=rm.tiles[ry]&&rm.tiles[ry][rx];if(!tid)continue;
    var t=tls.find(function(t){return t.id===tid;});if(!t)continue;
    if(removed[ri+','+rx+','+ry])continue;
    drawSprite(frame(t),rx,ry);
  }
  (rm.exits||[]).forEach(function(e){ctx.fillStyle='rgba(255,0,200,0.18)';ctx.fillRect(e.x*TW*PS,e.y*TH*PS,TW*PS,TH*PS);});
  (rm.npcs||[]).forEach(function(n){var sp=sprs.find(function(s){return s.id===n.spriteId;});if(sp)drawSprite(frame(sp),n.x,n.y);});
  drawSprite(frame(sprs[0]),pos.x,pos.y);
  if(dlg){
    var bw=cv.width-16,bh=86,bx=8,by=cv.height-bh-8;
    ctx.fillStyle='#0f3460';ctx.fillRect(bx,by,bw,bh);
    ctx.strokeStyle='#e94560';ctx.lineWidth=1;ctx.strokeRect(bx,by,bw,bh);
    ctx.fillStyle='#e94560';ctx.font='bold 10px monospace';ctx.fillText(dlg.name||'',bx+8,by+14);
    ctx.fillStyle='#fff';ctx.font='12px monospace';
    var txt=dlg.pages[dlg.pi]||'',ml=Math.floor((bw-16)/7),yo=by+28;
    for(var ci=0;ci<txt.length&&yo<by+bh-14;){var ch2=txt.slice(ci,ci+ml),nl=ch2.indexOf('\\n');if(nl>=0){ctx.fillText(ch2.slice(0,nl),bx+8,yo);ci+=nl+1;}else{ctx.fillText(ch2,bx+8,yo);ci+=ml;}yo+=14;}
    ctx.fillStyle='#444';ctx.font='9px monospace';ctx.fillText(dlg.pi<dlg.pages.length-1?'Space/Enter to continue':'Space/Enter to close',bx+8,by+bh-5);
    if(dlg.pages.length>1)ctx.fillText((dlg.pi+1)+'/'+dlg.pages.length,bx+bw-40,by+14);
  }
  if(won){
    ctx.fillStyle='rgba(0,0,0,0.72)';ctx.fillRect(0,0,cv.width,cv.height);
    ctx.textAlign='center';ctx.fillStyle='#ffec27';ctx.font='bold 18px monospace';ctx.fillText('\uD83C\uDF89 '+(S.gameTitle||'Game')+' \uD83C\uDF89',cv.width/2,cv.height/2-20);
    if(wonTxt){ctx.fillStyle='#fff';ctx.font='12px monospace';ctx.fillText(wonTxt,cv.width/2,cv.height/2+5);}
    ctx.fillStyle='#aaa';ctx.font='10px monospace';
    ctx.fillText('Collected: '+collected.length,cv.width/2,cv.height/2+22);
    ctx.fillText('Press R to restart',cv.width/2,cv.height/2+38);ctx.textAlign='left';
  }
}
var last=0;(function loop(ts){if(ts-last>200){tick++;last=ts;}render();requestAnimationFrame(loop);})(0);
document.addEventListener('keydown',function(e){
  if(won){if(e.key==='r'||e.key==='R')restart();return;}
  if(dlg){if([' ','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].indexOf(e.key)>=0){e.preventDefault();dlg.pi++;if(dlg.pi>=dlg.pages.length)dlg=null;}return;}
  var dx={'ArrowLeft':[-1,0],'ArrowRight':[1,0],'ArrowUp':[0,-1],'ArrowDown':[0,1]}[e.key];if(!dx)return;e.preventDefault();
  var rm=rms[ri],nx=pos.x+dx[0],ny=pos.y+dx[1];
  if(nx<0||nx>=RW||ny<0||ny>=RH)return;
  var ex=(rm.exits||[]).find(function(e){return e.x===nx&&e.y===ny;});
  if(ex){ri=typeof ex.destRoom==='number'?ex.destRoom:parseInt(ex.destRoom)||0;pos={x:ex.destX,y:ex.destY};blip('sine',660,0.18,0.2);return;}
  var npc=(rm.npcs||[]).find(function(n){return n.x===nx&&n.y===ny;});
  if(npc){var sp=sprs.find(function(s){return s.id===npc.spriteId;});if(sp&&sp.dialog){var pgs=sp.dialog.split(/\\n?---\\n?/).map(function(p){return p.trim();}).filter(Boolean);dlg={pages:pgs.length?pgs:[sp.dialog],pi:0,name:sp.name};blip((sp.blip&&sp.blip.wave)||'square',(sp.blip&&sp.blip.freq)||440,0.1,0.2);}return;}
  var tid=rm.tiles[ny]&&rm.tiles[ny][nx],tl=tls.find(function(t){return t.id===tid;}),tt=(tl&&tl.tileType)||'walkable';
  if(tt==='wall')return;
  pos={x:nx,y:ny};
  if(tt==='item'){var k=ri+','+nx+','+ny;if(!removed[k]){removed[k]=1;collected.push(tl.name||'item');blip('triangle',880,0.2,0.3);}}
  if(tt==='end'){won=true;wonTxt='You reached '+(tl.name||'the end')+'!';if(tsi)clearInterval(tsi);}
});
function addDpad(){
  var d=document.createElement('div');d.style.cssText='position:fixed;bottom:16px;left:50%;transform:translateX(-50%);display:grid;grid-template-columns:repeat(3,48px);grid-template-rows:repeat(3,48px);gap:3px;';
  [['','ArrowUp',''],['ArrowLeft','','ArrowRight'],['','ArrowDown','']].forEach(function(row){row.forEach(function(k){var b=document.createElement('button');b.style.cssText='background:'+(k?'rgba(255,255,255,0.12)':'transparent')+';border:none;border-radius:8px;font-size:22px;color:#fff;cursor:pointer;touch-action:manipulation;';b.textContent=k?({'ArrowUp':'↑','ArrowDown':'↓','ArrowLeft':'←','ArrowRight':'→'}[k]):'';if(k){b.addEventListener('touchstart',function(e){e.preventDefault();document.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true}));},{passive:false});b.onclick=function(){document.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true}));};}d.appendChild(b);});});
  var act=document.createElement('button');act.style.cssText='position:fixed;bottom:20px;right:16px;width:56px;height:56px;background:rgba(233,69,96,0.35);border:none;border-radius:50%;font-size:22px;color:#fff;cursor:pointer;';act.textContent='✓';act.onclick=function(){document.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));};act.addEventListener('touchstart',function(e){e.preventDefault();act.onclick();},{passive:false});
  document.body.appendChild(d);document.body.appendChild(act);
}
addDpad();
function restart(){ri=0;pos=findStart(rms[0]);collected=[];removed={};dlg=null;won=false;wonTxt='';if(tsi)clearInterval(tsi);tsi=null;ts2=0;startTune();}
})();`;

  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1.0">\n<title>${(gameTitle||'My Game').replace(/</g,'&lt;')}</title>\n<style>*{box-sizing:border-box}body{margin:0;background:#000;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:100vh;font-family:monospace;overflow:hidden}#gt{color:#e94560;font-size:12px;margin-bottom:6px;letter-spacing:2px;text-transform:uppercase}#hint{color:#333;font-size:9px;margin-top:6px}</style>\n</head>\n<body>\n<div id="gt">${(gameTitle||'My Game').replace(/</g,'&lt;')}</div>\n<canvas id="game"></canvas>\n<div id="hint">Arrow keys · Space/Enter to interact · R to restart</div>\n<script>\n${engine}\n</script>\n</body>\n</html>`;
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
              {data.filename
                ? <>Copy this HTML, save it as <code style={{ color: "#ffec27" }}>{data.filename}</code>, then open it in any browser to play — or share the file with students.</>
                : <>Copy this text and paste it into a <code style={{ color: "#ffec27" }}>.txt</code> file, then rename it to <code style={{ color: "#ffec27" }}>.bitsy</code> — or paste it into the Bitsy editor directly.</>}
            </div>
            <textarea
              ref={textRef}
              readOnly
              value={data.content}
              style={{ ...S.input, height: 280, fontFamily: "monospace", fontSize: 11, resize: "vertical", whiteSpace: "pre" }}
              onFocus={e => e.target.select()}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button style={{ ...S.btn(copied), flex: 1 }} onClick={copy}>
                {copied ? "✓ Copied!" : "📋 Copy All to Clipboard"}
              </button>
              <button style={{ ...S.btn(false), flex: 1 }} onClick={() => { textRef.current?.select(); }}>
                Select All
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

// ─── Dialog Pages Editor ──────────────────────────────────────────────────────
// ─── Text Import Modal (emoji / character art → pixel grid) ──────────────────
function TextImportModal({ onImport, onClose, palette }) {
  const [text, setText] = useState('');
  const [targetSize, setTargetSize] = useState(8);
  const [importAs, setImportAs] = useState('sprite');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const DARK = ['⬛','■','▪','▓','●','#','X','1','x'];
  const parseText = (t) => {
    // Extract tokens: each emoji or non-space char is one pixel
    const tokens = [];
    const seen = new Set();
    for (let ci = 0; ci < t.length; ) {
      const cp = t.codePointAt(ci);
      const ch = String.fromCodePoint(cp);
      ci += ch.length;
      if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') continue;
      if (!seen.has(ch)) seen.add(ch);
      tokens.push(ch);
    }
    if (tokens.length === 0) return null;
    const unique = [...seen];
    // Heuristic: the most-used character is likely background (0)
    const counts = {};
    tokens.forEach(c => counts[c] = (counts[c]||0) + 1);
    const sorted = unique.sort((a,b)=>(counts[b]||0)-(counts[a]||0));
    const bg = sorted[0];
    // Also check if a known dark char is present
    const hasDark = unique.some(c => DARK.includes(c));
    const isDark = c => hasDark ? DARK.includes(c) : c !== bg;
    return { tokens, isDark, bg };
  };

  const buildGrid = (tokens, isDark, size) => {
    const grid = Array.from({length:size}, ()=>Array(size).fill(0));
    for (let idx = 0; idx < Math.min(tokens.length, size*size); idx++) {
      const r = Math.floor(idx / size), c = idx % size;
      grid[r][c] = isDark(tokens[idx]) ? 1 : 0;
    }
    return grid;
  };

  const upscale = (grid) => {
    const h = grid.length, w = grid[0].length;
    return Array.from({length:h*2}, (_,y) =>
      Array.from({length:w*2}, (_,x) => grid[Math.floor(y/2)][Math.floor(x/2)]));
  };

  const handlePreview = () => {
    setError('');
    const result = parseText(text);
    if (!result) { setError('No pixels found. Paste emoji art (⬜⬛ or similar).'); return; }
    const rawCount = result.tokens.length;
    let detectedSize = rawCount >= 256 ? 16 : 8;
    let grid = buildGrid(result.tokens, result.isDark, detectedSize);
    if (targetSize === 16 && detectedSize === 8) grid = upscale(grid);
    if (targetSize === 8 && detectedSize === 16) {
      // downsample: take every 2nd pixel
      grid = Array.from({length:8}, (_,y) => Array.from({length:8}, (_,x) => grid[y*2][x*2]));
    }
    setPreview(grid);
  };

  const doImport = () => {
    if (!preview) return;
    onImport({ grid: preview, mode: importAs });
  };

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={{...S.modalContent, maxWidth:480}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h3 style={{margin:0,color:'#e94560'}}>Import from Text / Emoji Art</h3>
          <button style={S.btn(false)} onClick={onClose}>✕</button>
        </div>
        <div style={{fontSize:11,color:'#888',marginBottom:8}}>
          Paste emoji pixel art (⬜⬛), text art (░▓), or binary strings. Each token = 1 pixel.
        </div>
        <textarea value={text} onChange={e=>{setText(e.target.value);setPreview(null);setError('');}}
          placeholder={"⬜ ⬛ ⬛ ⬜\n⬛ ⬜ ⬜ ⬛\n..."}
          style={{...S.input, height:100, resize:'vertical', fontFamily:'monospace', fontSize:13}} />
        <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8,flexWrap:'wrap'}}>
          <span style={{fontSize:11,color:'#aaa'}}>Target size:</span>
          {[8,16].map(sz=><button key={sz} style={{...S.btn(targetSize===sz),fontSize:11}} onClick={()=>{setTargetSize(sz);setPreview(null);}}>{sz}×{sz}</button>)}
          <span style={{fontSize:11,color:'#aaa',marginLeft:8}}>Import as:</span>
          {['sprite','tile','item'].map(m=><button key={m} style={{...S.btn(importAs===m),fontSize:11}} onClick={()=>setImportAs(m)}>{m}</button>)}
        </div>
        {error && <div style={{color:'#e94560',fontSize:11,marginTop:6}}>{error}</div>}
        <button style={{...S.btnGreen,marginTop:10,width:'100%'}} onClick={handlePreview}>Preview</button>
        {preview && (
          <div style={{marginTop:10}}>
            <div style={{fontSize:11,color:'#aaa',marginBottom:4}}>Preview ({preview[0].length}×{preview.length}):</div>
            <canvas ref={el=>{
              if(!el)return; const ps=Math.max(4,Math.floor(120/Math.max(preview[0].length,preview.length)));
              el.width=preview[0].length*ps; el.height=preview.length*ps;
              const ctx=el.getContext('2d');
              for(let y=0;y<preview.length;y++)for(let x=0;x<preview[0].length;x++){ctx.fillStyle=palette[preview[y][x]]||palette[0];ctx.fillRect(x*ps,y*ps,ps,ps);}
            }} style={{imageRendering:'pixelated',display:'block',border:'2px solid #0f3460',borderRadius:3}} />
            <button style={{...S.btn(true),marginTop:10,width:'100%'}} onClick={doImport}>Import as {importAs}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bitsy File Import Modal ───────────────────────────────────────────────────
function BitsyImportModal({ onImport, onClose }) {
  const [status, setStatus] = useState('');
  const [parsed, setParsed] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const result = parseBitsyData(ev.target.result);
        setParsed(result);
        const tCount = result.tiles.length, sCount = result.sprites.length, rCount = result.rooms.length;
        setStatus(`✓ Parsed: ${sCount} sprite${sCount!==1?'s':''}, ${tCount} tile${tCount!==1?'s':''}, ${rCount} room${rCount!==1?'s':''} — "${result.gameTitle}"`);
      } catch(err) {
        setStatus(`✗ Parse error: ${err.message}`);
        setParsed(null);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={{...S.modalContent, maxWidth:440}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h3 style={{margin:0,color:'#e94560'}}>Import .bitsy File</h3>
          <button style={S.btn(false)} onClick={onClose}>✕</button>
        </div>
        <div style={{fontSize:11,color:'#888',marginBottom:10}}>
          Load a <code style={{color:'#ffec27'}}>.bitsy</code> or <code style={{color:'#ffec27'}}>.txt</code> game file (standard Bitsy or Bitsy-color format). This will replace your current project.
        </div>
        <input ref={fileRef} type="file" accept=".bitsy,.txt,text/plain" onChange={handleFile}
          style={{...S.input, marginBottom:8, cursor:'pointer'}} />
        {status && <div style={{fontSize:12,color:status.startsWith('✓')?'#00e436':'#e94560',marginBottom:10,padding:'6px 8px',background:'#0d1b3e',borderRadius:4}}>{status}</div>}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button style={S.btn(false)} onClick={onClose}>Cancel</button>
          <button style={{...S.btn(true),background:'#e94560'}} disabled={!parsed} onClick={()=>{if(parsed)onImport(parsed);}}>Load Game</button>
        </div>
      </div>
    </div>
  );
}

function DialogPagesEditor({ value, onChange }) {
  const pages = value ? value.split(/\n?---\n?/) : [""];
  const update = (newPages) => onChange(newPages.join("\n---\n"));
  return (
    <div>
      {pages.map((page, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
            <span style={{ fontSize:10, color:"#888" }}>Page {i + 1}</span>
            <div style={{ display:"flex", gap:3 }}>
              {i > 0 && (
                <button style={{ ...S.btn(false), fontSize:10, padding:"2px 6px" }}
                  title="Move page up"
                  onClick={() => { const p=[...pages]; [p[i-1],p[i]]=[p[i],p[i-1]]; update(p); }}>↑</button>
              )}
              {i < pages.length - 1 && (
                <button style={{ ...S.btn(false), fontSize:10, padding:"2px 6px" }}
                  title="Move page down"
                  onClick={() => { const p=[...pages]; [p[i],p[i+1]]=[p[i+1],p[i]]; update(p); }}>↓</button>
              )}
              {pages.length > 1 && (
                <button style={{ ...S.btn(false), fontSize:10, padding:"2px 6px", color:"#e94560", borderColor:"#e94560" }}
                  title="Remove this page"
                  onClick={() => update(pages.filter((_,j) => j !== i))}>✕</button>
              )}
            </div>
          </div>
          <textarea value={page}
            onChange={e => { const p=[...pages]; p[i]=e.target.value; update(p); }}
            placeholder={`Page ${i+1} text…`}
            style={{ ...S.input, height:56, resize:"vertical", fontFamily:"inherit" }} />
        </div>
      ))}
      <button style={{ ...S.btn(false), width:"100%", fontSize:11, marginTop:2 }}
        onClick={() => update([...pages, ""])}>+ Add Page</button>
    </div>
  );
}

// ─── Cloud Saves Modal ────────────────────────────────────────────────────────
function CloudSavesModal({ user, saves, onSave, onLoad, onDelete, onClose, loading }) {
  const [saveTitle, setSaveTitle] = useState("");
  return (
    <div style={S.modal} onClick={onClose}>
      <div style={{ ...S.modalContent, maxWidth:480 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h3 style={{ margin:0, color:"#e94560" }}>☁️ Cloud Saves</h3>
          <button style={S.btn(false)} onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize:12, color:"#aaa", marginBottom:12 }}>
          Signed in as <b style={{ color:"#e0e0e0" }}>{user?.email}</b>
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          <input value={saveTitle} onChange={e=>setSaveTitle(e.target.value)}
            placeholder="Save name…" style={{ ...S.input, flex:1 }}
            onKeyDown={e=>{ if(e.key==="Enter"&&saveTitle.trim()){ onSave(saveTitle.trim()); setSaveTitle(""); } }} />
          <button style={{ ...S.btn(true) }} onClick={()=>{ onSave(saveTitle.trim()||"Untitled"); setSaveTitle(""); }} disabled={loading}>
            {loading?"Saving…":"💾 Save"}
          </button>
        </div>
        {saves.length === 0 ? (
          <div style={{ fontSize:12, color:"#555", textAlign:"center", padding:16 }}>No saves yet.</div>
        ) : (
          <div>
            {saves.map(save => (
              <div key={save.id} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, background:"#0d1b3e", borderRadius:4, padding:"8px 10px" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, color:"#e0e0e0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{save.title}</div>
                  <div style={{ fontSize:10, color:"#555" }}>{save.updatedAt ? new Date(save.updatedAt).toLocaleString() : ""}</div>
                </div>
                <button style={{ ...S.btn(false), fontSize:11 }} onClick={()=>onLoad(save)} disabled={loading}>Load</button>
                <button style={{ ...S.btn(false), fontSize:11, color:"#e94560", borderColor:"#e94560" }} onClick={()=>onDelete(save.id)} disabled={loading}>✕</button>
              </div>
            ))}
          </div>
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
  const [findQuery,setFindQuery]=useState("");
  const [tune,setTune]=useState(Array.from({length:TUNE_STEPS},()=>({semi:12,active:false})));

  // Grid config
  const [spriteW,setSpriteW]=useState(8); const [spriteH,setSpriteH]=useState(8);
  const [tileW,setTileW]=useState(8);   const [tileH,setTileH]=useState(8);
  const [roomW,setRoomW]=useState(16);  const [roomH,setRoomH]=useState(16);

  const [sprites,setSprites]=useState([{id:uid(),name:"avatar",frames:[emptyGrid(8,8)],dialog:"",tileType:"walkable",blip:{wave:"square",freq:440}}]);
  const [tiles,setTiles]=useState([{id:uid(),name:"wall",frames:[emptyGrid(8,8)],tileType:"wall"}]);
  const [selectedSprite,setSelectedSprite]=useState(0);
  const [selectedTile,setSelectedTile]=useState(0);
  const [selectedFrame,setSelectedFrame]=useState(0);

  const [rooms,setRooms]=useState([{id:uid(),name:"room 0",tiles:emptyGrid(16,16).map(r=>r.map(()=>null)),npcs:[],exits:[]}]);
  const [selectedRoom,setSelectedRoom]=useState(0);
  const [roomTool,setRoomTool]=useState("place"); // place | erase | fill | npc
  const [roomZoom,setRoomZoom]=useState(1);

  const [animFrame,setAnimFrame]=useState(0);
  const [playing,setPlaying]=useState(false);

  // Firebase auth state: undefined=loading, null=not signed in, User=signed in
  const [user,setUser]=useState(undefined);
  const [cloudModal,setCloudModal]=useState(false);
  const [cloudSaves,setCloudSaves]=useState([]);
  const [cloudLoading,setCloudLoading]=useState(false);

  // Modal state for new features
  const [showBitsyImport,setShowBitsyImport]=useState(false);
  const [showTextImport,setShowTextImport]=useState(false);

  // Undo/redo history
  const historyRef=useRef([]);
  const historyIdxRef=useRef(-1);
  const pushHistory=useCallback(()=>{
    const snap={tiles:JSON.parse(JSON.stringify(tiles)),sprites:JSON.parse(JSON.stringify(sprites)),rooms:JSON.parse(JSON.stringify(rooms)),palette:[...palette]};
    const hist=historyRef.current.slice(0,historyIdxRef.current+1);
    hist.push(snap);
    if(hist.length>40)hist.shift();
    historyRef.current=hist;
    historyIdxRef.current=hist.length-1;
  },[tiles,sprites,rooms,palette]);
  const undo=useCallback(()=>{
    const idx=historyIdxRef.current;if(idx<=0)return;
    historyIdxRef.current=idx-1;
    const snap=historyRef.current[idx-1];
    setTiles(snap.tiles);setSprites(snap.sprites);setRooms(snap.rooms);setPalette(snap.palette);
  },[]);
  const redo=useCallback(()=>{
    const idx=historyIdxRef.current,hist=historyRef.current;if(idx>=hist.length-1)return;
    historyIdxRef.current=idx+1;
    const snap=hist[idx+1];
    setTiles(snap.tiles);setSprites(snap.sprites);setRooms(snap.rooms);setPalette(snap.palette);
  },[]);

  useEffect(()=>{ if(!playing)return; const t=setInterval(()=>setAnimFrame(f=>f+1),200); return()=>clearInterval(t); },[playing]);

  // Firebase auth observer
  useEffect(()=>{
    const unsub = watchAuthState(u=>setUser(u));
    return unsub;
  },[]);

  // Keyboard shortcuts
  useEffect(()=>{
    const h=(e)=>{
      const mod=e.ctrlKey||e.metaKey;
      // Undo: Ctrl/Cmd+Z
      if(mod&&e.key.toLowerCase()==='z'&&!e.shiftKey){e.preventDefault();undo();return;}
      // Redo: Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y
      if(mod&&(e.shiftKey&&e.key.toLowerCase()==='z'||e.key.toLowerCase()==='y')){e.preventDefault();redo();return;}
      if(e.target.tagName==="INPUT"||e.target.tagName==="SELECT"||e.target.tagName==="TEXTAREA")return;
      switch(e.key.toLowerCase()){
        case"d":setTool("draw");break; case"e":setTool("erase");break;
        case"f":setTool("fill");break; case"g":setShowGrid(v=>!v);break;
        default: if(e.key>="1"&&e.key<="9"){const i=parseInt(e.key)-1;if(i<palette.length)setSelectedColor(i);}
      }
    };
    window.addEventListener("keydown",h); return()=>window.removeEventListener("keydown",h);
  },[palette.length,undo,redo]);

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
      const n={id:uid(),name:"imported",frames:[grid],tileType:"walkable",dialog:""};
      setSprites(p=>{setSelectedSprite(p.length);return[...p,n];});
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
        const n={id:uid(),name:asset.name,frames:[grid],tileType:asset.tileType||"walkable",dialog:asset.dialog||""};
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
  const exportGameData=(colorMode=false)=>{
    try{
      const data=exportBitsyData(gameTitle,palette,sprites,tiles,rooms,tune,colorMode);
      const title=colorMode?"Game Data (.bitsy — Multicolor)":"Game Data (.bitsy — Standard)";
      setExportModal({type:"text",title,content:data});
    }catch(err){alert("Export failed: "+err.message);}
  };
  const exportHtml=()=>{
    try{
      const html=buildHtmlExport(gameTitle,palette,sprites,tiles,rooms,tune,tileW,tileH,roomW,roomH);
      setExportModal({type:"text",title:"Export HTML Game",content:html,filename:`${(gameTitle||'game').replace(/[^a-z0-9]/gi,'_').toLowerCase()}.html`});
    }catch(err){alert("Export failed: "+err.message);}
  };
  // .bitsy file import
  const handleBitsyImport=(data)=>{
    pushHistory();
    if(data.gameTitle)setGameTitle(data.gameTitle);
    if(data.palette)setPalette(data.palette);
    if(data.sprites)setSprites(data.sprites);
    if(data.tiles)setTiles(data.tiles);
    if(data.rooms)setRooms(data.rooms);
    if(data.roomW)setRoomW(data.roomW);
    if(data.roomH)setRoomH(data.roomH);
    if(data.tileW){setTileW(data.tileW);setSpriteW(data.tileW);}
    if(data.tileH){setTileH(data.tileH);setSpriteH(data.tileH);}
    setSelectedSprite(0);setSelectedTile(0);setSelectedRoom(0);setSelectedFrame(0);
    setShowBitsyImport(false);
  };
  // Text/emoji import
  const handleTextImport=({grid,mode})=>{
    pushHistory();
    const w=grid[0].length, h=grid.length;
    if(mode==='sprite'){
      const n={id:uid(),name:'imported_sprite',frames:[grid],tileType:'walkable',dialog:'',blip:{wave:'square',freq:440}};
      setSprites(p=>{setSelectedSprite(p.length);return[...p,n];});
      setSpriteW(w);setSpriteH(h);setTab('sprite');
    } else {
      const type=mode==='item'?'item':mode==='tile'?'walkable':'walkable';
      const n={id:uid(),name:'imported_tile',frames:[grid],tileType:type};
      setTiles(p=>{setSelectedTile(p.length);return[...p,n];});
      setTileW(w);setTileH(h);setTab('tile');
    }
    setSelectedFrame(0);setShowTextImport(false);
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

  // Room handling
  const handleRoomPlace=(rx,ry)=>{
    setRooms(prev=>{
      const rs=[...prev];
      const room={...rs[selectedRoom],tiles:rs[selectedRoom].tiles.map(r=>[...r]),npcs:[...(rs[selectedRoom].npcs||[])]};
      if(roomTool==="erase"){
        room.tiles[ry][rx]=null;
        room.npcs=room.npcs.filter(n=>!(n.x===rx&&n.y===ry));
        room.exits=(room.exits||[]).filter(e=>!(e.x===rx&&e.y===ry));
      } else if(roomTool==="exit"){
        // Toggle: clicking existing exit removes it; clicking empty opens config modal
        const existing=(room.exits||[]).find(e=>e.x===rx&&e.y===ry);
        if(existing){ room.exits=(room.exits||[]).filter(e=>!(e.x===rx&&e.y===ry)); rs[selectedRoom]=room; return rs; }
        // Open config modal — we can't do async from here, so set exitModal and bail
        setExitModal({x:rx,y:ry});
        return prev; // don't mutate yet; confirmed in ExitConfigModal callback
      } else if(roomTool==="fill"){
        // Flood fill tiles
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
        // Toggle: clicking an NPC's cell removes it; clicking empty places it
        const alreadyHere=room.npcs.find(n=>n.x===rx&&n.y===ry&&n.spriteId===sprites[selectedSprite]?.id);
        room.npcs=room.npcs.filter(n=>!(n.x===rx&&n.y===ry));
        if(!alreadyHere&&sprites[selectedSprite]&&selectedSprite>0){
          room.npcs.push({spriteId:sprites[selectedSprite].id,x:rx,y:ry});
        }
      } else {
        // Toggle: clicking a cell that already has the selected tile clears it
        const selectedId=tiles[selectedTile]?.id||null;
        room.tiles[ry][rx]=room.tiles[ry][rx]===selectedId ? null : selectedId;
      }
      rs[selectedRoom]=room;
      return rs;
    });
  };
  const addRoom=()=>{
    const n={id:uid(),name:`room ${rooms.length}`,tiles:emptyGrid(roomW,roomH).map(r=>r.map(()=>null)),npcs:[],exits:[]};
    setRooms(p=>[...p,n]);setSelectedRoom(rooms.length);
  };

  // Cloud save / load
  const openCloudModal=async()=>{
    if(!user)return;
    setCloudLoading(true);
    try{ const saves=await loadAllGames(user.uid); setCloudSaves(saves); }catch(e){}
    setCloudLoading(false);
    setCloudModal(true);
  };
  const handleCloudSave=async(title)=>{
    if(!user)return;
    setCloudLoading(true);
    try{
      const state={gameTitle,palette,sprites,tiles,rooms,tune};
      await saveGame(user.uid,uid(),title,state);
      const saves=await loadAllGames(user.uid); setCloudSaves(saves);
    }catch(e){ alert("Save failed: "+e.message); }
    setCloudLoading(false);
  };
  const handleCloudLoad=async(save)=>{
    try{
      const state=JSON.parse(save.data);
      if(state.gameTitle) setGameTitle(state.gameTitle);
      if(state.palette) setPalette(state.palette);
      if(state.sprites){ setSprites(state.sprites); setSelectedSprite(0); }
      if(state.tiles){ setTiles(state.tiles); setSelectedTile(0); }
      if(state.rooms){ setRooms(state.rooms); setSelectedRoom(0); }
      if(state.tune) setTune(state.tune);
      // Advance ID counter past any loaded IDs to avoid collisions
      const allIds=[...(state.sprites||[]),...(state.tiles||[]),...(state.rooms||[])].map(x=>x.id||"");
      const maxN=allIds.reduce((m,id)=>{ const n=parseInt(id.replace("id_","")); return isNaN(n)?m:Math.max(m,n); },0);
      if(maxN>=nextId) nextId=maxN+1;
      setCloudModal(false);
    }catch(e){ alert("Load failed: "+e.message); }
  };
  const handleCloudDelete=async(gameId)=>{
    if(!user)return;
    setCloudLoading(true);
    try{
      await deleteGame(user.uid,gameId);
      const saves=await loadAllGames(user.uid); setCloudSaves(saves);
    }catch(e){ alert("Delete failed: "+e.message); }
    setCloudLoading(false);
  };

  const confirmExit=(exitData)=>{
    setRooms(prev=>{
      const rs=[...prev];
      const room={...rs[selectedRoom],exits:[...(rs[selectedRoom].exits||[]).filter(e=>!(e.x===exitData.x&&e.y===exitData.y)),exitData]};
      rs[selectedRoom]=room; return rs;
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

  const pixelSize=Math.max(8,Math.floor(380/Math.max(itemW,itemH)));
  const previewFrame=currentItem?currentItem.frames[animFrame%currentItem.frames.length]:emptyGrid(8,8);
  const currentTileType=currentItem?.tileType||"walkable";

  return (
    <div style={S.app}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.title}>🎮 Multicolor Bitsy</span>
        <input value={gameTitle} onChange={e=>setGameTitle(e.target.value)}
          style={{...S.input,width:200,fontSize:13}} placeholder="Game title..." />
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
          {FIREBASE_READY&&(
            user===undefined ? null :
            user===null ? (
              <button style={{...S.btn(false),background:"#0d2040",borderColor:"#29adff",color:"#29adff"}}
                onClick={()=>signInWithGoogle().catch(()=>{})}>🔑 Sign In</button>
            ) : (
              <>
                <button style={{...S.btn(false),background:"#082040",borderColor:"#29adff",color:"#29adff",fontSize:11}}
                  onClick={openCloudModal}>☁️ Cloud Saves</button>
                <span style={{fontSize:10,color:"#555",maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}
                  title={user.email}>{user.displayName||user.email}</span>
                <button style={{...S.btn(false),fontSize:10,color:"#666"}}
                  onClick={()=>signOutUser()}>Sign Out</button>
              </>
            )
          )}
          <button style={{...S.btn(false),fontSize:11,padding:"4px 8px"}} title="Undo (Ctrl+Z)" onClick={undo}>↩ Undo</button>
          <button style={{...S.btn(false),fontSize:11,padding:"4px 8px"}} title="Redo (Ctrl+Shift+Z)" onClick={redo}>↪ Redo</button>
          <button style={{...S.btn(false),borderColor:"#00e436",color:"#00e436"}} onClick={()=>setShowBitsyImport(true)}>📂 Import .bitsy</button>
          <button style={S.btnGreen} onClick={()=>setShowImport(true)}>Import Image</button>
          <button style={{...S.btnGreen,borderColor:"#29adff",color:"#29adff",background:"transparent"}} onClick={()=>setShowTextImport(true)}>⬛ Text Art</button>
          <button style={S.btn(false)} onClick={()=>setShowPlaytest(true)}>▶ Test Game</button>
          <button style={S.btn(false)} onClick={exportPng}>PNG</button>
          {currentItem?.frames.length>1&&<button style={S.btn(false)} onClick={exportSpritesheet}>Sheet</button>}
          <button style={S.btn(false)} onClick={()=>exportGameData(false)}>Export .bitsy</button>
          <button style={{...S.btn(false),borderColor:"#29adff",color:"#29adff"}} onClick={()=>exportGameData(true)}>Export Color .bitsy</button>
          <button style={{...S.btn(false),borderColor:"#ffec27",color:"#ffec27"}} onClick={exportHtml}>🌐 Export HTML</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:"#16213e",padding:"0 20px",display:"flex"}}>
        {["sprite","tile","room","tune"].map(t=>(
          <button key={t} style={S.tab(tab===t)} onClick={()=>{setTab(t);setSelectedFrame(0);}}>
            {t==="sprite"?"🧑 Sprites":t==="tile"?"🟦 Tiles":t==="room"?"🗺 Rooms":"🎵 Tune"}
          </button>
        ))}
      </div>

      <div style={S.main}>
        {/* Left Sidebar */}
        <div style={S.sidebar}>
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

          {/* Tools */}
          {tab!=="room"&&(
            <div style={S.section}>
              <div style={S.sectionTitle}>Tools</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {[["draw","✏️"],["erase","🧹"],["fill","🪣"]].map(([t,emoji])=>(
                  <button key={t} style={S.btn(tool===t)} onClick={()=>setTool(t)}>{emoji} {t}</button>
                ))}
              </div>
              <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,marginTop:6,cursor:"pointer"}}>
                <input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)} /> Show grid
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
              <div style={S.sectionTitle}>Room Tools</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {[["place","🟦 Place"],["erase","🧹 Erase"],["fill","🪣 Fill"],["npc","🧑 NPC"],["exit","🚪 Exit"]].map(([t,label])=>(
                  <button key={t} style={S.btn(roomTool===t)} onClick={()=>setRoomTool(t)}>{label}</button>
                ))}
              </div>
              {roomTool==="npc"&&<div style={{fontSize:11,color:"#888",marginTop:6}}>Select a sprite below (not avatar) and click room to place</div>}
              {roomTool==="exit"&&<div style={{fontSize:11,color:"#ff44ee",marginTop:6}}>Click a cell to place an exit portal (pink ▶). Click again to remove.</div>}
              <div style={{marginTop:8,display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{fontSize:11,color:"#aaa"}}>Zoom:</span>
                {[0.5,0.75,1,1.5,2].map(z=>(
                  <button key={z} style={{...S.btn(roomZoom===z),fontSize:10,padding:"3px 7px"}}
                    onClick={()=>setRoomZoom(z)}>{z===1?"1×":`${z}×`}</button>
                ))}
              </div>
              <div style={{marginTop:6,display:"flex",gap:4,alignItems:"center"}}>
                <span style={{fontSize:11,color:"#aaa"}}>Room:</span>
                <select style={S.select} value={roomW} onChange={e=>setRoomW(+e.target.value)}>{[8,12,16,20,24,32].map(v=><option key={v} value={v}>{v}</option>)}</select>
                <span style={{color:"#888"}}>×</span>
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
                    style={{padding:"5px 8px",background:i===selectedRoom?"#0f3460":"transparent",borderRadius:4,cursor:"pointer",fontSize:12,marginBottom:2,border:i===selectedRoom?"1px solid #e94560":"1px solid transparent"}}>
                    {room.name}
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

          {/* Asset Packs — hidden in room mode (shown in below-canvas panel instead) */}
          {tab!=="room"&&<div style={S.section}>
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
          </div>}
        </div>

        {/* Center Canvas */}
        {tab==="room" ? (
        <div style={S.centerRoom}>
          {/* Canvas area — fills remaining space */}
          <div style={{flex:1,overflow:"auto",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"8px 8px 0 8px",minHeight:0}}>
            <RoomCanvas room={rooms[selectedRoom]||{tiles:[],npcs:[]}} tiles={tiles} sprites={sprites}
              palette={palette} roomW={roomW} roomH={roomH} tileW={tileW} tileH={tileH}
              onPlace={handleRoomPlace} onStrokeEnd={pushHistory} roomTool={roomTool} zoom={roomZoom}
              selectedTileId={tiles[selectedTile]?.id} selectedSpriteId={sprites[selectedSprite]?.id} />
          </div>
          {/* Below-canvas panel: Tiles · NPCs · Asset Packs */}
          <div style={{borderTop:"2px solid #0f3460",background:"#16213e",display:"flex",flexShrink:0,overflowX:"auto",maxHeight:220}}>
            {/* Tiles */}
            <div style={{padding:"8px 10px",borderRight:"1px solid #0f3460",minWidth:140,maxWidth:240,overflowY:"auto"}}>
              <div style={{...S.sectionTitle,marginBottom:5}}>Tiles</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                {tiles.map((tile,i)=>(
                  <div key={tile.id} onClick={()=>setSelectedTile(i)}
                    style={{border:i===selectedTile?"2px solid #e94560":"2px solid #444",borderRadius:3,cursor:"pointer",position:"relative",flexShrink:0}}>
                    <MiniCanvas grid={tile.frames[0]} palette={palette} size={28} />
                    {tile.tileType&&tile.tileType!=="walkable"&&<div style={{position:"absolute",bottom:0,right:0,fontSize:7,background:TILE_TYPE_COLORS[tile.tileType],color:"#000",padding:"0 2px",fontWeight:700,borderRadius:"2px 0 0 0"}}>{tile.tileType[0]}</div>}
                  </div>
                ))}
              </div>
            </div>
            {/* NPCs */}
            <div style={{padding:"8px 10px",borderRight:"1px solid #0f3460",minWidth:120,maxWidth:200,overflowY:"auto"}}>
              <div style={{...S.sectionTitle,marginBottom:5}}>NPCs</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                {sprites.map((spr,i)=>(
                  <div key={spr.id} onClick={()=>setSelectedSprite(i)}
                    style={{border:i===selectedSprite?"2px solid #e94560":"2px solid #444",borderRadius:3,cursor:"pointer",opacity:i===0?0.4:1,flexShrink:0}}>
                    <MiniCanvas grid={spr.frames[0]} palette={palette} size={28} />
                  </div>
                ))}
              </div>
              <div style={{fontSize:9,color:"#555",marginTop:4}}>Index 0 = player (avatar)</div>
            </div>
            {/* Asset Packs */}
            <div style={{padding:"8px 10px",flex:1,minWidth:180,overflowY:"auto"}}>
              <div style={{...S.sectionTitle,marginBottom:5}}>Asset Packs</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {ASSET_PACKS.map((pack,pi)=>(
                  <div key={pi}>
                    <button onClick={()=>setActivePack(activePack===pi?null:pi)}
                      style={{...S.btn(activePack===pi),fontSize:10,padding:"3px 7px",marginBottom:2}}>
                      {pack.name} {activePack===pi?"▲":"▼"}
                    </button>
                    {activePack===pi&&(
                      <div style={{display:"flex",flexWrap:"wrap",gap:2,padding:4,background:"#0d1b3e",borderRadius:4,maxWidth:320}}>
                        {pack.assets.map((asset,ai)=>(
                          <div key={ai} onClick={()=>addFromPack(asset)}
                            title={`Add ${asset.name}`}
                            style={{cursor:"pointer",border:"1px solid #333",borderRadius:3,flexShrink:0}}
                            onMouseEnter={e=>e.currentTarget.style.border="1px solid #e94560"}
                            onMouseLeave={e=>e.currentTarget.style.border="1px solid #333"}>
                            <MiniCanvas grid={asset.grid} palette={palette} size={28} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        ) : (
        <div style={S.center}>
          {tab==="tune"?(
            <div style={{width:"100%",maxWidth:640,padding:8}}>
              <div style={{fontWeight:700,color:"#e94560",marginBottom:12,fontSize:14}}>🎵 Background Tune</div>
              <TuneEditor tune={tune} onChange={setTune} />
              <div style={{marginTop:16,fontSize:11,color:"#555",lineHeight:1.8}}>
                The tune loops in the background while your game is playing.<br/>
                Separate dialog pages with <code style={{color:"#ffec27"}}>---</code> on its own line for multi-page speech.
              </div>
            </div>
          ):(tab!=="tune"&&(
            <>
              <PixelCanvas grid={currentFrame} palette={palette} onDraw={handleDraw} onStrokeEnd={pushHistory} pixelSize={pixelSize} showGrid={showGrid} />
              {currentItem&&<div style={{marginTop:6,fontSize:11,color:"#888"}}>{currentItem.name} · Frame {selectedFrame+1}/{currentItem.frames.length} · {itemW}×{itemH}</div>}
            </>
          ))}
        </div>

        {/* Right Panel */}
        <div style={S.rightPanel}>
          {tab!=="room"&&currentItem&&(
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
                <div style={{marginBottom:12}}>
                  <button style={{...S.btn(false),width:"100%",fontSize:11,background:"#082040",borderColor:"#29adff",color:"#29adff"}}
                    onClick={()=>setAsAvatar(selectedSprite)}>
                    👤 Set as Avatar (replace player appearance)
                  </button>
                  <div style={{fontSize:10,color:"#555",marginTop:3}}>Copies this sprite's pixels into sprites[0], which is the playable character.</div>
                </div>
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
                  {selectedSprite===0 ? (
                    <div style={{fontSize:11,color:"#555",fontStyle:"italic",padding:"4px 0"}}>Avatar (player) has no dialog.</div>
                  ) : (
                    <>
                      <DialogPagesEditor value={currentItem.dialog||""} onChange={updateDialog} />
                      <div style={{fontSize:10,color:"#666",marginTop:3}}>Each page shows one at a time. Press Space or Enter in-game to advance.</div>
                    </>
                  )}
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
                    ["Rot CCW",f=>{const h=f.length,w=f[0].length;return Array.from({length:w},(_,x)=>Array.from({length:h},(_,y)=>f[y][w-1-x]));}],
                    ["Mirror H",f=>f.map(r=>{const hw=Math.ceil(r.length/2);return r.map((_,x)=>x<hw?r[x]:r[r.length-1-x])})],
                    ["Mirror V",f=>{const hh=Math.ceil(f.length/2);return f.map((r,y)=>y<hh?[...r]:[...f[f.length-1-y]])}],
                    ["Clear",()=>emptyGrid(itemW,itemH)],
                  ].map(([label,fn])=>(
                    <button key={label} style={{...S.btn(false),fontSize:11}} onClick={()=>{
                      const setItems=tab==="sprite"?setSprites:setTiles;
                      const idx=tab==="sprite"?selectedSprite:selectedTile;
                      setItems(prev=>{const items=[...prev];const item={...items[idx],frames:[...items[idx].frames]};item.frames[selectedFrame]=fn(item.frames[selectedFrame]);items[idx]=item;return items;});
                    }}>{label}</button>
                  ))}
                </div>
                <div style={{marginTop:6}}>
                  <div style={{fontSize:10,color:"#888",marginBottom:3}}>Nudge</div>
                  <div style={{display:"flex",gap:3,alignItems:"center",justifyContent:"center"}}>
                    {[
                      ["←",f=>f.map(r=>[...r.slice(1),0])],
                      ["↑",f=>[...f.slice(1),f[0].map(()=>0)]],
                      ["↓",f=>[f[0].map(()=>0),...f.slice(0,-1)]],
                      ["→",f=>f.map(r=>[0,...r.slice(0,-1)])],
                    ].map(([label,fn])=>(
                      <button key={label} style={{...S.btn(false),fontSize:13,padding:"3px 8px",minWidth:28}} onClick={()=>{
                        const setItems=tab==="sprite"?setSprites:setTiles;
                        const idx=tab==="sprite"?selectedSprite:selectedTile;
                        setItems(prev=>{const items=[...prev];const item={...items[idx],frames:[...items[idx].frames]};item.frames[selectedFrame]=fn(item.frames[selectedFrame]);items[idx]=item;return items;});
                      }}>{label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Room right panel */}
          {tab==="room"&&rooms[selectedRoom]&&(
            <>
              <div style={S.section}>
                <div style={S.sectionTitle}>Room Name</div>
                <input value={rooms[selectedRoom].name}
                  onChange={e=>setRooms(prev=>{const rs=[...prev];rs[selectedRoom]={...rs[selectedRoom],name:e.target.value};return rs;})}
                  style={S.input} />
              </div>
              <div style={S.section}>
                <div style={S.sectionTitle}>Legend</div>
                <div style={{fontSize:11,color:"#aaa",lineHeight:1.8}}>
                  {TILE_TYPES.map(t=>(
                    <div key={t} style={{color:TILE_TYPE_COLORS[t]||"#aaa"}}>
                      {t==="walkable"?"🟢":t==="wall"?"🔴":t==="item"?"🟡":"🔵"} {t}
                      {t==="wall"?" — blocks player":t==="item"?" — collected on touch":t==="end"?" — triggers win":""}
                    </div>
                  ))}
                </div>
              </div>
              {(rooms[selectedRoom]?.exits||[]).length>0&&(
                <div style={S.section}>
                  <div style={S.sectionTitle}>Exits ({rooms[selectedRoom].exits.length})</div>
                  {rooms[selectedRoom].exits.map((ex,i)=>(
                    <div key={i} style={{fontSize:11,color:"#ff44ee",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3,background:"#0d1b3e",borderRadius:3,padding:"3px 6px"}}>
                      <span>({ex.x},{ex.y}) → Room {ex.destRoom} @ ({ex.destX},{ex.destY})</span>
                      <button style={{background:"none",border:"none",color:"#e94560",cursor:"pointer",fontSize:12,padding:"0 2px"}}
                        onClick={()=>setRooms(prev=>{const rs=[...prev];rs[selectedRoom]={...rs[selectedRoom],exits:rs[selectedRoom].exits.filter((_,j)=>j!==i)};return rs;})}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={S.section}>
                <div style={S.sectionTitle}>Actions</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <button style={{...S.btn(false),fontSize:11}} onClick={()=>{
                    setRooms(prev=>{const rs=[...prev];rs[selectedRoom]={...rs[selectedRoom],tiles:emptyGrid(roomW,roomH).map(r=>r.map(()=>null)),npcs:[],exits:[]};return rs;});
                  }}>Clear Room</button>
                  <button style={{...S.btn(false),fontSize:11}} onClick={()=>exportRoomPng(rooms[selectedRoom])}>Export Room PNG</button>
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
      {showPlaytest&&<PlaytestModal rooms={rooms} startRoom={selectedRoom} tiles={tiles} sprites={sprites}
        palette={palette} roomW={roomW} roomH={roomH} tileW={tileW} tileH={tileH} tune={tune} onClose={()=>setShowPlaytest(false)} />}
      {exportModal&&<ExportModal data={exportModal} onClose={()=>setExportModal(null)} />}
      {exitModal&&<ExitConfigModal rooms={rooms} currentRoom={selectedRoom} position={exitModal} onConfirm={confirmExit} onClose={()=>setExitModal(null)} />}
      {cloudModal&&user&&<CloudSavesModal user={user} saves={cloudSaves} onSave={handleCloudSave} onLoad={handleCloudLoad} onDelete={handleCloudDelete} onClose={()=>setCloudModal(false)} loading={cloudLoading} />}
      {showBitsyImport&&<BitsyImportModal onImport={handleBitsyImport} onClose={()=>setShowBitsyImport(false)} />}
      {showTextImport&&<TextImportModal onImport={handleTextImport} onClose={()=>setShowTextImport(false)} palette={palette} />}
    </div>
  );
}
