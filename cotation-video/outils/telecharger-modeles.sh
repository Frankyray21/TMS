#!/usr/bin/env bash
# Prépare le mode hors ligne : copie le moteur MediaPipe et le modèle de pose
# dans vendor/, pour que l'outil fonctionne sans aucune requête sortante.
#
#   bash outils/telecharger-modeles.sh          # modèle standard
#   bash outils/telecharger-modeles.sh lite     # modèle rapide, plus léger
#
# Environ 18 Mo au total. Le dossier vendor/ est ignoré par git : chaque poste
# le régénère, on ne le versionne pas.

set -euo pipefail
PRECISION="${1:-full}"
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR="$RACINE/vendor"
VERSION="1.0.1"

case "$PRECISION" in
  full|lite) ;;
  *) echo "Précision inconnue : $PRECISION (attendu : full ou lite)" >&2; exit 1 ;;
esac

echo "→ Installation du moteur MediaPipe $VERSION"
TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT
( cd "$TEMP" && npm install --silent --no-audit --no-fund --no-save "@mediapipe/tasks-vision@$VERSION" )

SRC="$TEMP/node_modules/@mediapipe/tasks-vision"
[ -f "$SRC/vision_bundle.mjs" ] || { echo "Paquet incomplet." >&2; exit 1; }

mkdir -p "$VENDOR/wasm"
cp "$SRC/vision_bundle.mjs" "$VENDOR/"
# On copie les deux variantes : MediaPipe choisit SIMD ou non selon le navigateur.
cp "$SRC"/wasm/vision_wasm_internal.{js,wasm} "$VENDOR/wasm/"
cp "$SRC"/wasm/vision_wasm_nosimd_internal.{js,wasm} "$VENDOR/wasm/"

echo "→ Téléchargement du modèle de pose ($PRECISION)"
URL="https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${PRECISION}/float16/1/pose_landmarker_${PRECISION}.task"
curl -fSL --progress-bar "$URL" -o "$VENDOR/pose_landmarker_${PRECISION}.task"

echo
echo "Terminé. vendor/ contient $(du -sh "$VENDOR" | cut -f1)."
echo "L'outil détecte le dossier au chargement et bascule en mode hors ligne."
[ "$PRECISION" = "full" ] || echo "Pensez à choisir « Rapide » dans les réglages d'analyse."
