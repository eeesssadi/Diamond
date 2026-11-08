const $ = (selector) => document.querySelector(selector);
const api = "/api";
const KEY_NAME = "diamond_admin_key";
const MAX_PHOTOS_PER_COLOR = 4;
const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const money = (value) => `${Number(value || 0).toLocaleString("fr-FR")} DH`;
const splitColors = (value) => {
  const text = String(value || "").trim();
  if (!text) return [];
  return (text.includes(",") ? text.split(",") : text.split(/\s+/)).map(item => item.trim()).filter(Boolean);
};
let products = [];
let key = sessionStorage.getItem(KEY_NAME) || "";
const setStatus = (message, error = false) => { $("#status").textContent = message; $("#status").classList.toggle("error", error); };

async function callAdmin(payload) {
  const response = await fetch(`${api}/admin`, { method: "POST", headers: { "content-type": "application/json", "x-key": key }, body: JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "La demande a échoué.");
  return result;
}

async function loadAdmin() {
  if (!key) { setStatus("Entre ta clé administrateur pour commencer."); return; }
  try {
    const response = await fetch(`${api}/store`);
    if (!response.ok) throw new Error("La base D1 n’est pas disponible. Vérifie les réglages Cloudflare.");
    const data = await response.json();
    products = data.products || [];
    const settings = data.settings || {};
    $("#brandInput").value = settings.brand || "DIAMOND";
    $("#whatsappInput").value = settings.whatsapp || "";
    $("#heroImageInput").value = settings.heroImage || "";
    $("#heroVideoInput").value = settings.heroVideo || "";
    renderAdminProducts();
    setStatus("Boutique chargée. Tu peux modifier les produits et les réglages.");
  } catch (error) { setStatus(error.message, true); }
}

function photoGroups(product) {
  const colors = splitColors(product.colors);
  const groups = new Map([["", []]]);
  colors.forEach(color => groups.set(color, []));
  if (product.image) groups.get("").push({ image: product.image, primary: true });
  (product.images || []).forEach(item => {
    const color = String(item.color || "").trim();
    if (!groups.has(color)) groups.set(color, []);
    groups.get(color).push({ image: item.image, id: item.id, primary: false });
  });
  return groups;
}

function renderAdminProducts() {
  const target = $("#adminProducts");
  if (!products.length) { target.innerHTML = '<p class="notice">Aucun produit pour le moment.</p>'; return; }
  target.innerHTML = products.map(product => {
    const groups = photoGroups(product);
    const groupsHtml = Array.from(groups.entries()).filter(([, photos]) => photos.length).map(([color, photos]) => {
      const thumbs = photos.map(photo => `<div class="admin-photo"><img src="${safe(photo.image)}" alt="Photo de ${safe(product.name)}"><button class="button button-danger" data-remove-image="${Number(product.id)}" ${photo.primary ? 'data-primary="true"' : `data-image-id="${Number(photo.id)}"`} type="button" aria-label="Supprimer cette photo">×</button></div>`).join("");
      return `<div class="admin-photo-group"><span class="admin-photo-label">${safe(color || "Toutes les couleurs")}</span><div class="admin-photos">${thumbs}</div></div>`;
    }).join("");
    const colorOptions = ['<option value="">Toutes les couleurs</option>', ...splitColors(product.colors).map(color => `<option value="${safe(color)}">${safe(color)}</option>`)].join("");
    return `<div class="admin-product"><div class="admin-product-details"><strong>${safe(product.name)}</strong><span>${safe(money(product.price))}</span>${groupsHtml}</div><div class="actions"><select class="photo-color" aria-label="Couleur des photos à ajouter">${colorOptions}</select><button class="button button-quiet" data-photo="${Number(product.id)}" type="button">Choisir une photo</button><button class="button button-quiet" data-edit="${Number(product.id)}" type="button">Modifier</button><button class="button button-danger" data-delete="${Number(product.id)}" type="button">Supprimer</button></div></div>`;
  }).join("");
}

function resetForm() { $("#productId").value = ""; $("#productFormTitle").textContent = "Ajouter un produit"; }

function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, 700 / image.naturalWidth);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) { reject(new Error("Impossible de traiter cette photo.")); return; }
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Impossible d’ouvrir cette image.")); };
    image.src = objectUrl;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const style = document.createElement("style");
  style.textContent = ".admin-photo-group{margin-top:8px}.admin-photo-label{display:block;font-size:12px;color:var(--muted);margin-bottom:4px}.photo-color{padding:9px;border:1px solid var(--line);background:var(--white);font:inherit;font-size:13px;border-radius:3px;max-width:100%}";
  document.head.append(style);

  $("#adminKey").value = key;
  $("#saveKey").addEventListener("click", async () => { key = $("#adminKey").value.trim(); sessionStorage.setItem(KEY_NAME, key); await loadAdmin(); });
  $("#logout").addEventListener("click", () => { key = ""; sessionStorage.removeItem(KEY_NAME); $("#adminKey").value = ""; setStatus("Clé effacée de cette session."); });
  $("#saveSettings").addEventListener("click", async () => {
    try {
      await callAdmin({ action: "settings", brand: $("#brandInput").value, whatsapp: $("#whatsappInput").value, heroImage: $("#heroImageInput").value, heroVideo: $("#heroVideoInput").value });
      setStatus("Réglages enregistrés.");
    } catch (error) { setStatus(error.message, true); }
  });
  $("#productForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = $("#productId").value;
    const currentProduct = id ? products.find(item => Number(item.id) === Number(id)) : null;
    const payload = { action: id ? "update" : "add", id: id ? Number(id) : undefined, name: $("#productName").value, price: $("#productPrice").value, description: $("#productDescription").value, sizes: $("#productSizes").value, colors: $("#productColors").value, image: $("#productImage").value || currentProduct?.image || "", video: $("#productVideo").value };
    try { await callAdmin(payload); event.target.reset(); resetForm(); await loadAdmin(); setStatus("Produit enregistré."); }
    catch (error) { setStatus(error.message, true); }
  });
  $("#cancelEdit").addEventListener("click", () => setTimeout(resetForm));
  $("#adminProducts").addEventListener("click", async (event) => {
    const photo = event.target.closest("[data-photo]");
    const removeImage = event.target.closest("[data-remove-image]");
    const edit = event.target.closest("[data-edit]");
    const remove = event.target.closest("[data-delete]");
    if (photo) {
      const picker = $("#productPhotoPicker");
      const select = photo.closest(".admin-product")?.querySelector(".photo-color");
      picker.dataset.productId = photo.dataset.photo;
      picker.dataset.color = select ? select.value : "";
      picker.value = "";
      picker.click();
      return;
    }
    if (removeImage) {
      try {
        await callAdmin({ action: "deleteImage", productId: Number(removeImage.dataset.removeImage), primary: removeImage.dataset.primary === "true", imageId: Number(removeImage.dataset.imageId) || undefined });
        await loadAdmin();
        setStatus("Photo supprimée.");
      } catch (error) { setStatus(error.message, true); }
      return;
    }
    if (edit) {
      const product = products.find(item => Number(item.id) === Number(edit.dataset.edit));
      if (!product) return;
      $("#productId").value = product.id;
      $("#productName").value = product.name || "";
      $("#productPrice").value = product.price || 0;
      $("#productDescription").value = product.description || "";
      $("#productSizes").value = product.sizes || "";
      $("#productColors").value = product.colors || "";
      $("#productImage").value = /^https?:\/\//i.test(product.image || "") ? product.image : "";
      $("#productVideo").value = product.video || "";
      $("#productFormTitle").textContent = `Modifier : ${product.name}`;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (remove && window.confirm("Supprimer ce produit ? Cette action est définitive.")) {
      try { await callAdmin({ action: "delete", id: Number(remove.dataset.delete) }); await loadAdmin(); setStatus("Produit supprimé."); }
      catch (error) { setStatus(error.message, true); }
    }
  });
  $("#productPhotoPicker").addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const product = products.find(item => Number(item.id) === Number(event.target.dataset.productId));
    if (!product) { setStatus("Produit introuvable. Recharge la boutique et réessaie.", true); return; }
    const color = String(event.target.dataset.color || "");
    const label = color || "Toutes les couleurs";
    try {
      const used = color
        ? (product.images || []).filter(item => String(item.color || "").trim() === color).length
        : (product.image ? 1 : 0) + (product.images || []).filter(item => !String(item.color || "").trim()).length;
      const selectedFiles = files.slice(0, Math.max(0, MAX_PHOTOS_PER_COLOR - used));
      if (!selectedFiles.length) throw new Error(`« ${label} » a déjà 4 photos (maximum).`);
      if (selectedFiles.some(file => !file.type.startsWith("image/"))) throw new Error("Choisis uniquement des fichiers image.");
      setStatus("Réduction et enregistrement des photos…");
      for (const file of selectedFiles) {
        const image = await resizePhoto(file);
        await callAdmin({ action: "addImage", productId: Number(product.id), image, color });
      }
      await loadAdmin();
      const ignored = files.length - selectedFiles.length;
      setStatus(`${selectedFiles.length} photo${selectedFiles.length > 1 ? "s" : ""} enregistrée${selectedFiles.length > 1 ? "s" : ""} pour « ${label} ».${ignored > 0 ? ` ${ignored} ignorée${ignored > 1 ? "s" : ""} (maximum 4 par couleur).` : ""}`);
    } catch (error) { setStatus(error.message, true); }
  });
  if (key) loadAdmin();
});
