import { useState, useRef, useCallback, useEffect } from "react";

// âââ Constants ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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

// âââ Sound ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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

// âââ Pre-made Asset Packs âââââââââââââââââââââââââââââââââââââââââââââââââââââ
const ASSET_PACKS = [
  {
    name: "ð Bug Pack", color: "#00e436",
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
    name: "âï¸ Fantasy Pack", color: "#ffa300",
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
    name: "ð Space Pack", color: "#29adff",
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
        [0,0,5,5,5,5,0,0],[0,5,5,5,5,5,5,0],[0,5,1,5,5,5,5,0],[0,5,0,5,5,0,5,0],
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
    name: "ð« School Pack", color: "#ff77a8",
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

// âââ Utility ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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

// âââ Styles âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const S = {
  app:{ fontFamily:"'Inter',system-ui,sans-serif", background:"#1a1a2e", color:"#e0e0e0", minHeight:"100vh", display:"flex", flexDirection:"column" },
  header:{ background:"#16213e", padding:"10px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"2px solid #0f3460", gap:12 },
  title:{ fontSize:20, fontWeight:700, color:"#e94560", letterSpacing:1, whiteSpace:"nowrap" },
  main:{ display:"flex", flex:1, overflow:"hidden" },
  sidebar:{ width:256, background:"#16213e", padding:12, overflowY:"auto", borderRight:"2px solid #0f3460", flexShrink:0 },
  center:{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:16, overflow:"auto" },
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

// âââ Pixel Canvas âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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
  const maxD=460, sc=Math.min(maxD/cw,maxD/ch,1);
  const dw=Math.floor(cw*(cw>maxD||ch>maxD?sc:1)), dh=Math.floor(ch*(cw>maxD||ch>maxD?sc:1));
  return <canvas ref={ref} width={cw} height={ch} style={{...S.canvas,width:dw,height:dh}}
    onMouseDown={e=>{drawing.current=true;lastPos.current=null;handle(e,true);}}
    onMouseMove={e=>handle(e)} onMouseUp={()=>{drawing.current=false;lastPos.current=null;}}
    onMouseLeave={()=>{drawing.current=false;lastPos.current=null;}} />;
}

// âââ Mini Canvas ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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

// âââ Room Canvas ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function RoomCanvas({ room, tiles, sprites, palette, roomW, roomH, tileW, tileH, onPlace, roomTool, selectedTileId, selectedSpriteId }) {
  const ref = useRef(null);
  const dragging = useRef(false);
  const ps = Math.max(2, Math.floor(440/Math.max(roomW*tileW,roomH*tileH)));

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
  const maxD=500, sc=Math.min(maxD/cw,maxD/ch,1);
  return <canvas ref={ref} style={{...S.canvas,width:cw*sc,height:ch*sc,cursor:"pointer"}}
    onMouseDown={e=>{dragging.current=true;handle(e,true);}} onMouseMove={e=>handle(e)}
    onMouseUp={()=>dragging.current=false} onMouseLeave={()=>dragging.current=false} />;
}

// âââ PNG Import Modal âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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
          <img src={imgData} alt="preview" style={{maxWidth:180,maxHeight:180'imageRendering:"pixelated",border:"1px solid #333",borderRadius:4}} />
          <div style={{fontSize:11,color:"#888",marginTop:4}}>Original: {preview.width}Ã{preview.height}</div>
        </div>}
        <div style={S.row}><span style={S.label}>Import as:</span>
          <button style={S.btn(importMode==="sprite")} onClick={()=>setImportMode("sprite")}>Sprite/NPC</button>
          <button style={S.btn(importMode==="background")} onClick={()=>setImportMode("background")}>Background Tile</button>
        </div>
        <div style={S.row}><span style={S.label}>Size:</span>
          <input type="number" min={4} max={64} value={targetW} onChange={e=>setTargetW(+e.target.value||8)} style={{...S.input,width:56}} />
          <span>Ã</span>
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

// âââ Exit Config Modal ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function ExitConfigModal({ rooms, currentRoom, position, onConfirm, onClose }) {
  const firstOther = rooms.findIndex((_,i)=>i!==currentRoom);
  const [destRoom, setDestRoom] = useState(firstOther>=0?firstOther:0);
  const [destX, setDestX] = useState(4);
  const [destY, setDestY] = useState(4);
  return (
    <div style={S.modal} onClick={onClose}>
      <div style={{...S.modalContent,maxWidth:340}} onClick={e=>e.stopPropagation()}>
        <h3 style={{margin:"0 0 12px",color:"#e94560"}}>ðª Configure Exit</h3>
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
          <button style={{...S.btn(true),flex:1}} onClick={()=>onConfirm({x:position.x,y:position.y,destRoom,destX,destY})}>â Add Exit</button>
          <button style={{...S.btn(false),flex:1}} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// âââ Tune Editor ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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

  // Show 2 octaves (C4âB5), top = high
  const ROWS = 24;
  return (
    <div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
        <button style={S.btn(playing)} onClick={playing?stopPlay:startPlay}>{playing?"â¹ Stop":"â¶ Play"}</button>
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
      <div style={{fontSize:10,color:"#555",marginTop:5}}>Click cells to place notes Â· Each column = one 16th note step</div>
    </div>
  );
}

// âââ Playtest Modal âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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
          <h3 style={{margin:0,color:"#e94560"}}>â¶ Playtest</h3>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <span style={{fontSize:11,color:"#888",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rooms[roomIdx]?.name}</span>
            <button style={{...S.btn(showInv),fontSize:11}} onClick={()=>setShowInv(v=>!v)}>ð {collected.length}</button>
            <button style={S.btn(false)} onClick={onClose}>â</button>
          </div>
        </div>
        {won ? (
          <div style={{textAlign:"center",padding:32}}>
            <div style={{fontSize:40,marginBottom:12}}>ð</div>
            <div style={{fontSize:22,color:"#ffec27",fontWeight:700,marginBottom:8}}>You Win!</div>
            <div style={{color:"#aaa",marginBottom:16}}>Items collected: {collected.length}</div>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <button style={S.btn(true)} onClick={restart}>âº Play Again</button>
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
                <div style={{fontSize:11,color:"#555",marginTop:6}}>{dialog.pageIdx<dialog.pages.length-1?"Space / âµ to continue â":"Space / âµ to close"}</div>
              </div>
            )}
            {showInv&&(
              <div style={{background:"#0d1b3e",border:"1px solid #0f3460",borderRadius:6,padding:10,marginTop:8}}>
                <div style={{fontSize:11,fontWeight:700,color:"#ffec27",marginBottom:5}}>ð Inventory</div>
                {collected.length===0?<div style={{fontSize:11,color:"#555"}}>Nothing yet.</div>:(
                  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                    {collected.map((it,i)=><span key={i} style={{background:"#1a1a2e",border:"1px solid #333",borderRadius:4,padding:"2px 8px",fontSize:12,color:"#ffec27"}}>{it.name}</span>)}
                  </div>
                )}
              </div>
            )}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:10,fontSize:11,color:"#555",flexWrap:"wrap",gap:4}}>
              <span>Arrow keys to move Â· NPCs talk Â· ð¸ = exit portal</span>
              <span>Rooms: {roomIdx+1}/{rooms.length}</span>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:8}}>
              <button style={S.btn(false)} onClick={restart}>âº Restart</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// âââ Export Bitsy Data ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// Clamp a pixel value to a valid base-36 digit (0â35), guarding against NaN /
