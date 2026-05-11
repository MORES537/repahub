const APP_URL = "https://repahub.vercel.app";

function openShareModal(id) {
  const t = (globalThis.tracks || []).find(x => x.id === id);
  if (!t) return;

  const title  = t.title  || "RepaHub Track";
  const artist = t.artist || "RepaHub Artist";
  const price  = t.price  ? `${Math.round(t.price).toLocaleString()} $RC` : "";
  const text   = `🎵 "${title}" by ${artist} — Original Reparto Cubano music NFT on @RepaHub${price ? `. Unlock for ${price}` : ""}! #RepaHub #RepartoCubano #Hedera #NFT`;
  const url    = APP_URL;

  document.getElementById("shareModalTitle").textContent = title;
  document.getElementById("shareModalSub").textContent   = `by ${artist}${price ? " · " + price : ""}`;

  const encoded    = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(url);

  document.getElementById("shareBtnX").onclick = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encoded}&url=${encodedUrl}`, "_blank", "noopener,noreferrer");
    closeShareModal();
  };
  document.getElementById("shareBtnWA").onclick = () => {
    window.open(`https://wa.me/?text=${encoded}%20${encodedUrl}`, "_blank", "noopener,noreferrer");
    closeShareModal();
  };
  document.getElementById("shareBtnTG").onclick = () => {
    window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encoded}`, "_blank", "noopener,noreferrer");
    closeShareModal();
  };
  document.getElementById("shareBtnCopy").onclick = () => {
    navigator.clipboard.writeText(`${text}\n${url}`)
      .then(() => globalThis.toast("Link copied!", "success"))
      .catch(() => globalThis.toast("Could not copy", "error"));
    closeShareModal();
  };

  document.getElementById("shareModal").classList.add("open");
}

function closeShareModal() {
  document.getElementById("shareModal").classList.remove("open");
}

function shareButtonHtml(id) {
  return `<button class="btn-sm" onclick="openShareModal(${id})" title="Share this track">↗ Share</button>`;
}

window.openShareModal  = openShareModal;
window.closeShareModal = closeShareModal;
globalThis.shareButtonHtml = shareButtonHtml;
