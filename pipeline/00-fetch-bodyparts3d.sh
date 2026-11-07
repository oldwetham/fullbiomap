#!/usr/bin/env bash
# Step 00: download BodyParts3D 4.0 (IS-A OBJ archive + English IS-A and PART-OF tables)
# into data/raw/bp3d/, then record or verify SHA-256 checksums in CHECKSUMS.txt.
# Source and license: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html (CC BY 4.0).
#
# TLS note: dbarchive.biosciencedbc.jp does not send its intermediate certificate, and the
# macOS /etc/ssl/cert.pem bundle lacks GlobalSign Root R46. If plain curl fails, this script
# builds a CA bundle from the system roots (macOS keychain when available) plus the
# intermediate named in the server certificate's AIA field. Verification stays on.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/data/raw/bp3d"
base="https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST"
files=(
  isa_BP3D_4.0_obj_99.zip
  isa_parts_list_e.txt
  isa_element_parts.txt
  isa_inclusion_relation_list.txt
  partof_parts_list_e.txt
  partof_element_parts.txt
  partof_inclusion_relation_list.txt
)
intermediate="http://secure.globalsign.com/cacert/gsgccr46dvtlsca2025.crt"

mkdir -p "$dest"
cd "$dest"

curl_opts=(--fail --location --silent --show-error --retry 3)
if ! curl "${curl_opts[@]}" --head "$base/isa_parts_list_e.txt" -o /dev/null 2>/dev/null; then
  echo "Default CA bundle failed; building one with the GlobalSign intermediate." >&2
  tls="$dest/.tls"; mkdir -p "$tls"
  : > "$tls/bundle.pem"
  [ -f /etc/ssl/cert.pem ] && cat /etc/ssl/cert.pem >> "$tls/bundle.pem"
  if command -v security >/dev/null; then
    security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain >> "$tls/bundle.pem"
  fi
  curl "${curl_opts[@]}" "$intermediate" -o "$tls/intermediate.der"
  openssl x509 -inform der -in "$tls/intermediate.der" -out "$tls/intermediate.pem"
  openssl verify -CAfile "$tls/bundle.pem" "$tls/intermediate.pem" >/dev/null
  cat "$tls/intermediate.pem" >> "$tls/bundle.pem"
  curl_opts+=(--cacert "$tls/bundle.pem")
fi

for f in "${files[@]}"; do
  if [ -s "$f" ]; then echo "have $f"; continue; fi
  echo "fetch $f"
  # The server sometimes drops long transfers; resume the partial file up to 10 times.
  ok=
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if curl "${curl_opts[@]}" --continue-at - "$base/$f" -o "$f.part"; then ok=1; break; fi
    echo "  retry $attempt ($(wc -c < "$f.part" | tr -d ' ') bytes so far)" >&2
  done
  [ -n "$ok" ] || { echo "failed to download $f" >&2; exit 1; }
  mv "$f.part" "$f"
done

# pipeline/checksums/bp3d.sha256 is the committed pin (data/ is gitignored). If upstream
# LATEST/ changes, this fails loudly; update the pin deliberately, never silently.
pinned="$root/pipeline/checksums/bp3d.sha256"
shasum -a 256 "${files[@]}" > CHECKSUMS.txt
if [ -f "$pinned" ]; then
  diff -u "$pinned" CHECKSUMS.txt >&2 || { echo "checksums differ from $pinned" >&2; exit 1; }
  echo "checksums match pinned $pinned"
else
  cp CHECKSUMS.txt "$pinned"
  echo "wrote CHECKSUMS.txt and pinned it to $pinned"
fi

# Extract meshes into their own directory (archives are untrusted; never overwrite).
if [ ! -d obj ]; then
  mkdir obj.tmp
  unzip -q -n isa_BP3D_4.0_obj_99.zip -d obj.tmp
  # Flatten to obj/ containing FJ*.obj directly, whatever the archive's top-level folder is.
  mkdir obj
  find obj.tmp -type f -name 'FJ*.obj' -exec mv {} obj/ \;
  rm -rf obj.tmp
fi
echo "obj meshes: $(find obj -name 'FJ*.obj' | wc -l | tr -d ' ')"
