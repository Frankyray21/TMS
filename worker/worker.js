/* ─────────────────────────────────────────────────────────────────────────
   Worker Cloudflare · Attestations TMS (web)
   ---------------------------------------------------------------------------
   Reçoit les attestations de la formation « Prévention TMS » terminées sur le
   site, et les enregistre automatiquement dans Airtable. Relie aussi chaque
   attestation au bon employé (recherche au fil de la frappe sur le site).

   • Base Airtable   : « Formations »                       → appmq82YjvEUglYZU
   • Table attest.   : « Attestations TMS (web) »           → tblSNMDt0yj7nBxXm
   • Liste employés  : « Liste employé (registre formation) »→ tbllKuNePDWZMr1cz

   SECRET REQUIS (Cloudflare → Settings → Variables and Secrets) :
   • AIRTABLE_TOKEN  = jeton d'accès personnel Airtable (Personal Access Token)
                       avec : data.records:read + data.records:write
                       et l'accès à la base « Formations ».

   ENDPOINTS :
   • GET  /?q=<texte>  → recherche d'employés (autocomplétion). Renvoie
                         { ok:true, results:[{ id, name }, ...] }
   • GET  /            → page d'état { ok:true, service:"attestations-tms" }
   • POST /            → enregistre une attestation. Corps JSON :
       { "name":"...", "lang":"FR"|"EN", "date":"AAAA-MM-JJ",
         "score":"5/5 modules", "mine":"(opt)", "employeeId":"rec...(opt)",
         "image":"data:image/png;base64,… (attestation DÉTAILLÉE)",
         "timeTotal":"24 min 30 s", "timeDetail":"temps par section…" }

   DEUX VERSIONS DE L'ATTESTATION : le travailleur imprime/enregistre une
   version propre (côté site) ; la version téléversée ICI (champ « Attestation »)
   est la version DÉTAILLÉE qui montre le temps passé par section. Le temps est
   aussi écrit dans deux colonnes : « Temps total » et « Détail du temps ».
   → Créer ces 2 champs (texte) dans la table si absents. S'ils manquent, le
     Worker réessaie sans eux : l'attestation est enregistrée quand même.
   ───────────────────────────────────────────────────────────────────────── */

const AIRTABLE_BASE  = "appmq82YjvEUglYZU";   // base « Formations »
const AIRTABLE_TABLE = "tblSNMDt0yj7nBxXm";   // table « Attestations TMS (web) »

/* Liste des employés, pour relier l'attestation au bon dossier. */
const EMP_TABLE      = "tbllKuNePDWZMr1cz";   // « Liste employé (registre formation) »
const EMP_NAME_FIELD = "Name";                // champ principal = nom complet

/* Champ pièce jointe qui reçoit l'image du certificat généré par le site. */
const ATTACH_FIELD   = "fldBlPonYY4pypKfT";   // champ « Attestation » (image)

/* Origines autorisées à appeler le Worker depuis un navigateur (CORS). */
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

    // GET : recherche d'employés (?q=...) ou simple page d'état.
    if (request.method === "GET") {
      const url = new URL(request.url);
      if (url.searchParams.has("q")) {
        return searchEmployees(url.searchParams.get("q") || "", env, cors);
      }
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
    const mine  = clean(body.mine, 80);     // optionnel
    const date  = isoDate(body.date);       // « AAAA-MM-JJ »
    let empId = validRecId(body.employeeId);   // lien vers la liste d'employés
    const timeTotal  = clean(body.timeTotal, 40);     // ex. « 24 min 30 s »
    const timeDetail = clean(body.timeDetail, 4000);  // temps par section (texte)

    if (!env.AIRTABLE_TOKEN) {
      return json(
        { ok: false, error: "AIRTABLE_TOKEN non configuré sur le Worker." },
        500, cors
      );
    }

    // Repli : si aucun employé n'a été choisi explicitement dans la liste, on
    // tente une correspondance EXACTE du nom (casse/accents ignorés). Ainsi le
    // lien se fait même si la personne a tapé son nom sans cliquer la suggestion.
    if (!empId) empId = await findEmployeeByName(name, env);

    // Champs envoyés à Airtable (les noms correspondent exactement aux colonnes).
    const fields = {
      "Nom": name,
      "Formation": "Prévention TMS",
      "Date": date,
      "Langue": lang,
      "Source": "site web formation",
      // Relié à un employé → « Reçu ». Sinon → « À relier » (vérif manuelle).
      "Statut": empId ? "Reçu" : "À relier",
    };
    if (score) fields["Score quiz"] = score;
    if (mine)  fields["Mine"] = mine;
    if (empId) fields["Employé"] = [empId];

    // Champs « suivi du temps ». On les envoie d'abord ; si Airtable les refuse
    // (colonne pas encore créée), on réessaie SANS eux pour ne jamais bloquer
    // l'enregistrement de l'attestation.
    const timeFields = {};
    if (timeTotal)  timeFields["Temps total"] = timeTotal;
    if (timeDetail) timeFields["Détail du temps"] = timeDetail;

    let at = await postRecord({ ...fields, ...timeFields }, env);
    if (at && !at.ok && Object.keys(timeFields).length) {
      at = await postRecord(fields, env);   // repli sans les colonnes de temps
    }
    if (!at) {
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

    // Téléverse l'image du certificat (si fournie) dans le champ « Attestation ».
    let imaged = false;
    if (rec && rec.id && body.image) {
      imaged = await uploadAttestationImage(rec.id, body.image, name, env);
    }
    return json({ ok: true, id: rec.id, linked: !!empId, image: imaged }, 200, cors);
  },
};

