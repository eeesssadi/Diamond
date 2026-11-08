const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

async function ensureTables(db) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT '', price REAL NOT NULL DEFAULT 0, description TEXT NOT NULL DEFAULT '', sizes TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '', video TEXT NOT NULL DEFAULT '')"),
    db.prepare("CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL DEFAULT '')")
  ]);

  const columns = (await db.prepare("PRAGMA table_info(products)").all()).results.map(column => column.name);
  for (const [name, type] of [
    ["description", "TEXT NOT NULL DEFAULT ''"],
    ["sizes", "TEXT NOT NULL DEFAULT ''"],
    ["image", "TEXT NOT NULL DEFAULT ''"],
    ["video", "TEXT NOT NULL DEFAULT ''"]
  ]) {
    if (!columns.includes(name)) {
      await db.prepare(`ALTER TABLE products ADD COLUMN ${name} ${type}`).run();
    }
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return json({ error: "Méthode non autorisée." }, 405);
  if (!env.DB) return json({ error: 'Le binding D1 « DB » n’est pas configuré.' }, 500);

  try {
    const db = env.DB;
    await ensureTables(db);
    const [products, settings] = await Promise.all([
      db.prepare("SELECT id, name, price, description, sizes, image, video FROM products ORDER BY id DESC").all(),
      db.prepare("SELECT k, v FROM settings").all()
    ]);
    const values = Object.fromEntries(settings.results.map(({ k, v }) => [k, v]));

    return json({
      products: products.results,
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
