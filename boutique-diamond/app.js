const $ = (selector) => document.querySelector(selector);
const api = "/api";
const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const money = (value) => `${Number(value || 0).toLocaleString("fr-FR")} DH`;
const cleanUrl = (value) => {
  const imageData = String(value || "");
  if (/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(imageData)) return imageData;
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
};
const splitColors = (value) => {
  const text = String(value || "").trim();
  if (!text) return [];
  return (text.includes(",") ? text.split(",") : text.split(/\s+/)).map(item => item.trim()).filter(Boolean);
};
const splitSizes = (value) => String(value || "").split(/[\s,]+/).map(item => item.trim()).filter(Boolean);
const sameColor = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

async function getStore() {
  const response = await fetch(`${api}/store`);
  if (!response.ok) throw new Error("Impossible de charger les produits. Vérifie la configuration de la boutique.");
  return response.json();
}
function whatsappUrl(number, product, color, size) {
  const digits = String(number || "").replace(/\D/g, "");
  if (!digits) return "#contact";
  const choices = [];
  if (color) choices.push(`couleur ${color}`);
  if (size) choices.push(`taille ${size}`);
  const message = product
    ? `Bonjour, je souhaite commander : ${product.name} (${money(product.price)})${choices.length ? `, ${choices.join(", ")}` : ""}.`
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

// Photos à afficher pour un produit.
// - color donnée : les photos de cette couleur, ou null s'il n'y en a pas (on garde l'affichage actuel).
// - aucune couleur : les photos de la première couleur qui en a, sinon les photos « Toutes les couleurs ».
function photosFor(product, color) {
  const extra = product.images || [];
  const clean = (list) => list.map(cleanUrl).filter(Boolean);
  const forColor = (name) => clean(extra.filter(item => sameColor(item.color, name)).map(item => item.image));
  if (color) {
    const list = forColor(color);
    return list.length ? list : null;
  }
  for (const name of splitColors(product.colors)) {
    const list = forColor(name);
    if (list.length) return list;
  }
  return clean([product.image, ...extra.filter(item => !String(item.color || "").trim()).map(item => item.image)]);
}

function showPhotos(card, photos, name) {
  const track = card.querySelector(".product-photo-track");
  const dots = card.querySelector(".photo-dots");
  track.innerHTML = photos.length
    ? photos.map((image, index) => `<div class="product-photo-slide"><img loading="lazy" src="${safe(image)}" alt="${safe(name)}${index ? ` — photo ${index + 1}` : ""}"></div>`).join("")
    : '<div class="product-photo-slide"><div class="photo-placeholder">DIAMOND</div></div>';
  track.scrollLeft = 0;
  dots.innerHTML = photos.length > 1
    ? photos.map((_, index) => `<span class="photo-dot${index === 0 ? " is-active" : ""}" aria-hidden="true"></span>`).join("")
    : "";
}

function renderProducts(products, whatsapp) {
  const target = $("#products");
  if (!products.length) { target.innerHTML = '<p class="notice">La collection arrive bientôt. Revenez nous voir !</p>'; return; }
  target.innerHTML = products.map((product, index) => {
    const sizes = splitSizes(product.sizes);
    const colors = splitColors(product.colors);
    const hasSizes = sizes.length > 0;
    const hasColors = colors.length > 0;
    const needsChoice = hasSizes || hasColors;
    const prompt = hasColors ? "Choisis ta couleur" : hasSizes ? "Choisis ta taille" : "";
    return `<article class="product-card" data-product-index="${index}"><div class="product-photo"><div class="product-photo-track"></div><div class="photo-dots" aria-label="Photos du produit"></div></div><div class="product-info"><div class="product-title"><h3>${safe(product.name)}</h3><span>${safe(money(product.price))}</span></div><p>${safe(product.description || "")}</p>${hasColors ? `<div class="sizes color-options" aria-label="Couleurs disponibles"><span>Couleurs</span>${colors.map(color => `<button class="color-option" type="button" data-color="${safe(color)}" aria-pressed="false">${safe(color)}</button>`).join("")}</div>` : ""}${hasSizes ? `<div class="sizes size-options" aria-label="Tailles disponibles"><span>Tailles</span>${sizes.map(size => `<button class="size-option" type="button" data-size="${safe(size)}" aria-pressed="false">${safe(size)}</button>`).join("")}</div>` : ""}<p class="size-prompt" ${needsChoice ? "" : "hidden"}>${safe(prompt)}</p><button class="button order-button" type="button" ${needsChoice ? "disabled" : ""}>Commander</button></div></article>`;
  }).join("");

  target.querySelectorAll(".product-card").forEach((card) => {
    const product = products[Number(card.dataset.productIndex)];
    showPhotos(card, photosFor(product, "") || [], product.name);
    const track = card.querySelector(".product-photo-track");
    track.addEventListener("scroll", () => {
      requestAnimationFrame(() => {
        const dots = card.querySelectorAll(".photo-dot");
        if (dots.length < 2 || !track.clientWidth) return;
        const index = Math.round(track.scrollLeft / track.clientWidth);
        dots.forEach((dot, dotIndex) => dot.classList.toggle("is-active", dotIndex === index));
      });
    }, { passive: true });
  });

  target.addEventListener("click", (event) => {
    const card = event.target.closest(".product-card");
    if (!card || !target.contains(card)) return;
    const product = products[Number(card.dataset.productIndex)];
    const choiceButton = event.target.closest(".size-option, .color-option");
    if (choiceButton) {
      const isColor = choiceButton.classList.contains("color-option");
      const selector = isColor ? ".color-option" : ".size-option";
      card.querySelectorAll(selector).forEach(button => {
        const selected = button === choiceButton;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      if (isColor) {
        const list = photosFor(product, choiceButton.dataset.color);
        if (list) showPhotos(card, list, product.name);
      }
      const missingColor = splitColors(product.colors).length > 0 && !card.querySelector(".color-option.is-selected");
      const missingSize = splitSizes(product.sizes).length > 0 && !card.querySelector(".size-option.is-selected");
      const prompt = card.querySelector(".size-prompt");
      prompt.hidden = !missingColor && !missingSize;
      prompt.textContent = missingColor ? "Choisis ta couleur" : missingSize ? "Choisis ta taille" : "";
      card.querySelector(".order-button").disabled = Boolean(missingColor || missingSize);
      return;
    }

    const orderButton = event.target.closest(".order-button");
    if (!orderButton || orderButton.disabled) return;
    const selectedColor = card.querySelector(".color-option.is-selected")?.dataset.color;
    const selectedSize = card.querySelector(".size-option.is-selected")?.dataset.size;
    const url = whatsappUrl(whatsapp, product, selectedColor, selectedSize);
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
