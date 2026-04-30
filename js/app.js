const RC_PER_HBAR = globalThis.APP_CONFIG.rcPerHbar;
const TRACKS = [
  {id:1,title:"Bajo El Solar",artist:"RepaHub Original",genre:"Reparto Cubano",price:20000,cover:"assets/covers/bajo-el-solar.png",url:"assets/audio/bajo-el-solar.mp3",unlocked:false},
  {id:2,title:"La Soga Suena",artist:"RepaHub Original",genre:"Reparto Cubano",price:20000,cover:"assets/covers/la-soga-suena.png",url:"assets/audio/la-soga-suena.mp3",unlocked:false},
  {id:3,title:"Receipt for the Bruise",artist:"RepaHub Original",genre:"Reparto Cubano",price:20000,cover:"assets/covers/receipt-for-the-bruise.png",url:"assets/audio/receipt-for-the-bruise.mp3",unlocked:false},
];
const NFTS = [
  {name:"Genesis #001",edition:"1 of 1",rarity:"legendary",price:10000,emoji:"👑",bg:"linear-gradient(135deg,#1a1000,#3a2a00)"},
  {name:"Havana Night #042",edition:"1 of 10",rarity:"epic",price:2000,emoji:"🌃",bg:"linear-gradient(135deg,#1a0033,#330066)"},
  {name:"Street Rhythm #108",edition:"1 of 50",rarity:"rare",price:500,emoji:"🎵",bg:"linear-gradient(135deg,#001a2e,#003a6e)"},
  {name:"Barrio Life #203",edition:"1 of 100",rarity:"rare",price:500,emoji:"🏙️",bg:"linear-gradient(135deg,#001a2e,#003a6e)"},
  {name:"Cuban Vibes #512",edition:"1 of 500",rarity:"common",price:100,emoji:"🇨🇺",bg:"linear-gradient(135deg,#0a1a0a,#1a2e1a)"},
  {name:"Gold Chain #033",edition:"1 of 10",rarity:"epic",price:2000,emoji:"✨",bg:"linear-gradient(135deg,#1a1000,#2a2000)"},
];

globalThis.wallet = globalThis.wallet || null;
var walletRcBalance = 0;
var onChainStatusTimer = null;
var audio = null;
var playing = false;
var previewTimer = null;
var tracks = [...TRACKS];

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
  document.getElementById('featuredGrid').innerHTML = TRACKS.map(t => `
    <div class="feat-card">
      <img class="feat-cover" src="${t.cover}" alt="${t.title}" onerror="this.style.background='var(--dark4)'">
      <div class="feat-info">
        <div class="feat-name">${t.title}</div>
        <div class="feat-artist">${t.artist} · ${t.genre}</div>
        <div class="feat-footer">
          <button class="preview-btn" id="prev-${t.id}" onclick="previewTrack(${t.id})">▶ 30s Preview</button>
          <div class="feat-price">${t.price.toLocaleString()} $RC</div>
        </div>
      </div>
    </div>`).join('');
}

function buildMusic(){
  document.getElementById('musicList').innerHTML = tracks.map((t,i) => `
    <div class="music-item" onclick="playTrack(${t.id})">
      <div class="music-num">${i + 1}</div>
      <img class="music-cover" src="${t.cover}" alt="${t.title}" onerror="this.style.background='var(--dark4)'">
      <div class="music-info"><div class="music-title">${t.title}</div><div class="music-artist">${t.artist} · ${t.genre}</div></div>
      <div class="music-right">
        ${t.unlocked
          ? `<div class="unlocked-badge">✓ Unlocked</div><button class="btn-sm green" onclick="event.stopPropagation();playTrack(${t.id})">Play</button>`
          : `<div class="music-price">${t.price.toLocaleString()} $RC</div><button class="btn-sm" onclick="event.stopPropagation();unlockTrack(${t.id})">Unlock</button>`
        }
      </div>
    </div>`).join('');
}

function buildNFTs(filter = 'all'){
  const list = filter === 'all' ? NFTS : NFTS.filter(n => n.rarity === filter);
  document.getElementById('nftGrid').innerHTML = list.map(n => `
    <div class="nft-card ${n.rarity}">
      <div class="nft-img" style="background:${n.bg}">${n.emoji}<div class="rarity-badge ${n.rarity}">${n.rarity}</div><div class="coming-soon">Coming Soon</div></div>
      <div class="nft-info">
        <div class="nft-name">${n.name}</div>
        <div class="nft-edition">${n.edition}</div>
        <div class="nft-footer">
          <div class="nft-price" style="color:${n.rarity === 'legendary' ? '#ffd600' : n.rarity === 'epic' ? '#c653dd' : n.rarity === 'rare' ? '#00b4d8' : '#7eb3d4'}">${n.price.toLocaleString()} $RC<small>${(n.price / RC_PER_HBAR).toFixed(2)} HBAR</small></div>
          <button class="btn-sm" onclick="toast('NFT mint is coming soon','')">Coming Soon</button>
        </div>
      </div>
    </div>`).join('');
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
    tracks.unshift({id:Date.now(),title:t,artist:'You',genre:document.getElementById('trackGenre').value || 'Reparto',price:parseInt(p,10),cover:'',url:'',unlocked:true});
    buildMusic();toast(`"${t}" is now live on RepaHub!`,'success');nav('music');
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

buildFeatured();
buildMusic();
buildNFTs();

globalThis.nav = nav;
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
