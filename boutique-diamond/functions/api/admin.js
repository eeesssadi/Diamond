export async function onRequest({ request, env }) {
  const db = env.DB;

  if (!db) {
    return new Response(JSON.stringify({ error: "DB missing" }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }

  if (request.headers.get("x-key") !== env.ADMIN_KEY) {
    return new Response(JSON.stringify({ error: "Mot de passe incorrect" }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });
  }

  const body = await request.json();

  if (body.action === "add") {
    await db.prepare(`
      INSERT INTO products(name, price, description, sizes, image, video)
      VALUES(?,?,?,?,?,?)
    `).bind(
      body.name || "",
      Number(body.price) || 0,
      body.description || "",
      body.sizes || "",
      body.image || "",
      body.video || ""
    ).run();
  }

  if (body.action === "update") {
    await db.prepare(`
      UPDATE products
      SET name=?, price=?, description=?, sizes=?, image=?, video=?
      WHERE id=?
    `).bind(
      body.name || "",
      Number(body.price) || 0,
      body.description || "",
      body.sizes || "",
      body.image || "",
      body.video || "",
      body.id
    ).run();
  }

  if (body.action === "delete") {
    await db.prepare("DELETE FROM products WHERE id=?").bind(body.id).run();
  }

  if (body.action === "settings") {
    const up = db.prepare(`
      INSERT INTO settings(k, v)
      VALUES(?, ?)
      ON CONFLICT(k) DO UPDATE SET v=excluded.v
    `);

    for (const key of ["brand", "whatsapp", "heroImage", "heroVideo"]) {
      if (body[key] !== undefined) {
        await up.bind(key, String(body[key])).run();
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" }
  });
}
