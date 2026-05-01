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

// Load real logo
const LOGO_URL = "assets/logo/repahub-logo.png";
// We'll use a data URI approach for the logo — use the RepaHub logo from the user
const RH_LOGO = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/320px-Camponotus_flavomarginatus_ant.jpg";

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

function syncStats(){
  const totalTracksEl = document.getElementById("statTracks");
  if(totalTracksEl){
    totalTracksEl.textContent = String(tracks.length || 0);
  }
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
    return `${APP_CONFIG.pinataGateway}/ipfs/${value.replace("ipfs://","")}`;
  }
  return value;
}

async function loadTracksFromChain(){
  globalThis.tracksLoading = true;
  globalThis.tracksLoadError = null;
  buildFeatured();
  if(typeof globalThis.buildMusic === "function") globalThis.buildMusic();
  buildNFTs();
  buildMyCollection();
  try{
    const chainTracks = await globalThis.musicNftGetAllTracks();
    const mapped = await Promise.all(chainTracks.map(async (track) => {
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
      return {
        id: Number(track.id),
        title: track.title || metadata.name || `Track #${track.id}`,
        artist: metadata.creator || "RepaHub Original",
        genre: genreAttr?.value || "Reparto Cubano",
        price: Number(track.priceRC || 0),
        cover: normalizeIpfsUrl(metadata.image),
        audio: normalizeIpfsUrl(metadata.properties?.audio),
        audioHash: track.audioHash,
        metadataCID: metadataCid,
        artist_address: track.artist || track.creator,
        owner_address: track.currentOwner || track.owner,
        unlocked: false,
        owned: false
      };
    }));
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

function openUpload(){if(!globalThis.wallet){toast('Connect your wallet to upload music','error');return;}document.getElementById('uploadModal').classList.add('open');}
function closeUpload(){document.getElementById('uploadModal').classList.remove('open');}
function submitTrack(){
  const t = document.getElementById('trackTitle').value,p = document.getElementById('trackPrice').value;
  if(!t || !p){toast('Fill in all fields','error');return;}
  closeUpload();toast('Signing upload with your wallet...','');
  setTimeout(() => {
    tracks.unshift({id:Date.now(),title:t,artist:'You',genre:document.getElementById('trackGenre').value || 'Reparto',price:parseInt(p,10),cover:'',audio:'',unlocked:true,owned:true});
    if(typeof globalThis.buildMusic === "function") globalThis.buildMusic();
    buildFeatured();
    buildNFTs();
    buildMyCollection();
    toast(`"${t}" is now live on RepaHub!`,'success');nav('music');
  },2000);
}

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

// LOGO — load real RepaHub logo
(function loadLogo(){
  const img = new Image();
  img.onload = () => {
    document.getElementById('logoFallback').style.display = 'none';
    const el = document.getElementById('navLogo');
    el.src = img.src;
    el.style.display = 'block';
  };
  img.onerror = () => {document.getElementById('logoFallback').style.display = 'flex';};
  img.src = LOGO_URL;
})();

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
window.openUpload = openUpload;
window.closeUpload = closeUpload;
window.submitTrack = submitTrack;
window.refreshOnChainStatus = refreshOnChainStatus;
window.toast = toast;
