const $ = (selector) => document.querySelector(selector);
const api = "/api";
const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const money = (value) => `${Number(value || 0).toLocaleString("fr-FR")} FCFA`;
const cleanUrl = (value) => { try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } };

async function getStore() {
  const response = await fetch(`${api}/store`);
  if (!response.ok) throw new Error("Impossible de charger les produits. Vérifie la configuration de la boutique.");
  return response.json();
}
function whatsappUrl(number, product) {
  const digits = String(number || "").replace(/\D/g, "");
  if (!digits) return "#contact";
  const message = product ? `Bonjour, je souhaite commander : ${product.name} (${money(product.price)}).` : "Bonjour, je souhaite en savoir plus sur votre boutique.";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
function renderProducts(products, whatsapp) {
  const target = $("#products");
  if (!products.length) { target.innerHTML = '<p class="notice">La collection arrive bientôt. Revenez nous voir !</p>'; return; }
  target.innerHTML = products.map(product => {
    const image = cleanUrl(product.image);
    const sizes = String(product.sizes || "").split(",").map(item => item.trim()).filter(Boolean);
    return `<article class="product-card"><div class="product-photo">${image ? `<img loading="lazy" src="${safe(image)}" alt="${safe(product.name)}">` : '<div class="photo-placeholder">DIAMOND</div>'}</div><div class="product-info"><div class="product-title"><h3>${safe(product.name)}</h3><span>${safe(money(product.price))}</span></div><p>${safe(product.description || "Une pièce sélectionnée avec soin.")}</p>${sizes.length ? `<div class="sizes">${sizes.map(size => `<span>${safe(size)}</span>`).join("")}</div>` : ""}<a class="button order-button" href="${safe(whatsappUrl(whatsapp, product))}" ${whatsapp ? 'target="_blank" rel="noopener noreferrer"' : ""}>Commander sur WhatsApp <span aria-hidden="true">↗</span></a></div></article>`;
  }).join("");
}
async function startStore() {
  $("#year").textContent = new Date().getFullYear();
  try {
    const data = await getStore();
    const settings = data.settings || {};
    const brand = settings.brand || "DIAMOND";
    $("#brand").innerHTML = `${safe(brand)}<span>.</span>`;
    $("#footerBrand").innerHTML = `${safe(brand)}<span>.</span>`;
    for (const selector of ["#headerWhatsApp", "#contactWhatsApp"]) {
      const link = $(selector); link.href = whatsappUrl(settings.whatsapp); if (settings.whatsapp) { link.target = "_blank"; link.rel = "noopener noreferrer"; }
    }
    const heroImage = cleanUrl(settings.heroImage);
    const heroVideo = cleanUrl(settings.heroVideo);
    if (heroVideo) $("#heroVisual").innerHTML = `<video class="hero-media" src="${safe(heroVideo)}" autoplay muted loop playsinline poster="${safe(heroImage)}"></video>`;
    else if (heroImage) $("#heroVisual").innerHTML = `<img class="hero-media" src="${safe(heroImage)}" alt="Collection DIAMOND">`;
    renderProducts(data.products || [], settings.whatsapp);
  } catch (error) { $("#products").innerHTML = `<p class="notice">${safe(error.message)}</p>`; }
}
document.addEventListener("DOMContentLoaded", startStore);
