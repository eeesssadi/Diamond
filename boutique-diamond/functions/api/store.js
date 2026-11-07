export async function onRequest({ env }) {
  const db = env.DB;

  if (!db) {
    return new Response(JSON.stringify({ error: "DB missing" }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }

  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        price REAL,
        description TEXT,
        sizes TEXT,
        image TEXT,
        video TEXT
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS settings (
        k TEXT PRIMARY KEY,
        v TEXT
      )
    `)
  ]);

  const products = await db.prepare(`
    SELECT id, name, price, description, sizes, image, video
    FROM products
    ORDER BY id DESC
  `).all();

  const settings = await db.prepare("SELECT k, v FROM settings").all();
  const map = {};
  for (const row of settings.results) map[row.k] = row.v;

  return new Response(JSON.stringify({
    products: products.results,
    settings: {
      brand: map.brand || "DIAMOND",
      whatsapp: map.whatsapp || "",
      heroImage: map.heroImage || "",
      heroVideo: map.heroVideo || ""
    }
  }), {
    headers: { "content-type": "application/json" }
  });
}
