#!/usr/bin/env python3
"""
Importa al catálogo (catalogo_servicios) los servicios de mano de obra de TallerGP
que faltan: distintos por código (campo `reference`) en las líneas de labor de
todas las OTs respaldadas. Precio POR HORA ligado al valor hora configurado:
horas_estandar = mediana(precio) / valor_hora → total = horas × valor hora.

Idempotente: salta los códigos ya presentes. Uso: [--commit] (sin él, solo preview).
"""
import json, glob, os, sys, re, statistics, urllib.request, urllib.error
from collections import defaultdict, Counter

# Palabras que en TallerGP se usaron como "reference" pero NO son códigos de
# servicio (son marcadores de nota/observación).
NO_CODIGOS = {"NOTA", "NOTA:", "OBS", "OBSERVACION", "OBSERVACIONES", "SIN", "VER", "N/A", "NA"}


def limpiar_codigo(ref):
    """Normaliza el reference: quita guiones/asteriscos/espacios de borde. Devuelve
    None si no parece un código real (vacío, muy corto, con espacios internos,
    solo puntuación, o palabra de nota)."""
    r = ref.strip().upper()
    r = re.sub(r"^[\s\-*:.·>]+", "", r)
    r = re.sub(r"[\s\-*:.·>]+$", "", r)
    r = r.strip()
    if len(r) < 2:            return None
    if " " in r:              return None   # códigos reales no llevan espacios
    if not re.search(r"[A-Z0-9]", r): return None
    if r in NO_CODIGOS:       return None
    return r

ORG = "1c3df5cb-ff3e-4ce7-b7ae-bdce14a0791a"
USER = "c0a7525b-06ed-4baa-9690-8888918156aa"
VALOR_HORA = 29412
HERE = os.path.dirname(os.path.abspath(__file__))
BK = os.path.join(HERE, "..", "..", "exports", "backup", "repair-orders")
ENV = os.path.join(HERE, "..", "..", "..", "apps", "web", ".env.local")

env = {}
for line in open(ENV):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1); env[k.strip()] = v.strip()
URL = env["NEXT_PUBLIC_SUPABASE_URL"]; SRK = env["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": SRK, "Authorization": "Bearer " + SRK, "Content-Type": "application/json"}


def api(method, path, body=None, prefer=None):
    h = dict(H)
    if prefer: h["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(URL + "/rest/v1/" + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            t = r.read().decode(); return r.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


# 1) Recolectar servicios por código
serv = defaultdict(lambda: {"desc": Counter(), "precios": []})
for f in glob.glob(os.path.join(BK, "*.json")):
    try: d = json.load(open(f))
    except: continue
    for l in (d.get("labor") or []):
        ref = limpiar_codigo(l.get("reference") or "")
        if not ref: continue
        desc = " ".join((l.get("description") or "").split()).strip()
        if desc: serv[ref]["desc"][desc] += 1
        try:
            p = int(float(l.get("unit_price_net") or 0))
            if p > 0: serv[ref]["precios"].append(p)
        except: pass

# 2) Códigos ya en catálogo (idempotencia)
_, existentes = api("GET", "catalogo_servicios?select=codigo")
ya = {(x.get("codigo") or "").upper() for x in (existentes or [])}

# 3) Construir filas a insertar
filas = []
for ref, info in serv.items():
    if ref in ya: continue
    nombre = info["desc"].most_common(1)[0][0][:200] if info["desc"] else ref
    precio = int(statistics.median(info["precios"])) if info["precios"] else 0
    horas = round(precio / VALOR_HORA, 2) if precio > 0 else 0
    filas.append({
        "org_id": ORG, "codigo": ref, "nombre": nombre, "categoria": "otro",
        "precio_unitario": precio, "unidad_precio": "hora", "horas_estandar": horas,
        "activo": True, "requiere_revision": False, "es_checklist": False,
        "fuente": "tallergp_history",
    })

filas.sort(key=lambda r: r["codigo"])
print(f"Servicios con código en backup: {len(serv)} | ya en catálogo: {len(ya)} | A INSERTAR: {len(filas)}")
print("\nMuestra:")
for r in filas[:12]:
    print(f"  {r['codigo']:10} ${r['precio_unitario']:>7,}  {r['horas_estandar']}h  {r['nombre'][:45]}")

if "--commit" not in sys.argv:
    print("\n(preview — usa --commit para insertar)")
    sys.exit(0)

# 4) Insertar por lotes
ok = 0
for i in range(0, len(filas), 200):
    lote = filas[i:i + 200]
    st, res = api("POST", "catalogo_servicios", lote, prefer="return=minimal")
    if st in (200, 201): ok += len(lote)
    else: print(f"  ✗ lote {i}: {res}")
print(f"\nInsertados: {ok}/{len(filas)}")