// undefined that can appear in imported-JPEG grids due to quantization edge cases.
const safePixel = v => (Number.isFinite(v) ? Math.max(0, Math.min(35, Math.round(v))) : 0);

function exportBitsyData(gameTitle, palette, sprites, tiles, rooms, tune) {
  let out = `${gameTitle || "My Game"}\n\n`;

  // Bitsy 8.x requires these version directive lines or the editor won't parse correctly
  out += `! VER_MAJ 8\n! VER_MIN 12\n! ROOM_FORMAT 1\n! DLG_COMPAT 0\n! TXT_MODE 0\n\n`;

  // ââ PAL ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  out += `PAL 0\n`;
  palette.forEach(hex => { const c = hexToRgb(hex); out += `${c.r},${c.g},${c.b}\n`; });
  out += `\n`;

  // ââ ROOM (must come before TIL and SPR in Bitsy's parse order) âââââââââââ
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
      out += `EXT ${ex.x},${ex.y} ROOM ${ex.destRoom} AT ${ex.destX},${ex.destY}\n`;
    });
    if (room.name) out += `NAME ${room.name}\n`;
    out += `PAL 0\n\n`;
  });

  // ââ TIL ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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

  // ââ SPR ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // sprites[0] â SPR A (avatar/player); sprites[1..n] â SPR a, b, câ¦ (NPCs)
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
    // Find actual room placement from npcs array; fall back to a safe default
    let posRoom = 0, posX = i === 0 ? 4 : (i * 2) % 14, posY = i === 0 ? 4 : 2;
    for (let ri = 0; ri < rooms.length; ri++) {
      const placed = (rooms[ri].npcs || []).find(n => n.spriteId === spr.id);
      if (placed) { posRoom = ri; posX = placed.x; posY = placed.y; break; }
    }
    out += `POS ${posRoom} ${posX},${posY}\n\n`;
  });

  // ââ DLG ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  let dlgOut = 0;
  sprites.forEach((spr, i) => {
    if (i > 0 && spr.dialog) {
      out += `DLG ${dlgOut}\n${spr.dialog}\nEND\n\n`;
      dlgOut++;
    }
  });

  // ââ TUNE (if any steps active) ââââââââââââââââââââââââââââââââââââââââââââ
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

