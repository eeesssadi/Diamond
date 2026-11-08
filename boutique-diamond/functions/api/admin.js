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
      const fields = [name, price, text(body.description), text(body.sizes), text(body.colors), text(body.image), text(body.video)];
      if (fields.some((value, index) => index !== 5 && String(value).length > 10000)) return json({ error: "Un champ est trop long." }, 413);
      if (fields[5].length > 1000000) return json({ error: "La photo est trop volumineuse. Choisis une image plus légère." }, 413);

      if (action === "add") {
        await db.prepare("INSERT INTO products(name, price, description, sizes, colors, image, video) VALUES(?, ?, ?, ?, ?, ?, ?)").bind(...fields).run();
      } else {
        const id = Number(body.id);
        if (!Number.isInteger(id) || id < 1) return json({ error: "Identifiant de produit invalide." }, 400);
        await db.prepare("UPDATE products SET name=?, price=?, description=?, sizes=?, colors=?, image=?, video=? WHERE id=?").bind(...fields, id).run();
      }
      return json({ ok: true });
    }

    if (action === "addImage") {
      const productId = Number(body.productId);
      const image = text(body.image);
      if (!Number.isInteger(productId) || productId < 1) return json({ error: "Identifiant de produit invalide." }, 400);
      if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image) || image.length > 1000000) return json({ error: "La photo doit être un JPEG réduit de moins de 1 Mo." }, 413);
      const product = await db.prepare("SELECT id, image FROM products WHERE id=?").bind(productId).first();
      if (!product) return json({ error: "Produit introuvable." }, 404);
      const count = await db.prepare("SELECT COUNT(*) AS count FROM product_images WHERE product_id=?").bind(productId).first();
      if ((product.image ? 1 : 0) + Number(count?.count || 0) >= 4) return json({ error: "Un produit peut avoir au maximum 4 photos." }, 400);
      const position = await db.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS position FROM product_images WHERE product_id=?").bind(productId).first();
      await db.prepare("INSERT INTO product_images(product_id, image, position) VALUES(?, ?, ?)").bind(productId, image, Number(position?.position || 1)).run();
      return json({ ok: true });
    }

    if (action === "deleteImage") {
      const productId = Number(body.productId);
      if (!Number.isInteger(productId) || productId < 1) return json({ error: "Identifiant de produit invalide." }, 400);
      if (body.primary === true) {
        const product = await db.prepare("SELECT image FROM products WHERE id=?").bind(productId).first();
        if (!product) return json({ error: "Produit introuvable." }, 404);
        const nextImage = await db.prepare("SELECT id, image FROM product_images WHERE product_id=? ORDER BY position, id LIMIT 1").bind(productId).first();
        if (nextImage) {
          await db.batch([
            db.prepare("UPDATE products SET image=? WHERE id=?").bind(nextImage.image, productId),
            db.prepare("DELETE FROM product_images WHERE id=? AND product_id=?").bind(nextImage.id, productId)
          ]);
        } else {
          await db.prepare("UPDATE products SET image='' WHERE id=?").bind(productId).run();
        }
      } else {
        const imageId = Number(body.imageId);
        if (!Number.isInteger(imageId) || imageId < 1) return json({ error: "Identifiant de photo invalide." }, 400);
        await db.prepare("DELETE FROM product_images WHERE id=? AND product_id=?").bind(imageId, productId).run();
      }
      const remaining = await db.prepare("SELECT id FROM product_images WHERE product_id=? ORDER BY position, id").bind(productId).all();
      for (let index = 0; index < remaining.results.length; index += 1) {
        await db.prepare("UPDATE product_images SET position=? WHERE id=?").bind(index + 1, remaining.results[index].id).run();
      }
      return json({ ok: true });
    }

    if (action === "delete") {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id < 1) return json({ error: "Identifiant de produit invalide." }, 400);
      await db.batch([
        db.prepare("DELETE FROM product_images WHERE product_id=?").bind(id),
        db.prepare("DELETE FROM products WHERE id=?").bind(id)
      ]);
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
