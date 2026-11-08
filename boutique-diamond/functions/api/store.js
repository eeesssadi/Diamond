const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

async function ensureTables(db) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT '', price REAL NOT NULL DEFAULT 0, description TEXT NOT NULL DEFAULT '', sizes TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '', video TEXT NOT NULL DEFAULT '')"),
    db.prepare("CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL DEFAULT '')"),
    db.prepare("CREATE TABLE IF NOT EXISTS product_images (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, image TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0)")
  ]);

  const columns = (await db.prepare("PRAGMA table_info(products)").all()).results.map(column => column.name);
  for (const [name, type] of [
    ["description", "TEXT NOT NULL DEFAULT ''"],
    ["sizes", "TEXT NOT NULL DEFAULT ''"],
    ["colors", "TEXT NOT NULL DEFAULT ''"],
    ["image", "TEXT NOT NULL DEFAULT ''"],
    ["video", "TEXT NOT NULL DEFAULT ''"]
  ]) {
    if (!columns.includes(name)) {
      await db.prepare(`ALTER TABLE products ADD COLUMN ${name} ${type}`).run();
    }
  }

  const imageColumns = (await db.prepare("PRAGMA table_info(product_images)").all()).results.map(column => column.name);
  if (!imageColumns.includes("color")) {
    await db.prepare("ALTER TABLE product_images ADD COLUMN color TEXT NOT NULL DEFAULT ''").run();
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return json({ error: "Méthode non autorisée." }, 405);
  if (!env.DB) return json({ error: 'Le binding D1 « DB » n’est pas configuré.' }, 500);

  try {
    const db = env.DB;
    await ensureTables(db);
    const [products, settings, images] = await Promise.all([
      db.prepare("SELECT id, name, price, description, sizes, colors, image, video FROM products ORDER BY id DESC").all(),
      db.prepare("SELECT k, v FROM settings").all(),
      db.prepare("SELECT id, product_id, image, position, color FROM product_images ORDER BY product_id, position, id").all()
    ]);
    const values = Object.fromEntries(settings.results.map(({ k, v }) => [k, v]));
    const imagesByProduct = new Map();
    for (const image of images.results) {
      if (!imagesByProduct.has(image.product_id)) imagesByProduct.set(image.product_id, []);
      imagesByProduct.get(image.product_id).push({ id: image.id, image: image.image, position: image.position, color: image.color || "" });
    }
    const productList = products.results.map(product => ({ ...product, images: imagesByProduct.get(product.id) || [] }));

    return json({
      products: productList,
      settings: {
        brand: values.brand || "DIAMOND",
        whatsapp: values.whatsapp || "",
        heroImage: values.heroImage || "",
        heroVideo: values.heroVideo || ""
      }
    });
  } catch (error) {
    console.error("Diamond store API error", error);
    return json({ error: "Erreur interne. Vérifie la configuration D1." }, 500);
  }
}
