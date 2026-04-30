import { HashConnect } from 'hashconnect';
import { LedgerId } from '@hashgraph/sdk';

const appMetadata = {
  name: "RepaHub",
  description: "The Digital Home of Reparto Cubano",
  icons: ["http://localhost:3000/assets/logo/repahub-logo.png"],
  url: "http://localhost:3000"
};

let hashconnect = null;
let pairingData = null;

function ensureWalletMenu(){
  const walletBtn = document.getElementById("walletBtn");
  if(!walletBtn)return;

  let wrap = walletBtn.closest(".wallet-wrap");
  if(!wrap){
    wrap = document.createElement("div");
    wrap.className = "wallet-wrap";
    walletBtn.parentNode.insertBefore(wrap, walletBtn);
    wrap.appendChild(walletBtn);
  }

  let menu = document.getElementById("walletMenu");
  if(!menu){
    menu = document.createElement("div");
    menu.id = "walletMenu";
    menu.className = "wallet-menu";
    menu.innerHTML = `
      <div class="wallet-row" id="walletAccountRow">Not connected</div>
      <button type="button" class="wallet-act" id="walletCopyBtn">Copy Address</button>
      <a class="wallet-link" id="walletHashscanLink" target="_blank" rel="noopener noreferrer">
        <button type="button" class="wallet-act">View on HashScan</button>
      </a>
      <button type="button" class="wallet-act disconnect" id="walletDisconnectBtn">Disconnect</button>
    `;
    wrap.appendChild(menu);

    menu.addEventListener("click", (e) => e.stopPropagation());
    document.getElementById("walletCopyBtn").addEventListener("click", async () => {
      if(!globalThis.wallet)return;
      await navigator.clipboard.writeText(globalThis.wallet);
      toast("Address copied", "success");
    });
    document.getElementById("walletDisconnectBtn").addEventListener("click", disconnectWallet);
  }

  return menu;
}

function updateWalletMenu(accountId){
  const menu = ensureWalletMenu();
  if(!menu)return;
  document.getElementById("walletAccountRow").textContent = accountId || "Not connected";
  const hashscan = document.getElementById("walletHashscanLink");
  hashscan.href = accountId ? `https://hashscan.io/mainnet/account/${accountId}` : "#";
}

function toggleWalletMenu(){
  const menu = ensureWalletMenu();
  if(!menu)return;
  menu.classList.toggle("open");
}

function closeWalletMenu(){
  const menu = document.getElementById("walletMenu");
  if(menu)menu.classList.remove("open");
}

async function initHashConnect() {
  hashconnect = new HashConnect(
    LedgerId.MAINNET,
    APP_CONFIG.reownProjectId,
    appMetadata,
    false
  );

  hashconnect.pairingEvent.on((newPairing) => {
    pairingData = newPairing;
    const accountId = newPairing.accountIds[0];
    globalThis.wallet = accountId;
    document.getElementById("walletBtn").textContent = accountId + " | HashPack";
    document.getElementById("walletBtn").classList.add("connected");
    updateWalletMenu(accountId);
    toast("Wallet connected: " + accountId, "success");
  });

  hashconnect.disconnectionEvent.on(() => {
    pairingData = null;
    globalThis.wallet = null;
    document.getElementById("walletBtn").textContent = "Connect Wallet";
    document.getElementById("walletBtn").classList.remove("connected");
    updateWalletMenu(null);
    closeWalletMenu();
  });

  await hashconnect.init();
  window.hashconnect = hashconnect;
}

async function disconnectWallet(){
  try{
    if(hashconnect){
      await hashconnect.disconnect();
    }
  }catch(e){
    // ignore disconnect API differences across versions
  }
  pairingData = null;
  globalThis.wallet = null;
  document.getElementById("walletBtn").textContent = "Connect Wallet";
  document.getElementById("walletBtn").classList.remove("connected");
  updateWalletMenu(null);
  closeWalletMenu();
  toast("Wallet disconnected", "success");
}

async function connectWallet() {
  if (!hashconnect) await initHashConnect();
  if (globalThis.wallet) {
    toggleWalletMenu();
    return;
  }
  hashconnect.openPairingModal();
}

window.connectWallet = connectWallet;
window.updateWalletMenu = updateWalletMenu;

document.addEventListener("click", (e) => {
  const wrap = document.querySelector(".wallet-wrap");
  if(wrap && !wrap.contains(e.target)){
    closeWalletMenu();
  }
});

ensureWalletMenu();
initHashConnect();
