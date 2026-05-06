const RC_PER_HBAR = globalThis.APP_CONFIG.rcPerHbar;

globalThis.wallet = globalThis.wallet || null;
var walletRcBalance = 0;
var onChainStatusTimer = null;
var audio = null;
var playing = false;
var previewTimer = null;
var tracks = [];
globalThis.audio = audio;
globalThis.playing = playing;
globalThis.previewTimer = previewTimer;
globalThis.tracks = tracks;
globalThis.tracksLoading = false;
globalThis.tracksLoadError = null;


function nav(id){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  const idx = {home:0,music:1,nfts:2,buy:3,hub:4};
  document.querySelectorAll('.nav-links a').forEach((a,i) => a.classList.toggle('active',i === idx[id]));
  if(id === 'buy'){
    refreshOnChainStatus();
    if(onChainStatusTimer)clearInterval(onChainStatusTimer);
    onChainStatusTimer = setInterval(refreshOnChainStatus,30000);
  }else if(onChainStatusTimer){
    clearInterval(onChainStatusTimer);
    onChainStatusTimer = null;
  }
}

function buildFeatured(){
  const featuredGrid = document.getElementById('featuredGrid');
  if(!featuredGrid)return;
  if(globalThis.tracksLoading){
    featuredGrid.innerHTML = `<div class="loading-panel"><div class="spinner"></div><div>Loading tracks from blockchain...</div></div>`;
    return;
  }
  if(globalThis.tracksLoadError){
    featuredGrid.innerHTML = `<div class="loading-panel error">Failed to load tracks. Please refresh.</div>`;
    return;
  }
  if(!tracks.length){
    featuredGrid.innerHTML = `<div class="loading-panel">No tracks found on-chain.</div>`;
    return;
  }
  featuredGrid.innerHTML = tracks.map(t => `
    <div class="feat-card">
      <img class="feat-cover" src="${t.cover}" alt="${t.title}" onerror="this.style.background='var(--dark4)'">
      <div class="feat-info">
        <div class="feat-name">${t.title}</div>
        <div class="feat-artist">${t.artist} · ${t.genre}</div>
        <div class="feat-footer">
          <button class="preview-btn" id="prev-${t.id}" onclick="previewTrack(${t.id})">▶ 30s Preview</button>
          <div class="feat-price">${Math.round(t.price).toLocaleString()} $RC</div>
        </div>
      </div>
    </div>`).join('');
}

function shortAddress(address){
  if(!address || typeof address !== "string") return "Unknown";
  if(address.length <= 12) return address;
  return `${address.slice(0,6)}...${address.slice(-4)}`;
}

/**
 * Format creator/artist field: if it looks like a wallet address, shorten it;
 * otherwise return as-is.
 */
function formatArtistName(creator){
  if(!creator || typeof creator !== "string") return "RepaHub Artist";
  // Hedera account ID: 0.0.XXXXX
  if(/^0\.0\.\d+$/.test(creator.trim())) return shortAddress(creator.trim());
  // EVM address: 0x...
  if(/^0x[a-fA-F0-9]{40}$/.test(creator.trim())) return shortAddress(creator.trim());
  return creator;
}
globalThis.formatArtistName = formatArtistName;

function syncStats(){
  const count = tracks.length || 0;
  const totalTracksEl = document.getElementById("statTracks");
  if(totalTracksEl) totalTracksEl.textContent = String(count);

  const nftsEl = document.getElementById("statNFTs");
  if(nftsEl) nftsEl.textContent = count > 0 ? count.toLocaleString() : "—";

  const minPriceEl = document.getElementById("statMinPrice");
  if(minPriceEl){
    if(count > 0){
      const min = Math.min(...tracks.map(t => Number(t.price) || 0).filter(p => p > 0));
      minPriceEl.textContent = isFinite(min) ? Math.round(min).toLocaleString() : "—";
    } else {
      minPriceEl.textContent = "—";
    }
  }

  const rcRateEl = document.getElementById("statRcRate");
  if(rcRateEl) rcRateEl.textContent = (APP_CONFIG.rcPerHbar || 2000).toLocaleString();
}