/* POST d'un enregistrement dans la table « Attestations TMS (web) ».
   Renvoie la Response Airtable, ou null en cas de panne réseau. */
async function postRecord(fields, env) {
  try {
    return await fetch(
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
    return null;
  }
}

/* ── recherche d'employés (autocomplétion, insensible casse + accents) ────── */
async function searchEmployees(q, env, cors) {
  const term = deburr(clean(q, 50).toLowerCase());
  if (term.length < 2) return json({ ok: true, results: [] }, 200, cors);
  if (!env.AIRTABLE_TOKEN) {
    return json({ ok: false, error: "AIRTABLE_TOKEN non configuré." }, 500, cors);
  }

  // Le champ « Name » est mis en minuscules + accents retirés, puis comparé.
  const safe = term.replace(/["\\]/g, " ");
  const field = stripAccentsFormula(`LOWER({${EMP_NAME_FIELD}})`);
  const formula = `SEARCH("${safe}", ${field})`;
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${EMP_TABLE}`
            + `?filterByFormula=${encodeURIComponent(formula)}`
            + `&maxRecords=8&fields%5B%5D=${encodeURIComponent(EMP_NAME_FIELD)}`;

  let at;
  try {
    at = await fetch(url, { headers: { "Authorization": `Bearer ${env.AIRTABLE_TOKEN}` } });
  } catch (e) {
    return json({ ok: false, results: [] }, 502, cors);
  }
  if (!at.ok) return json({ ok: false, results: [] }, 200, cors);

  const data = await at.json();
  const results = (data.records || [])
    .map((r) => ({ id: r.id, name: String((r.fields && r.fields[EMP_NAME_FIELD]) || "").trim() }))
    .filter((r) => r.name)
    .sort((a, b) => {
      // Les noms qui COMMENCENT par le terme tapé d'abord, puis alphabétique.
      const sa = deburr(a.name.toLowerCase()).startsWith(safe) ? 0 : 1;
      const sb = deburr(b.name.toLowerCase()).startsWith(safe) ? 0 : 1;
      return sa - sb || a.name.localeCompare(b.name, "fr");
    });
  return json({ ok: true, results }, 200, cors);
}

/* Cherche UN employé dont le nom complet correspond exactement (casse/accents
   ignorés). Renvoie son record id, ou "" si aucun / plusieurs (ambigu). */
async function findEmployeeByName(name, env) {
  const term = deburr(clean(name, 120).toLowerCase()).replace(/["\\]/g, " ").trim();
  if (term.length < 2) return "";
  const field = stripAccentsFormula(`LOWER({${EMP_NAME_FIELD}})`);
  const formula = `TRIM(${field})="${term}"`;
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${EMP_TABLE}`
            + `?filterByFormula=${encodeURIComponent(formula)}`
            + `&maxRecords=2&fields%5B%5D=${encodeURIComponent(EMP_NAME_FIELD)}`;
  try {
    const at = await fetch(url, { headers: { "Authorization": `Bearer ${env.AIRTABLE_TOKEN}` } });
    if (!at.ok) return "";
    const data = await at.json();
    const recs = data.records || [];
    return recs.length === 1 ? recs[0].id : "";
  } catch (e) {
    return "";
  }
}

/* Téléverse l'image (data URL base64) du certificat dans le champ pièce jointe
   « Attestation » du nouvel enregistrement, via l'API content d'Airtable. */
async function uploadAttestationImage(recordId, dataUrl, name, env) {
  try {
    let b64 = String(dataUrl || "");
    let ct = "image/png";
    const m = b64.match(/^data:([^;]+);base64,(.*)$/);
    if (m) { ct = m[1]; b64 = m[2]; }
    if (!b64 || b64.length > 7000000) return false;   // garde-fou (~5 Mo)
    const base = clean(name, 60).replace(/[^A-Za-z0-9 _-]/g, "").trim() || "attestation";
    const r = await fetch(
      `https://content.airtable.com/v0/${AIRTABLE_BASE}/${recordId}/${ATTACH_FIELD}/uploadAttachment`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contentType: ct, file: b64, filename: base + ".png" }),
      }
    );
    return r.ok;
  } catch (e) {
    return false;
  }
}

/* ── utilitaires ────────────────────────────────────────────────────────── */
function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.indexOf(origin) >= 0 ? origin : (origin || "*");
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

function validRecId(v) {
  return (typeof v === "string" && /^rec[A-Za-z0-9]{14}$/.test(v)) ? v : "";
}

/* Retire les accents d'une chaîne JS (terme recherché). */
function deburr(s) {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/* Construit une formule Airtable qui retire les accents FR d'une expression. */
function stripAccentsFormula(expr) {
  const map = [
    ["à", "a"], ["â", "a"], ["ä", "a"], ["á", "a"], ["ã", "a"],
    ["é", "e"], ["è", "e"], ["ê", "e"], ["ë", "e"],
    ["î", "i"], ["ï", "i"], ["í", "i"],
    ["ô", "o"], ["ö", "o"], ["ó", "o"], ["õ", "o"],
    ["ù", "u"], ["û", "u"], ["ü", "u"], ["ú", "u"],
    ["ç", "c"], ["ñ", "n"],
  ];
  let f = expr;
  for (const [a, b] of map) f = `SUBSTITUTE(${f},"${a}","${b}")`;
  return f;
}
