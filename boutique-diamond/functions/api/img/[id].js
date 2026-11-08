const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export async function onRequest({ params, env }) {
  const id = Number(params.id);
  if (!env.DB) return json({ error: 'Le binding D1 « DB » n’est pas configuré.' }, 500);
  if (!Number.isInteger(id) || id < 1) return new Response("", { status: 404 });

  try {
    const row = await env.DB.prepare("SELECT image FROM products WHERE id=?").bind(id).first();
    if (!row || !row.image) return new Response("", { status: 404 });

    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(row.image);
    if (!match) return new Response("", { status: 404 });

    const bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0));
    return new Response(bytes, {
      headers: {
        "content-type": match[1],
        "x-content-type-options": "nosniff",
        "cache-control": "public,max-age=600"
      }
    });
  } catch (error) {
    console.error("Diamond image API error", error);
    return json({ error: "Erreur lors du chargement de l’image. Vérifie la configuration D1." }, 500);
  }
}
