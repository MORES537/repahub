function previewTrack(id){
  const tracksList = globalThis.tracks || [];
  const t = tracksList.find(x => x.id === id);
  if(!t)return;
  // reset all preview buttons
  document.querySelectorAll('.preview-btn').forEach(b => {b.textContent = '▶ 30s Preview';b.classList.remove('playing');});
  if(globalThis.audio){globalThis.audio.pause();globalThis.audio = null;clearTimeout(globalThis.previewTimer);}
  globalThis.audio = new Audio(t.audio);
  globalThis.audio.play().catch(() => toast('Error loading preview','error'));
  globalThis.playing = true;
  document.getElementById('pCover').src = t.cover;
  document.getElementById('pTitle').textContent = t.title + ' — PREVIEW';
  document.getElementById('pArtist').textContent = t.artist;
  document.getElementById('previewLabel').style.display = 'block';
  document.getElementById('playBtn').textContent = '⏸';
  document.getElementById('player').classList.add('active');
  const btn = document.getElementById('prev-' + id);
  if(btn){btn.textContent = '⏸ Playing...';btn.classList.add('playing');}
  globalThis.audio.ontimeupdate = () => {
    if(globalThis.audio.duration){document.getElementById('progFill').style.width = (globalThis.audio.currentTime / globalThis.audio.duration * 100) + '%';}
  };
  // Stop after 30 seconds
  globalThis.previewTimer = setTimeout(() => {
    if(globalThis.audio){globalThis.audio.pause();globalThis.audio = null;}
    globalThis.playing = false;
    document.getElementById('playBtn').textContent = '▶';
    document.getElementById('previewLabel').style.display = 'none';
    document.querySelectorAll('.preview-btn').forEach(b => {b.textContent = '▶ 30s Preview';b.classList.remove('playing');});
    toast(`Want the full track? Buy "${t.title}" NFT for ${Math.round(t.price).toLocaleString()} $RC`,'');
  },30000);
}

function playTrack(id){
  const t = (globalThis.tracks || []).find(x => x.id === id);
  if(!t)return;
  if(!t.owned){toast('Buy this NFT to unlock full playback','error');return;}
  clearTimeout(globalThis.previewTimer);
  if(globalThis.audio){globalThis.audio.pause();globalThis.audio = null;}
  globalThis.audio = new Audio(t.audio);
  globalThis.audio.play().catch(() => toast('Error loading audio','error'));
  globalThis.playing = true;
  document.getElementById('pCover').src = t.cover;
  document.getElementById('pTitle').textContent = t.title;
  document.getElementById('pArtist').textContent = t.artist;
  document.getElementById('previewLabel').style.display = 'none';
  document.getElementById('playBtn').textContent = '⏸';
  document.getElementById('player').classList.add('active');
  globalThis.audio.ontimeupdate = () => {if(globalThis.audio.duration)document.getElementById('progFill').style.width = (globalThis.audio.currentTime / globalThis.audio.duration * 100) + '%';};
  globalThis.audio.onended = () => {globalThis.playing = false;document.getElementById('playBtn').textContent = '▶';};
}

async function buyTrackNft(id){
  if(!globalThis.wallet){toast('Connect your wallet first','error');return;}
  const t = (globalThis.tracks || []).find(x => x.id === id);
  try{
    toast("Approving RC and buying NFT...", "");
    await window.musicNftBuyTrack(id);
    t.unlocked = true;
    t.owned = true;
    if (globalThis.buildMusic) globalThis.buildMusic();
    if (globalThis.buildNFTs) globalThis.buildNFTs();
    if (globalThis.buildMyCollection) globalThis.buildMyCollection();
    toast(t.title + " purchased!", "success");
    playTrack(id);
  } catch(e) {
    console.log("Buy NFT error:", e);
    const classify = globalThis.classifyTxError;
    const category = typeof classify === "function" ? classify(e) : "failure";
    if(category === "rejected"){
      toast("Transaction rejected by user", "error");
      return;
    }
    if(category === "network"){
      toast("Network error - check transaction in HashPack/HashScan", "error");
      return;
    }
    const details = (e && (e.shortMessage || e.message)) || "Unknown error";
    toast(`Transaction failed: ${details}. Verify in HashPack/HashScan.`, "error");
  }
}

function buildMusic(){
  const list = globalThis.tracks || [];
  const el = document.getElementById('musicList');
  if(!el)return;
  if(globalThis.tracksLoading){
    el.innerHTML = `<div class="loading-panel"><div class="spinner"></div><div>Loading tracks from blockchain...</div></div>`;
    return;
  }
  if(globalThis.tracksLoadError){
    el.innerHTML = `<div class="loading-panel error">Failed to load tracks. Please refresh.</div>`;
    return;
  }
  el.innerHTML = list.map((t,i) => `
    <div class="music-item">
      <div class="music-num">${i + 1}</div>
      <img class="music-cover" src="${t.cover}" alt="${t.title}" onerror="this.style.background='var(--dark4)'">
      <div class="music-info">
        <div class="music-title">${t.title}</div>
        <div class="music-artist">${t.artist} · ${t.genre}</div>
      </div>
      <div class="music-right">
        <button class="preview-btn" id="prev-${t.id}" onclick="previewTrack(${t.id})">▶ 30s Preview</button>
        ${t.owned
          ? `<div class="music-own-actions"><div class="unlocked-badge">✓ Owned</div><button class="btn-sm green" onclick="playTrack(${t.id})">▶ Play</button><a class="btn-sm" href="${t.audio}" target="_blank" rel="noopener noreferrer" download>⬇ Download</a></div>`
          : `<div class="music-buy-actions"><div class="music-price">${Math.round(t.price).toLocaleString()} $RC</div><button class="btn-sm" onclick="buyTrackNft(${t.id})">Buy NFT</button></div>`
        }
      </div>
    </div>`).join('');
}

function togglePlay(){
  if(!globalThis.audio)return;
  if(globalThis.playing){globalThis.audio.pause();globalThis.playing = false;document.getElementById('playBtn').textContent = '▶';}
  else{globalThis.audio.play();globalThis.playing = true;document.getElementById('playBtn').textContent = '⏸';}
}

function closePlayer(){
  if(globalThis.audio){globalThis.audio.pause();globalThis.audio = null;}clearTimeout(globalThis.previewTimer);
  document.getElementById('player').classList.remove('active');
  globalThis.playing = false;document.getElementById('progFill').style.width = '0%';
  document.querySelectorAll('.preview-btn').forEach(b => {b.textContent = '▶ 30s Preview';b.classList.remove('playing');});
}

window.previewTrack = previewTrack;
window.playTrack = playTrack;
window.buyTrackNft = buyTrackNft;
window.togglePlay = togglePlay;
window.closePlayer = closePlayer;
window.buildMusic = buildMusic;
globalThis.buildMusic = buildMusic;
buildMusic();
