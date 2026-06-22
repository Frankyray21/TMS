/* ─────────────────────────────────────────────────────────────────────────
   Worker Cloudflare · Attestations TMS (web)
   ---------------------------------------------------------------------------
   Reçoit les attestations de la formation « Prévention TMS » terminées sur le
   site, et les enregistre automatiquement dans Airtable.

   • Base Airtable  : « Formations »            → appmq82YjvEUglYZU
   • Table          : « Attestations TMS (web) » → tblSNMDt0yj7nBxXm

   SECRET REQUIS (à ajouter dans Cloudflare → Settings → Variables and Secrets) :
   • AIRTABLE_TOKEN  = jeton d'accès personnel Airtable (Personal Access Token)
                       avec les permissions :
                         - data.records:write
                         - accès à la base « Formations »

   Le site envoie un POST JSON :
     { "name": "...", "lang": "FR"|"EN", "date": "AAAA-MM-JJ",
       "score": "8/10", "mine": "(optionnel)" }

   Voir worker/README.md pour le déploiement pas à pas.
   ───────────────────────────────────────────────────────────────────────── */

const AIRTABLE_BASE  = "appmq82YjvEUglYZU";   // base « Formations »
const AIRTABLE_TABLE = "tblSNMDt0yj7nBxXm";   // table « Attestations TMS (web) »

/* Origines autorisées à appeler le Worker depuis un navigateur (CORS).
   Le site est publié sur GitHub Pages. Ajoute ici un domaine perso si besoin. */
const ALLOWED_ORIGINS = [
  "https://frankyray21.github.io",
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    // Requête préliminaire CORS (envoyée automatiquement par le navigateur).
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // GET : petite page d'état, pratique pour vérifier que le Worker tourne.
    if (request.method === "GET") {
      return json({ ok: true, service: "attestations-tms" }, 200, cors);
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "Méthode non autorisée." }, 405, cors);
    }

    // Lecture du corps JSON envoyé par le site.
    let body;
    try {
      body = await request.json();
    } catch (_) {
      return json({ ok: false, error: "Corps JSON invalide." }, 400, cors);
    }

    const name = clean(body.name, 120);
    if (!name) {
      return json({ ok: false, error: "Nom manquant." }, 400, cors);
    }

    const lang  = String(body.lang || "FR").toUpperCase() === "EN" ? "EN" : "FR";
    const score = clean(body.score, 20);   // ex. « 8/10 »
    const mine  = clean(body.mine, 80);    // optionnel
    const date  = isoDate(body.date);      // « AAAA-MM-JJ »

    if (!env.AIRTABLE_TOKEN) {
      return json(
        { ok: false, error: "AIRTABLE_TOKEN non configuré sur le Worker." },
        500, cors
      );
    }

    // Champs envoyés à Airtable (les noms correspondent exactement aux colonnes).
    const fields = {
      "Nom": name,
      "Formation": "Prévention TMS",
      "Date": date,
      "Langue": lang,
      "Source": "site web formation",
      "Statut": "Reçu",
    };
    if (score) fields["Score quiz"] = score;
    if (mine)  fields["Mine"] = mine;

    let at;
    try {
      at = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.AIRTABLE_TOKEN}`,
            "Content-Type": "application/json",
          },
          // typecast: laisse Airtable convertir la date et retrouver les options.
          body: JSON.stringify({ fields, typecast: true }),
        }
      );
    } catch (e) {
      return json({ ok: false, error: "Airtable injoignable." }, 502, cors);
    }

    if (!at.ok) {
      const detail = await at.text();
      return json(
        { ok: false, error: "Airtable a refusé l'enregistrement.", detail },
        502, cors
      );
    }

    const rec = await at.json();
    return json({ ok: true, id: rec.id }, 200, cors);
  },
};

/* ── utilitaires ────────────────────────────────────────────────────────── */

function corsHeaders(origin) {
  // Reflète l'origine si elle est autorisée ; sinon on l'autorise quand même
  // (endpoint en écriture seule, aucun cookie : pas de risque pour l'utilisateur).
  const allow = ALLOWED_ORIGINS.indexOf(origin) >= 0 ? origin : (origin || "*");
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(obj, status, extra) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}

function clean(v, max) {
  if (v == null) return "";
  return String(v).trim().slice(0, max);
}

function isoDate(v) {
  const d = v ? new Date(v) : new Date();
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}
