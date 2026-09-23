#!/usr/bin/env bash
# Prépare le mode hors ligne : copie le moteur MediaPipe et les modèles de pose
# dans vendor/<version>/, pour que l'outil fonctionne sans aucune requête sortante.
#
#   bash outils/telecharger-modeles.sh          # les deux modèles (standard et rapide)
#   bash outils/telecharger-modeles.sh full     # modèle standard seulement
#   bash outils/telecharger-modeles.sh lite     # modèle rapide seulement
#
# Environ 37 Mo au total : 23 Mo de moteur (bundle et deux variantes
# WebAssembly, SIMD ou non — le navigateur choisit), 9 Mo pour le modèle
# standard, 6 Mo pour le rapide. Le dossier vendor/ est ignoré par git : le
# déploiement (.github/workflows/deploy-pages.yml) le régénère à chaque
# publication, et chaque poste de développement fait de même.
#
# Les versions ne sont pas écrites ici : elles viennent de js/config.js
# (MEDIAPIPE, MODELE_POSE, VERSION_MOTEUR), la source unique que l'outil et le
# service worker du site suivent aussi. Les autres versions présentes dans
# vendor/ sont supprimées : l'outil n'en chercherait jamais les fichiers.

set -euo pipefail
PRECISION="${1:-tous}"
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

case "$PRECISION" in
  tous) MODELES="full lite" ;;
  full|lite) MODELES="$PRECISION" ;;
  *) echo "Précision inconnue : $PRECISION (attendu : tous, full ou lite)" >&2; exit 1 ;;
esac

read -r MEDIAPIPE MODELE_POSE VERSION_MOTEUR < <(node --input-type=module -e '
  import { pathToFileURL } from "node:url";
  const c = await import(pathToFileURL(process.argv[1]).href);
  console.log(c.MEDIAPIPE, c.MODELE_POSE, c.VERSION_MOTEUR);
' "$RACINE/js/config.js")
[ -n "${VERSION_MOTEUR:-}" ] || { echo "Version du moteur illisible dans js/config.js." >&2; exit 1; }
VENDOR="$RACINE/vendor/$VERSION_MOTEUR"

echo "→ Moteur $VERSION_MOTEUR : MediaPipe $MEDIAPIPE, modèles de pose v$MODELE_POSE"
TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT
( cd "$TEMP" && npm install --silent --no-audit --no-fund --no-save "@mediapipe/tasks-vision@$MEDIAPIPE" )

SRC="$TEMP/node_modules/@mediapipe/tasks-vision"
[ -f "$SRC/vision_bundle.mjs" ] || { echo "Paquet incomplet." >&2; exit 1; }

mkdir -p "$RACINE/vendor"
# Anciennes versions et ancienne disposition à plat : tout ce qui n'est pas la version courante.
find "$RACINE/vendor" -mindepth 1 -maxdepth 1 ! -name "$VERSION_MOTEUR" -exec rm -rf {} +

mkdir -p "$VENDOR/wasm"
cp "$SRC/vision_bundle.mjs" "$VENDOR/"
# On copie les deux variantes : MediaPipe choisit SIMD ou non selon le navigateur.
cp "$SRC"/wasm/vision_wasm_internal.{js,wasm} "$VENDOR/wasm/"
cp "$SRC"/wasm/vision_wasm_nosimd_internal.{js,wasm} "$VENDOR/wasm/"

for MODELE in $MODELES; do
  echo "→ Téléchargement du modèle de pose ($MODELE)"
  URL="https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${MODELE}/float16/${MODELE_POSE}/pose_landmarker_${MODELE}.task"
  curl -fSL --progress-bar "$URL" -o "$VENDOR/pose_landmarker_${MODELE}.task"
done

echo
echo "Terminé. vendor/$VERSION_MOTEUR contient $(du -sh "$VENDOR" | cut -f1)."
echo "L'outil détecte le dossier au chargement et bascule en mode local : plus aucune requête ne sort."
if [ "$PRECISION" = "lite" ]; then
  echo "Seul le modèle rapide est installé : choisissez « Rapide » dans les réglages d'analyse."
elif [ "$PRECISION" = "full" ]; then
  echo "Seul le modèle standard est installé : le réglage « Rapide » restera indisponible hors ligne."
fi
