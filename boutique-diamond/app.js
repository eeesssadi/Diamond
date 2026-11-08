const $ = (selector) => document.querySelector(selector);
const api = "/api";
const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const money = (value) => `${Number(value || 0).toLocaleString("fr-FR")} DH`;
const cleanUrl = (value) => {
  const imageData = String(value || "");
  if (/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(imageData)) return imageData;
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
};

async function getStore() {
  const response = await fetch(`${api}/store`);
  if (!response.ok) throw new Error("Impossible de charger les produits. Vérifie la configuration de la boutique.");
  return response.json();
}
function whatsappUrl(number, product, size) {
  const digits = String(number || "").replace(/\D/g, "");
  if (!digits) return "#contact";
  const message = product
    ? (size
      ? `Bonjour, je souhaite commander : ${product.name} (${money(product.price)}), taille ${size}.`
      : `Bonjour, je souhaite commander : ${product.name} (${money(product.price)}).`)
    : "Bonjour, je souhaite en savoir plus sur votre boutique.";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
function addSizeSelectionStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .sizes button { border: 1px solid var(--line); padding: 5px 9px; background: transparent; color: var(--muted); font: inherit; font-size: 11px; cursor: pointer; }
    .sizes button.is-selected { border-color: var(--ink); background: var(--ink); color: var(--white); }
    .size-prompt { color: #a7352c; font-size: 12px; margin: 8px 0 0; }
    .order-button:disabled { opacity: .55; cursor: not-allowed; }
  `;
  document.head.append(style);
}
function renderProducts(products, whatsapp) {
  const target = $("#products");
  if (!products.length) { target.innerHTML = '<p class="notice">La collection arrive bientôt. Revenez nous voir !</p>'; return; }
  target.innerHTML = products.map((product, index) => {
    const image = cleanUrl(product.image);
    const sizes = String(product.sizes || "").split(/[\s,]+/).map(item => item.trim()).filter(Boolean);
    const hasSizes = sizes.length > 0;
    return `<article class="product-card" data-product-index="${index}"><div class="product-photo">${image ? `<img loading="lazy" src="${safe(image)}" alt="${safe(product.name)}">` : '<div class="photo-placeholder">DIAMOND</div>'}${product.video ? `<video class="product-video" src="${safe(cleanUrl(product.video))}" controls playsinline></video>` : ""}</div><div class="product-info"><div class="product-title"><h3>${safe(product.name)}</h3><strong>${safe(money(product.price))}</strong></div><p>${safe(product.description || "")}</p>${hasSizes ? `<div class="sizes" role="group" aria-label="Choisir une taille">${sizes.map(size => `<button type="button" class="size-option" data-size="${safe(size)}" aria-pressed="false">${safe(size)}</button>`).join("")}</div><p class="size-prompt">Choisis ta taille</p>` : ""}<button class="button button-small order-button" type="button" ${hasSizes ? "disabled" : ""}>Commander</button></div></article>`;
  }).join("");

  target.addEventListener("click", (event) => {
    const card = event.target.closest(".product-card");
    if (!card || !target.contains(card)) return;
    const sizeButton = event.target.closest(".size-option");
    if (sizeButton) {
      card.querySelectorAll(".size-option").forEach(button => {
        const selected = button === sizeButton;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      card.querySelector(".size-prompt").hidden = true;
      card.querySelector(".order-button").disabled = false;
      return;
    }

    const orderButton = event.target.closest(".order-button");
    if (!orderButton || orderButton.disabled) return;
    const product = products[Number(card.dataset.productIndex)];
    if (String(product.sizes || "").trim()) {
      const selectedSize = card.querySelector(".size-option.is-selected");
      if (!selectedSize) {
        card.querySelector(".size-prompt").hidden = false;
        return;
      }
      const url = whatsappUrl(whatsapp, product, selectedSize.dataset.size);
      if (url === "#contact") window.location.hash = "contact";
      else window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    const url = whatsappUrl(whatsapp, product);
    if (url === "#contact") window.location.hash = "contact";
    else window.open(url, "_blank", "noopener,noreferrer");
  });
}
async function startStore() {
  $("#year").textContent = new Date().getFullYear();
  addSizeSelectionStyles();
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
