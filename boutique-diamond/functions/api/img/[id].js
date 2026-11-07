export async function onRequest({ params, env }) {
  const db = env.DB;
  const id = params.id;

  const row = await db.prepare("SELECT image FROM products WHERE id=?").bind(id).first();
  if (!row || !row.image) {
    return new Response("", { status: 404 });
  }

  const match = /^data:(.+?);base64,(.+)$/.exec(row.image);
  if (!match) return new Response("", { status: 404 });

  const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      "content-type": match[1],
      "cache-control": "public,max-age=600"
    }
  });
}