function buildMyCollection(){
  const section = document.getElementById("myCollectionSection");
  const collectionGrid = document.getElementById("myCollectionGrid");
  if(!section || !collectionGrid)return;

  if(!globalThis.wallet){
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  const mine = tracks.filter(t => t.owned);
  if(!mine.length){
    collectionGrid.innerHTML = `<div class="loading-panel">You don't own any tracks yet. Buy your first NFT!</div>`;
    return;
  }
  collectionGrid.innerHTML = mine.map((t) => `
    <div class="feat-card">
      <img class="feat-cover" src="${t.cover}" alt="${t.title}" onerror="this.style.background='var(--dark4)'">
      <div class="feat-info">
        <div class="feat-name">${t.title}</div>
        <div class="feat-artist">${t.artist}</div>
        <div class="feat-footer">
          <button class="btn-sm green" onclick="playTrack(${t.id})">▶ Play</button>
          <a class="btn-sm" href="${t.audio}" target="_blank" rel="noopener noreferrer" download>⬇ Download</a>
        </div>
      </div>
    </div>
  `).join("");
}

function buildNFTs(filter = 'all'){
  const nftGrid = document.getElementById('nftGrid');
  if(!nftGrid)return;
  if(globalThis.tracksLoading){
    nftGrid.innerHTML = `<div class="loading-panel"><div class="spinner"></div><div>Loading tracks from blockchain...</div></div>`;
    return;
  }
  if(globalThis.tracksLoadError){
    nftGrid.innerHTML = `<div class="loading-panel error">Failed to load tracks. Please refresh.</div>`;
    return;
  }
  const list = (filter === 'all' || filter === 'legendary') ? tracks : [];
  nftGrid.innerHTML = list.map(t => {
    const isMine = Boolean(t.owned);
    const ownerLabel = isMine ? "You own this ✓" : `Owner: ${shortAddress(t.owner_address || t.artist_address)}`;
    const canBuy = !isMine;
    return `
    <div class="nft-card legendary">
      <div class="nft-img nft-cover-wrap">
        <img class="nft-cover" src="${t.cover}" alt="${t.title}" onerror="this.style.background='var(--dark4)'">
        <div class="rarity-badge legendary">Legendary</div>
      </div>
      <div class="nft-info">
        <div class="nft-name">${t.title}</div>
        <div class="nft-edition">${t.artist} · 1 of 1</div>
        <div class="nft-owner ${isMine ? "mine" : ""}">${ownerLabel}</div>
        <div class="nft-footer">
          <div class="nft-price">${Math.round(t.price).toLocaleString()} $RC<small>${(t.price / RC_PER_HBAR).toFixed(2)} HBAR</small></div>
          ${canBuy
            ? `<button class="btn-sm" onclick="buyTrackNft(${t.id})">Buy NFT</button>`
            : `<button class="btn-sm" onclick="playTrack(${t.id})">Play</button>`
          }
        </div>
      </div>
    </div>`;
  }).join('');
}

function normalizeIpfsUrl(value){
  if(!value || typeof value !== "string") return "";
  if(value.startsWith("ipfs://")){
    const cid = value.replace("ipfs://","");
    return `${APP_CONFIG.pinataGateway}/ipfs/${cid}`;
  }
  return value;
}

// Resolve an ipfs:// or gateway URL to a signed URL when possible
async function resolveMediaUrl(value){
  if(!value || typeof value !== "string") return "";
  let cid = null;
  if(value.startsWith("ipfs://")) cid = value.replace("ipfs://","");
  else if(value.includes("/ipfs/")) cid = value.split("/ipfs/")[1]?.split("?")[0];
  if(cid && typeof globalThis.pinataSignedUrl === "function"){
    try{
      const signed = await globalThis.pinataSignedUrl(cid);
      if(signed) return signed;
    }catch(_){}
  }
  return normalizeIpfsUrl(value);
}
globalThis.resolveMediaUrl = resolveMediaUrl;

async function loadTracksFromChain(){
  globalThis.tracksLoading = true;
  globalThis.tracksLoadError = null;
  buildFeatured();
  if(typeof globalThis.buildMusic === "function") globalThis.buildMusic();
  buildNFTs();
  buildMyCollection();
  try{
    const chainTracks = await globalThis.musicNftGetAllTracks();
    const mapped = (await Promise.all(chainTracks.map(async (track) => {
      const metadataCid = track.metadataCID || track.metadataCid || "";
      let metadata = {};
      try{
        metadata = metadataCid ? await globalThis.fetchMetadata(metadataCid) : {};
      }catch(err){
        console.log("Metadata fetch failed:", err && (err.message || err));
      }
      const genreAttr = Array.isArray(metadata.attributes)
        ? metadata.attributes.find((a) => a && a.trait_type === "Genre")
        : null;
      // status: 0=Listed, 1=Sold, 2=Removed, 3=Cancelled — hide removed/cancelled
      if (track.status === 2 || track.status === 3) return null;

      const coverUrl = await resolveMediaUrl(metadata.image || "");
      const audioUrl = await resolveMediaUrl(metadata.properties?.audio || "");
      return {
        id: Number(track.id),
        title: track.title || metadata.name || `Track #${track.id}`,
        artist: formatArtistName(metadata.creator) || "RepaHub Original",
        genre: genreAttr?.value || "Reparto Cubano",
        price: Number(track.priceRC || 0),
        cover: coverUrl,
        audio: audioUrl,
        audioHash: track.audioHash,
        metadataCID: metadataCid,
        artist_address: track.artist || track.creator,
        owner_address: track.currentOwner || track.owner,
        status: track.status,
        unlocked: false,
        owned: false
      };
    }))).filter(Boolean);
    tracks = mapped;
    globalThis.tracks = tracks;
    syncStats();
    buildFeatured();
    if(typeof globalThis.buildMusic === "function") globalThis.buildMusic();
    buildNFTs();
    if(globalThis.wallet){
      await checkOwnedTracks();
    }else{
      buildMyCollection();
    }
  }catch(e){
    globalThis.tracksLoadError = e;
    console.log("Failed loading tracks from chain:", e && (e.message || e));
    buildFeatured();
    if(typeof globalThis.buildMusic === "function") globalThis.buildMusic();
    buildNFTs();
  }finally{
    globalThis.tracksLoading = false;
    buildFeatured();
    if(typeof globalThis.buildMusic === "function") globalThis.buildMusic();
    buildNFTs();
    buildMyCollection();
  }
}

async function checkOwnedTracks(){
  if(!globalThis.wallet || !Array.isArray(tracks) || !tracks.length){
    buildMyCollection();
    return;
  }
  for(const t of tracks){
    try{
      const owned = await globalThis.musicNftCheckOwnership(globalThis.wallet, t.id);
      t.owned = Boolean(owned);
      t.unlocked = t.owned;
    }catch(err){
      t.owned = false;
      t.unlocked = false;
      console.log("Ownership check failed:", t.id, err && (err.message || err));
    }
  }
  if(typeof globalThis.buildMusic === "function") globalThis.buildMusic();
  buildNFTs();
  buildMyCollection();
}

function calcRC(){
  const h = parseFloat(document.getElementById('hbarIn').value) || 0;
  document.getElementById('rcOut').textContent = h > 0 ? (h * RC_PER_HBAR).toLocaleString() + ' $RC' : '— $RC';
  document.getElementById('rcIn').value = '';
  document.getElementById('hbarOut').textContent = '— HBAR';
}

function calcHBAR(){
  const r = parseFloat(document.getElementById('rcIn').value) || 0;
  document.getElementById('hbarOut').textContent = r > 0 ? (r / RC_PER_HBAR).toFixed(4) + ' HBAR' : '— HBAR';
  document.getElementById('hbarIn').value = '';
  document.getElementById('rcOut').textContent = '— $RC';
}

function updateWalletButtonDisplay(address,hbarBalance,rcBalance){
  const shortAddr = address.slice(0,6) + '...' + address.slice(-4);
  const rcText = Number(rcBalance || 0).toLocaleString();
  document.getElementById('walletBtn').textContent = `${shortAddr} | ${rcText} RC`;
  document.getElementById('walletBtn').title = `${hbarBalance} HBAR`;
}
window.updateWalletButtonDisplay = updateWalletButtonDisplay;

async function refreshOnChainStatus(){
  const priceEl = document.getElementById('onChainPrice');
  const supplyEl = document.getElementById('onChainSupply');
  if(!priceEl || !supplyEl)return;
  let pausedWarnEl = document.getElementById('onChainPausedWarn');
  if(!pausedWarnEl){
    pausedWarnEl = document.createElement('div');
    pausedWarnEl.id = 'onChainPausedWarn';
    pausedWarnEl.style.color = '#ff8a80';
    pausedWarnEl.style.fontSize = '0.78rem';
    pausedWarnEl.style.marginTop = '0.5rem';
    supplyEl.parentElement?.parentElement?.appendChild(pausedWarnEl);
  }
  pausedWarnEl.textContent = '';
  priceEl.textContent = 'Loading...';
  supplyEl.textContent = 'Loading...';
  try{
    const saleInfo = await globalThis.hederaGetSaleInfo();
    priceEl.textContent = `${saleInfo.pricePerRCHbar.toFixed(6)} HBAR per RC`;
    supplyEl.textContent = `${saleInfo.rcBalance.toLocaleString()} RC | Treasury HBAR: ${saleInfo.hbarBalance.toLocaleString(undefined, {maximumFractionDigits: 4})}`;
    if(saleInfo.paused){
      pausedWarnEl.textContent = 'Sale is currently paused';
    }
  }catch(e){
    console.log("Sale info fetch failed:", e && (e.message || e));
    priceEl.textContent = '—';
    supplyEl.textContent = '—';
    pausedWarnEl.textContent = 'Unable to load on-chain sale info';
  }
}

async function buyRC(){
  if(!globalThis.wallet){toast('Connect your wallet first','error');return;}
  const h = parseFloat(document.getElementById('hbarIn').value) || parseFloat((document.getElementById('rcIn').value || 0) / RC_PER_HBAR);
  if(!h || h <= 0){toast('Enter a valid amount','error');return;}
  if(h < APP_CONFIG.topUpMinHbar){toast('Minimum 0.01 HBAR','error');return;}
  if(h > APP_CONFIG.topUpMaxHbar){toast('Maximum 25 HBAR per transaction','error');return;}
  try{
    toast(`Submitting transaction for ${(h * RC_PER_HBAR).toLocaleString()} $RC...`,'');
    const tx = await window.hederaBuyTokens(h);
    const txId = tx?.transactionId || tx?.hash || "pending";
    toast(`Transaction sent: ${String(txId).slice(0,18)}...`,'');
    try{
      walletRcBalance = await globalThis.getRCBalance(globalThis.wallet);
      if(window.updateWalletMenu){
        window.updateWalletMenu(globalThis.wallet);
      }
    }catch(ignoreErr){}
    toast(`Transaction submitted to HashPack for ${(h * RC_PER_HBAR).toLocaleString()} $RC`,'success');
  }catch(e){
    const category = classifyTxError(e);
    if(category === "rejected"){
      toast('Transaction rejected by user','error');
      return;
    }
    const msg = String((e && (e.shortMessage || e.message)) || '').toLowerCase();
    if(msg.includes('insufficient funds') || msg.includes('insufficient balance')){
      toast('Insufficient HBAR for value + gas','error');
      return;
    }
    if(category === "network"){
      toast('Network error - check transaction in HashPack/HashScan','error');
      return;
    }
    const details = (e && (e.shortMessage || e.message)) || "Unknown error";
    toast(`Transaction failed: ${details}. Verify in HashPack/HashScan.`, 'error');
  }
}

async function buyNFT(name, price) {
  if (!globalThis.wallet) {
    toast("Connect your wallet to buy NFTs", "error");
    return;
  }
  try {
    toast("Sending " + price + " RC for NFT...", "");
    await window.hederaPayWithRC(price, "NFT purchase: " + name);
    toast("NFT purchased!", "success");
  } catch(e) {
    const category = classifyTxError(e);
    if(category === "rejected"){
      toast("Transaction rejected by user", "error");
      return;
    }
    if(category === "network"){
      toast("Network error - check transaction in HashPack/HashScan", "error");
      return;
    }
    const details = (e && (e.shortMessage || e.message)) || "Unknown error";
    toast(`Purchase failed: ${details}. Verify in HashPack/HashScan.`, "error");
  }
}

async function buyTrackNft(trackId) {
  if (!globalThis.wallet) {
    toast("Connect your wallet first", "error");
    return;
  }
  try {
    toast("Step 1/3: Associating NFT collection (if needed)...", "info");
    // The 3-step flow happens inside musicNftBuyTrack
    await musicNftBuyTrack(trackId);
    toast("NFT purchased successfully! 🎉", "success");
    await loadTracksFromChain();
  } catch (e) {
    console.error("buyTrackNft error:", e);
    const msg = e?.message || "Unknown error";
    if (msg.includes("reject") || msg.includes("cancel")) {
      toast("Transaction cancelled", "error");
    } else {
      toast(`Purchase failed: ${msg}`, "error");
    }
  }
}

function openUpload(){
  if(!globalThis.wallet){toast('Connect your wallet to upload music','error');return;}
  document.getElementById('uploadModal').classList.add('open');
}
function closeUpload(){
  document.getElementById('uploadModal').classList.remove('open');
}

async function submitTrack(){
  const title = document.getElementById('trackTitle').value.trim();
  const artistName = (document.getElementById('trackArtist')?.value || '').trim();
  const priceStr = document.getElementById('trackPrice').value;
  const genre = (document.getElementById('trackGenre').value || 'Reparto Cubano').trim();
  const audioInput = document.getElementById('trackAudio');
  const audioFile = audioInput && audioInput.files && audioInput.files[0];
  const coverInput = document.getElementById('trackCover');
  const coverFile = coverInput && coverInput.files && coverInput.files[0] || null;

  if(!title){toast('Enter a track title','error');return;}
  if(!artistName){toast('Enter your artist name','error');return;}
  if(!priceStr || parseFloat(priceStr) <= 0){toast('Enter a valid price in $RC','error');return;}
  if(!audioFile){toast('Select an audio file','error');return;}

  const priceRC = parseFloat(priceStr);
  const submitBtn = document.querySelector('#uploadModal .btn-primary');
  if(submitBtn) submitBtn.disabled = true;

  try{
    await globalThis.performUpload(title, genre, priceRC, audioFile, coverFile, artistName);
    closeUpload();
    toast(`"${title}" is now live on RepaHub!`, 'success');
    // Reset form
    document.getElementById('trackTitle').value = '';
    const artistInput = document.getElementById('trackArtist');
    if(artistInput) artistInput.value = '';
    document.getElementById('trackPrice').value = '';
    document.getElementById('trackGenre').value = '';
    if(audioInput) audioInput.value = '';
    if(coverInput) coverInput.value = '';
    document.getElementById('trackAudioLabel').textContent = 'Click to select audio file (MP3, WAV, FLAC)';
    document.getElementById('trackCoverLabel').textContent = 'Cover image (optional — JPG, PNG, WEBP)';
    await loadTracksFromChain();
    nav('music');
  }catch(e){
    console.error("submitTrack error:", e);
    const msg = (e && e.message) || "Unknown error";
    if(msg.includes('reject') || msg.includes('cancel')){
      toast('Transaction cancelled', 'error');
    } else {
      toast(`Upload failed: ${msg}`, 'error');
    }
  }finally{
    if(submitBtn) submitBtn.disabled = false;
  }
}

// Update file label when user picks a file
(function wireAudioInput(){
  function attach(){
    const audioInput = document.getElementById('trackAudio');
    if(!audioInput) return;
    audioInput.addEventListener('change', () => {
      const f = audioInput.files && audioInput.files[0];
      const label = document.getElementById('trackAudioLabel');
      if(label) label.textContent = f ? `${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)` : 'Click to select audio file (MP3, WAV, FLAC)';
    });
    const coverInput = document.getElementById('trackCover');
    if(coverInput){
      coverInput.addEventListener('change', () => {
        const f = coverInput.files && coverInput.files[0];
        const label = document.getElementById('trackCoverLabel');
        if(label) label.textContent = f ? `${f.name} (${(f.size / 1024).toFixed(0)} KB)` : 'Cover image (optional — JPG, PNG, WEBP)';
      });
    }
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();

function toast(msg,type){
  const el = document.getElementById('toast');
  el.textContent = msg;el.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(el._t);el._t = setTimeout(() => el.classList.remove('show'),4000);
}

function classifyTxError(error){
  const code = error && error.code;
  const msg = String((error && (error.shortMessage || error.message)) || "").toLowerCase();
  if(code === 4001 || code === "ACTION_REJECTED" || msg.includes("rejected")){
    return "rejected";
  }
  if(
    msg.includes("503") ||
    msg.includes("grpc-web.myhbarwallet.com") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("failed to fetch") ||
    msg.includes("service unavailable") ||
    msg.includes("relay")
  ){
    return "network";
  }
  return "failure";
}

// Logo is handled directly in HTML via <img onerror> — no JS needed.

syncStats(); // show RC rate immediately before chain data loads
loadTracksFromChain();

globalThis.nav = nav;
globalThis.buildFeatured = buildFeatured;
globalThis.buildNFTs = buildNFTs;
globalThis.calcRC = calcRC;
globalThis.calcHBAR = calcHBAR;
globalThis.buyRC = buyRC;
globalThis.buyNFT = buyNFT;
globalThis.openUpload = openUpload;
globalThis.closeUpload = closeUpload;
globalThis.submitTrack = submitTrack;
globalThis.refreshOnChainStatus = refreshOnChainStatus;
globalThis.toast = toast;
globalThis.classifyTxError = classifyTxError;
globalThis.loadTracksFromChain = loadTracksFromChain;
globalThis.checkOwnedTracks = checkOwnedTracks;
globalThis.buildMyCollection = buildMyCollection;
window.nav = nav;
window.buildNFTs = buildNFTs;
window.calcRC = calcRC;
window.calcHBAR = calcHBAR;
window.buyRC = buyRC;
window.buyNFT = buyNFT;
window.buyTrackNft = buyTrackNft;
window.openUpload = openUpload;
window.closeUpload = closeUpload;
window.submitTrack = submitTrack;
window.refreshOnChainStatus = refreshOnChainStatus;
window.toast = toast;
