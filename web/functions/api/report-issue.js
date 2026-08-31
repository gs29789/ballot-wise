// Cloudflare Pages Function -- receives a "report an issue" submission and
// stores it in a PRIVATE R2 bucket (ballot-wise-reports), separate from the
// public ballot-wise-data bucket the rest of the site reads from. That
// separation matters: ballot-wise-data is served bucket-wide via a public
// r2.dev URL, so anything written there would be publicly readable by
// anyone who knew or guessed the key -- the opposite of what an anonymous
// report needs.
//
// Deliberately does NOT capture the requester's IP, user-agent, or any
// other identifying metadata beyond what they typed -- that's the whole
// point of replacing the old mailto: link (which exposed the reporter's
// own email identity via their mail client's From address, not anything
// this site controlled) with a real form.
const MAX_LEN = 4000;

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const context = typeof body.context === "string" ? body.context.slice(0, 500) : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  // Distinguishes a data-accuracy report from general feedback in the
  // relayed email -- same anonymous pipeline either way, just labeled so
  // the two aren't conflated. Unknown/missing values fall back to "issue"
  // rather than being rejected, matching this endpoint's existing
  // fail-open validation style.
  const type = body.type === "feedback" ? "feedback" : "issue";

  if (!description) {
    return new Response(JSON.stringify({ error: "Please describe what looks wrong." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (description.length > MAX_LEN) {
    return new Response(JSON.stringify({ error: `Please keep the description under ${MAX_LEN} characters.` }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const receivedAt = new Date().toISOString();
  const key = `reports/${receivedAt.replace(/[:.]/g, "-")}-${crypto.randomUUID()}.json`;

  try {
    await env.REPORTS_BUCKET.put(key, JSON.stringify({ type, context, description, receivedAt }, null, 2), {
      httpMetadata: { contentType: "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Something went wrong saving your report. Please try again." }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
