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
function renderProducts(products, whatsapp) {
  const target = $("#products");
  if (!products.length) { target.innerHTML = '<p class="notice">La collection arrive bientôt. Revenez nous voir !</p>'; return; }
  target.innerHTML = products.map((product, index) => {
    const image = cleanUrl(product.image);
    const sizes = String(product.sizes || "").split(/[\s,]+/).map(item => item.trim()).filter(Boolean);
    const colors = String(product.colors || "").split(/[\s,]+/).map(item => item.trim()).filter(Boolean);
    const hasSizes = sizes.length > 0;
    const hasColors = colors.length > 0;
    const needsChoice = hasSizes || hasColors;
    const prompt = hasColors ? "Choisis ta couleur" : hasSizes ? "Choisis ta taille" : "";
    return `<article class="product-card" data-product-index="${index}"><div class="product-photo">${image ? `<img loading="lazy" src="${safe(image)}" alt="${safe(product.name)}">` : '<div class="photo-placeholder">DIAMOND</div>'}</div><div class="product-info"><div class="product-title"><h3>${safe(product.name)}</h3><span>${safe(money(product.price))}</span></div><p>${safe(product.description || "")}</p>${hasColors ? `<div class="sizes color-options" aria-label="Couleurs disponibles"><span>Couleurs</span>${colors.map(color => `<button class="color-option" type="button" data-color="${safe(color)}" aria-pressed="false">${safe(color)}</button>`).join("")}</div>` : ""}${hasSizes ? `<div class="sizes size-options" aria-label="Tailles disponibles"><span>Tailles</span>${sizes.map(size => `<button class="size-option" type="button" data-size="${safe(size)}" aria-pressed="false">${safe(size)}</button>`).join("")}</div>` : ""}<p class="size-prompt" ${needsChoice ? "" : "hidden"}>${safe(prompt)}</p><button class="button order-button" type="button" ${needsChoice ? "disabled" : ""}>Commander</button></div></article>`;
  }).join("");

  target.addEventListener("click", (event) => {
    const card = event.target.closest(".product-card");
    if (!card || !target.contains(card)) return;
    const choiceButton = event.target.closest(".size-option, .color-option");
    if (choiceButton) {
      const selector = choiceButton.classList.contains("size-option") ? ".size-option" : ".color-option";
      card.querySelectorAll(selector).forEach(button => {
        const selected = button === choiceButton;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      const product = products[Number(card.dataset.productIndex)];
      const missingColor = String(product.colors || "").trim() && !card.querySelector(".color-option.is-selected");
      const missingSize = String(product.sizes || "").trim() && !card.querySelector(".size-option.is-selected");
      const prompt = card.querySelector(".size-prompt");
      prompt.hidden = !missingColor && !missingSize;
      prompt.textContent = missingColor ? "Choisis ta couleur" : missingSize ? "Choisis ta taille" : "";
      card.querySelector(".order-button").disabled = Boolean(missingColor || missingSize);
      return;
    }

    const orderButton = event.target.closest(".order-button");
    if (!orderButton || orderButton.disabled) return;
    const product = products[Number(card.dataset.productIndex)];
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
