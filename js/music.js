function previewTrack(id){
  const tracksList = globalThis.tracks || [];
  const t = tracksList.find(x => x.id === id);
  if(!t)return;
  // reset all preview buttons
  document.querySelectorAll('.preview-btn').forEach(b => {b.textContent = '▶ 30s Preview';b.classList.remove('playing');});
  if(globalThis.audio){globalThis.audio.pause();globalThis.audio = null;clearTimeout(globalThis.previewTimer);}
  globalThis.audio = new Audio(t.url);
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
    toast(`Want the full track? Unlock "${t.title}" for ${t.price.toLocaleString()} $RC`,'');
  },30000);
}

function playTrack(id){
  const t = (globalThis.tracks || []).find(x => x.id === id);
  if(!t)return;
  if(!t.unlocked){unlockTrack(id);return;}
  clearTimeout(globalThis.previewTimer);
  if(globalThis.audio){globalThis.audio.pause();globalThis.audio = null;}
  globalThis.audio = new Audio(t.url);
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

async function unlockTrack(id){
  if(!globalThis.wallet){toast('Connect your wallet first','error');return;}
  const t = (globalThis.tracks || []).find(x => x.id === id);
  try{
    toast("Sending " + t.price + " RC to unlock...", "");
    await window.hederaPayWithRC(t.price, "Unlock track: " + t.title);
    t.unlocked = true;
    buildMusic();
    toast(t.title + " unlocked!", "success");
    playTrack(id);
  } catch(e) {
    console.log("Unlock error:", e);
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
window.unlockTrack = unlockTrack;
window.togglePlay = togglePlay;
window.closePlayer = closePlayer;