// âââ Export Modal âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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
          <button style={S.btn(false)} onClick={onClose}>â</button>
        </div>

        {data.type === "text" && (
          <>
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>
              Copy this text and paste it into a <code style={{ color: "#ffec27" }}>.txt</code> file, then rename it to <code style={{ color: "#ffec27" }}>.bitsy</code> â or paste it into the Bitsy editor directly.
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
                {copied ? "â Copied!" : "ð Copy All to Clipboard"}
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
              Right-click the image below and choose <b>Save Image Asâ¦</b> to download it.
            </div>
            <div style={{ textAlign: "center", background: "#0d1b3e", borderRadius: 6, padding: 16, marginBottom: 10 }}>
              <img src={data.content} alt={data.title} style={{ imageRendering: "pixelated", maxWidth: "100%", maxHeight: 300, border: "1px solid #333" }} />
            </div>
            <div style={{ fontSize: 11, color: "#666", textAlign: "center" }}>
              Right-click â Save Image Asâ¦ Â· or long-press on mobile
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// âââ ID gen âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
let nextId=1;
function uid(){ return `id_${nextId++}`; }

// âââ Main App âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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

  const [sprites,setSprites]=useState([{id:uid(),name:"avatar",frames:[emptyGrid(8,8)],dialog:"",tileType:"walkable",blip:{Ø]NÜ]X\H\N
_WJNÂÛÛÝÝ[\ËÙ][\×O]\ÙTÝ]JÞÚYZY

K[YNØ[[Y\ÎÙ[\QÜY

WK[U\NØ[WJNÂÛÛÝÜÙ[XÝYÜ]KÙ]Ù[XÝYÜ]WO]\ÙTÝ]J
NÂÛÛÝÜÙ[XÝY[KÙ]Ù[XÝY[WO]\ÙTÝ]J
NÂÛÛÝÜÙ[XÝY[YKÙ]Ù[XÝY[YWO]\ÙTÝ]J
NÂÛÛÝÜÛÛ\ËÙ]ÛÛ\×O]\ÙTÝ]JÞÚYZY

K[YNÛÛH[\Î[\QÜY
MMKX\
OX\


OO[
JKÜÎ×K^]Î×_WJNÂÛÛÝÜÙ[XÝYÛÛKÙ]Ù[XÝYÛÛWO]\ÙTÝ]J
NÂÛÛÝÜÛÛUÛÛÙ]ÛÛUÛÛO]\ÙTÝ]JXÙHNÈËÈXÙH\\ÙH[ÂÛÛÝØ[[Q[YKÙ][[Q[YWO]\ÙTÝ]J
NÂÛÛÝÜ^Z[ËÙ]^Z[×O]\ÙTÝ]J[ÙJNÂ\ÙQYXÝ


OOÈY\^Z[Ê\]\ÈÛÛÝ\Ù][\[


OOÙ][[Q[YJOÌJK
NÈ]\
OOÛX\[\[

NÈKÜ^Z[×JNÂËÈÙ^XØ\ÚÜÝ]Â\ÙQYXÝ


OOÂÛÛÝJJOOÊ      if(e.target.tagName==="INPUT"||e.target.tagName==="SELECT"||e.target.tagName==="TEXTAREA")return;
      switch(e.key.toLowerCase()){
        case"d":setTool("draw");break; case"e":setTool("erase");break;
        case"f":setTool("fill");break; case"g":setShowGrid(v=>!v);break;
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
      setSprites(p=>{setSelectedSprite(p.length);return[...p,t];});
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

  // ââ Exports (modal-based â sandboxed iframes block programmatic downloads) ââ
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
        // Open config modal â we can't do async from here, so set exitModal and bail
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
        <span style={S.title}>ð® Multicolor Bitsy</span>
        <input value={gameTitle} onChange={e=>setGameTitle(e.target.value)}
          style={{...S.input,width:200,fontSize:13}} placeholder="Game title..." />
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <button style={S.btnGreen} onClick={()=>setShowImport(true)}>Import Image</button>
          <button style={S.btn(false)} onClick={()=>setShowPlaytest(true)}>â¶ Test Game</button>
          <button style={S.btn(false)} onClick={exportPng}>PNG</button>
          {currentItem?.frames.length>1&&<button style={S.btn(false)} onClick={exportSpritesheet}>Sheet</button>}
          <button style={S.btn(false)} onClick={exportGameData}>Export .bitsy</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:"#16213e",padding:"0 20px",display:"flex"}}>
        {["sprite","tile","room","tune"].map(t=>(
          <button key={t} style={S.tab(tab===t)} onClick={()=>{setTab(t);setSelectedFrame(0);}}>
            {t==="sprite"?"ð§ Sprites":t==="tile"?"ð¦ Tiles":t==="room"?"ðº Rooms":"ðµ Tune"}
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
                {[["draw","âï¸"],["erase","ð§¹"],["fill","ðª£"]].map(([t,emoji])=>(
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
                <span style={{color:"#888"}}>Ã</span>
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
                {[["place","ð¦ Place"],["erase","ð§¹ Erase"],["fill","ðª£ Fill"],["npc","ð§ NPC"],["exit","ðª Exit"]].map(([t,label])=>(
                  <button key={t} style={S.btn(roomTool===t)} onClick={()=>setRoomTool(t)}>{label}</button>
                ))}
              </div>
              {roomTool==="npc"&&<div style={{fontSize:11,color:"#888",marginTop:6}}>Select a sprite below (not avatar) and click room to place</div>}
              {roomTool==="exit"&&<div style={{fontSize:11,color:"#ff44ee",marginTop:6}}>Click a cell to place an exit portal (pink â¶). Click again to remove.</div>}
              <div style={{marginTop:8,display:"flex",gap:4,alignItems:"center"}}>
                <span style={{fontSize:11,color:"#aaa"}}>Room:</span>
                <select style={S.select} value={roomW} onChange={e=>setRoomW(+e.target.value)}>{[8,12,16,20,24,32].map(v=><option key={v} value={v}>{v}</option>)}</select>
                <span style={{color:"#888"}}>Ã</span>
                <select style={S.select} value={roomH} onChange={e=>setRoomH(+e.target.value)}>{[8,12,16,20,24,32].map(v=><option key={v} value={v}>{v}</option>)}</select>
              </div>
            </div>
          )}

          {/* Find / Search */}
          {tab!=="room"&&tab!=="tune"&&(
            <div style={S.section}>
              <input value={findQuery} onChange={e=>setFindQuery(e.target.value)} placeholder="ð Find by nameâ¦" style={{...S.input,fontSize:11}} />
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

          {/* Tile selector for room mode */}
          {tab==="room"&&(
            <>
              <div style={S.section}>
                <div style={S.sectionTitle}>Tiles</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                  {tiles.map((tile,i)=>(
                    <div key={tile.id} onClick={()=>setSelectedTile(i)}
                      style={{border:i===selectedTile?"2px solid #e94560":"2px solid #444",borderRadius:3,cursor:"pointer",position:"relative"}}>
                      <MiniCanvas grid={tile.frames[0]} palette={palette} size={28} />
                      {tile.tileType&&tile.tileType!=="walkable"&&<div style={{position:"absolute",bottom:0,right:0,fontSize:7,background:TILE_TYPE_COLORS[tile.tileType],color:"#000",padding:"0 2px",fontWeight:700,borderRadius:"2px 0 0 0"}}>{tile.tileType[0]}</div>}
                    </div>
                  ))}
                </div>
              </div>
              <div style={S.section}>
                <div style={S.sectionTitle}>Sprites (NPCs)</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                  {sprites.map((spr,i)=>(
                    <div key={spr.id} onClick={()=>setSelectedSprite(i)}
                      style={{border:i===selectedSprite?"2px solid #e94560":"2px solid #444",borderRadius:3,cursor:"pointer",opacity:i===0?0.5:1}}>
                      <MiniCanvas grid={spr.frames[0]} palette={palette} size={28} />
                    </div>
                  ))}
                </div>
                <div style={{fontSize:10,color:"#666",marginTop:4}}>Sprite 0 (avatar) is the player.</div>
              </div>
            </>
          )}

          {/* Asset Packs */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Asset Packs</div>
            {tab==="sprite"&&selectedSprite===0&&(
              <div style={{fontSize:10,color:"#29adff",background:"#082040",borderRadius:3,padding:"4px 6px",marginBottom:6,border:"1px solid #29adff"}}>
                Avatar selected â clicking a character sprite below will replace the avatar's pixels directly.
              </div>
            )}
            {ASSET_PACKS.map((pack,pi)=>(
              <div key={pi} style={{marginBottom:6}}>
                <button onClick={()=>setActivePack(activePack===pi?null:pi)}
                  style={{...S.btn(activePack===pi),width:"100%",textAlign:"left",marginBottom:2,fontSize:11}}>
                  {pack.name} {activePack===pi?"â²":"â¼"}
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
              <div style={{fontWeight:700,color:"#e94560",marginBottom:12,fontSize:14}}>ðµ Background Tune</div>
              <TuneEditor tune={tune} onChange={setTune} />
              <div style={{marginTop:16,fontSize:11,color:"#555",lineHeight:1.8}}>
                The tune loops in the background while your game is playing.<br/>
                Separate dialog pages with <code style={{color:"#ffec27"}}>---</code> on its own line for multi-page speech.
              </div>
            </div>
          ):tab==="room"?(
            <RoomCanvas room={rooms[selectedRoom]||{tiles:[],npcs:[]}} tiles={tiles} sprites={sprites}
              palette={palette} roomW={roomW} roomH={roomH} tileW={tileW} tileH={tileH}
              onPlace={handleRoomPlace} roomTool={roomTool}
              selectedTileId={tiles[selectedTile]?.id} selectedSpriteId={sprites[selectedSprite]?.id} />
          ):(tab!=="tune"&&(
            <>
              <PixelCanvas grid={currentFrame} palette={palette} onDraw={handleDraw} pixelSize={pixelSize} showGrid={showGrid} />
              {currentItem&&<div style={{marginTop:6,fontSize:11,color:"#888"}}>{currentItem.name} Â· Frame {selectedFrame+1}/{currentItem.frames.length} Â· {itemW}Ã{itemH}</div>}
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

              {/* Set as Avatar â shown on any non-avatar sprite */}
              {tab==="sprite"&&selectedSprite===0&&(
                <div style={{background:"#0d1b3e",border:"1px solid #1a1a5e",borderRadius:4,padding:"6px 10px",marginBottom:12,fontSize:11,color:"#888"}}>
                  ð§ <b style={{color:"#e94560"}}>This is the Avatar</b> â the player character.<br/>
                  To set its look: select it here, then click any character sprite in an Asset Pack below to replace its pixels instantly.
                </div>
              )}
              {tab==="sprite"&&selectedSprite>0&&(
                <div style={{marginBottom:12}}>
                  <button style={{...S.btn(false),width:"100%",fontSize:11,background:"#082040",borderColor:"#29adff",color:"#29adff"}}
                    onClick={()=>setAsAvatar(selectedSprite)}>
                    ð¤ Set as Avatar (replace player appearance)
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
                      {t==="walkable"?"ð¢":t==="wall"?"ð´":t==="item"?"ð¡":"ðµ"} {t}
                    </button>
                  ))}
                </div>
                <div style={{fontSize:10,color:"#666",marginTop:4}}>
                  ð¢ walkable Â· ð´ wall (blocks player) Â· ð¡ item (collect it!) Â· ðµ end (win the game)
                </div>
              </div>

              {/* Dialog (sprites only) */}
              {tab==="sprite"&&(
                <div style={S.section}>
                  <div style={S.sectionTitle}>NPC Dialog</div>
                  <textarea value={currentItem.dialog||""} onChange={e=>updateDialog(e.target.value)}
                    placeholder="What does this character say? Separate pages with --- on its own line."
                    style={{...S.input,height:64,resize:"vertical",fontFamily:"inherit"}} />
                  <div style={{fontSize:10,color:"#666",marginTop:3}}>Separate pages with <code>---</code> Â· Sprite 0 is the player â dialog ignored.</div>
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
                    â¶ Preview Blip
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
                      {playing?"â¹ Stop":"â¶ Play"}
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
                      {t==="walkable"?"ð¢":t==="wall"?"ð´":t==="item"?"ð¡":"ðµ"} {t}
                      {t==="wall"?" â blocks player":t==="item"?" â collected on touch":t==="end"?" â triggers win":""}
                    </div>
                  ))}
                </div>
              </div>
              {(rooms[selectedRoom]?.exits||[]).length>0&&(
                <div style={S.section}>
                  <div style={S.sectionTitle}>Exits ({rooms[selectedRoom].exits.length})</div>
                  {rooms[selectedRoom].exits.map((ex,i)=>(
                    <div key={i} style={{fontSize:11,color:"#ff44ee",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3,background:"#0d1b3e",borderRadius:3,padding:"3px 6px"}}>
                      <span>({ex.x},{ex.y}) â Room {ex.destRoom} @ ({ex.destX},{ex.destY})</span>
                      <button style={{background:"none",border:"none",color:"#e94560",cursor:"pointer",fontSize:12,padding:"0 2px"}}
                        onClick={()=>setRooms(prev=>{const rs=[...prev];rs[selectedRoom]={...rs[selectedRoom],exits:rs[selectedRoom].exits.filter((_,j)=>j!==i)};return rs;})}>â</button>
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
              D draw Â· E erase Â· F fill Â· G grid<br/>1â9 select color
            </div>
          </div>
        </div>
      </div>

      {showImport&&<PngImportModal onImport={handleImport} onClose={()=>setShowImport(false)} palette={palette} maxColors={MAX_COLORS} />}
      {showPlaytest&&<PlaytestModal rooms={rooms} startRoom={selectedRoom} tiles={tiles} sprites={sprites}
        palette={palette} roomW={roomW} roomH={roomH} tileW={tileW} tileH={tileH} tune={tune} onClose={()=>setShowPlaytest(false)} />}
      {exportModal&&<ExportModal data={exportModal} onClose={()=>setExportModal(null)} />}
      {exitModal&&<ExitConfigModal rooms={rooms} currentRoom={selectedRoom} position={exitModal} onConfirm={confirmExit} onClose={()=>setExitModal(null)} />}
    </div>
  );
}
