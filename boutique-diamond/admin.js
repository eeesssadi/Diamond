const $ = (selector) => document.querySelector(selector);
const api = "/api";
const KEY_NAME = "diamond_admin_key";
const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const money = (value) => `${Number(value || 0).toLocaleString("fr-FR")} DH`;
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

function renderAdminProducts() {
  const target = $("#adminProducts");
  if (!products.length) { target.innerHTML = '<p class="notice">Aucun produit pour le moment.</p>'; return; }
  target.innerHTML = products.map(product => `<div class="admin-product"><div><strong>${safe(product.name)}</strong><span>${safe(money(product.price))}</span></div><div class="actions"><button class="button button-quiet" data-photo="${Number(product.id)}" type="button">Choisir une photo</button><button class="button button-quiet" data-edit="${Number(product.id)}" type="button">Modifier</button><button class="button button-danger" data-delete="${Number(product.id)}" type="button">Supprimer</button></div></div>`).join("");
}

function resetForm() { $("#productId").value = ""; $("#productFormTitle").textContent = "Ajouter un produit"; }

function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, 800 / image.naturalWidth);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) { reject(new Error("Impossible de traiter cette photo.")); return; }
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Impossible d’ouvrir cette image.")); };
    image.src = objectUrl;
  });
}

document.addEventListener("DOMContentLoaded", () => {
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
    const edit = event.target.closest("[data-edit]");
    const remove = event.target.closest("[data-delete]");
    if (photo) {
      const picker = $("#productPhotoPicker");
      picker.dataset.productId = photo.dataset.photo;
      picker.value = "";
      picker.click();
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
    const file = event.target.files?.[0];
    if (!file) return;
    const product = products.find(item => Number(item.id) === Number(event.target.dataset.productId));
    if (!product) { setStatus("Produit introuvable. Recharge la boutique et réessaie.", true); return; }
    try {
      if (!file.type.startsWith("image/")) throw new Error("Choisis un fichier image.");
      setStatus("Réduction et enregistrement de la photo…");
      const image = await resizePhoto(file);
      await callAdmin({ action: "update", id: Number(product.id), name: product.name, price: product.price, description: product.description || "", sizes: product.sizes || "", colors: product.colors || "", image, video: product.video || "" });
      await loadAdmin();
      setStatus("Photo du produit enregistrée.");
    } catch (error) { setStatus(error.message, true); }
  });
  if (key) loadAdmin();
});
