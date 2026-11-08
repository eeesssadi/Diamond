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
  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  if (!env.DB) return json({ error: 'Le binding D1 « DB » n’est pas configuré.' }, 500);
  if (!env.ADMIN_KEY || request.headers.get("x-key") !== env.ADMIN_KEY) {
    return json({ error: "Clé administrateur incorrecte." }, 401);
  }

  try {
    const db = env.DB;
    await ensureTables(db);
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Corps JSON invalide." }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "Corps JSON invalide." }, 400);
    }

    const text = value => String(value ?? "").trim();
    const action = body.action;

    if (action === "add" || action === "update") {
      const name = text(body.name);
      const price = Number(body.price);
      if (!name || !Number.isFinite(price) || price < 0) {
        return json({ error: "Indique un nom et un prix valide." }, 400);
      }
      const fields = [name, price, text(body.description), text(body.sizes), text(body.image), text(body.video)];
      if (fields.some(value => String(value).length > 10000)) return json({ error: "Un champ est trop long." }, 413);

      if (action === "add") {
        await db.prepare("INSERT INTO products(name, price, description, sizes, image, video) VALUES(?, ?, ?, ?, ?, ?)").bind(...fields).run();
      } else {
        const id = Number(body.id);
        if (!Number.isInteger(id) || id < 1) return json({ error: "Identifiant de produit invalide." }, 400);
        await db.prepare("UPDATE products SET name=?, price=?, description=?, sizes=?, image=?, video=? WHERE id=?").bind(...fields, id).run();
      }
      return json({ ok: true });
    }

    if (action === "delete") {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id < 1) return json({ error: "Identifiant de produit invalide." }, 400);
      await db.prepare("DELETE FROM products WHERE id=?").bind(id).run();
      return json({ ok: true });
    }

    if (action === "settings") {
      const update = db.prepare("INSERT INTO settings(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v");
      for (const key of ["brand", "whatsapp", "heroImage", "heroVideo"]) {
        if (body[key] !== undefined) {
          const value = text(body[key]);
          if (value.length > 2000) return json({ error: `Le champ ${key} est trop long.` }, 400);
          await update.bind(key, value).run();
        }
      }
      return json({ ok: true });
    }

    return json({ error: "Action inconnue." }, 400);
  } catch (error) {
    console.error("Diamond admin API error", error);
    return json({ error: "Erreur interne. Vérifie la configuration D1." }, 500);
  }
}
