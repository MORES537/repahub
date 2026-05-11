const APP_URL = "https://repahub.vercel.app";

function buildShareData(t) {
  const title  = t?.title  || "RepaHub Track";
  const artist = t?.artist || "RepaHub Artist";
  const price  = t?.price  ? `${Math.round(t.price).toLocaleString()} $RC` : "";
  const text   = `🎵 "${title}" by ${artist} — Original Reparto Cubano music NFT on @RepaHub${price ? `. Unlock for ${price}` : ""}! #RepaHub #RepartoCubano #Hedera #NFT`;
  return { title, text, url: APP_URL };
}

function toggleShareMenu(id, e) {
  e.stopPropagation();
  const menu = document.getElementById(`share-menu-${id}`);
  if (!menu) return;
  const isOpen = menu.classList.contains("open");
  document.querySelectorAll(".share-dropdown.open").forEach(m => m.classList.remove("open"));
  if (!isOpen) menu.classList.add("open");
}

document.addEventListener("click", () => {
  document.querySelectorAll(".share-dropdown.open").forEach(m => m.classList.remove("open"));
});

function shareTrack(id, platform, e) {
  e.stopPropagation();
  const t = (globalThis.tracks || []).find(x => x.id === id);
  const { text, url } = buildShareData(t);
  const encoded    = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(url);

  const targets = {
    x:        `https://twitter.com/intent/tweet?text=${encoded}&url=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encoded}%20${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encoded}`
  };

  if (platform === "copy") {
    navigator.clipboard.writeText(`${text}\n${url}`)
      .then(() => globalThis.toast("Link copied!", "success"))
      .catch(() => globalThis.toast("Could not copy link", "error"));
  } else if (targets[platform]) {
    window.open(targets[platform], "_blank", "noopener,noreferrer");
  }
  document.querySelectorAll(".share-dropdown.open").forEach(m => m.classList.remove("open"));
}

function shareButtonHtml(id) {
  return `<div class="share-wrap">
    <button class="btn-sm" onclick="toggleShareMenu(${id},event)" title="Share this track">↗ Share</button>
    <div class="share-dropdown" id="share-menu-${id}">
      <button class="share-option" onclick="shareTrack(${id},'x',event)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        Post on X
      </button>
      <button class="share-option" onclick="shareTrack(${id},'whatsapp',event)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.528 5.845L.057 23.5l5.83-1.527A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.006-1.373l-.36-.214-3.72.976.993-3.62-.234-.373A9.818 9.818 0 0112 2.182c5.42 0 9.818 4.398 9.818 9.818S17.42 21.818 12 21.818z"/></svg>
        Share on WhatsApp
      </button>
      <button class="share-option" onclick="shareTrack(${id},'telegram',event)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
        Share on Telegram
      </button>
      <button class="share-option" onclick="shareTrack(${id},'copy',event)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copy Link
      </button>
    </div>
  </div>`;
}

window.toggleShareMenu  = toggleShareMenu;
window.shareTrack       = shareTrack;
globalThis.shareButtonHtml = shareButtonHtml;
