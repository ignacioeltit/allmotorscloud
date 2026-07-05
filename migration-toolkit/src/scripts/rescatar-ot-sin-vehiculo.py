#!/usr/bin/env python3
"""
Rescata las OTs históricas que en TallerGP no tenían vehículo asignado,
enganchándolas todas a UN vehículo placeholder con patente SINVEHICULOASIGNADO.
Idempotente: el vehículo se crea una vez y las OTs ya importadas se saltan.
"""
import json, glob, os, time, urllib.request, urllib.error

ORG  = "1c3df5cb-ff3e-4ce7-b7ae-bdce14a0791a"
USER = "c0a7525b-06ed-4baa-9690-8888918156aa"
SENTINEL = "SIN_VEHICULO_ASIGNADO"   # origen_tallergp_id del placeholder
PATENTE  = "SINVEHICULOASIGNADO"
HERE = os.path.dirname(os.path.abspath(__file__))
BK   = os.path.join(HERE, "..", "..", "exports", "backup", "repair-orders")
ENV  = os.path.join(HERE, "..", "..", "..", "apps", "web", ".env.local")

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
    for i in range(4):
        try:
            req = urllib.request.Request(URL + "/rest/v1/" + path, data=data, headers=h, method=method)
            with urllib.request.urlopen(req, timeout=30) as r:
                t = r.read().decode()
                return r.status, (json.loads(t) if t else None)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and i < 3: time.sleep(1.5 * (i + 1)); continue
            return e.code, e.read().decode()[:300]
        except Exception:
            if i < 3: time.sleep(1.5 * (i + 1)); continue
            raise


# 1) Placeholder vehicle (idempotente por origen_tallergp_id)
_, ve = api("GET", f"vehiculos?select=id&origen_tallergp_id=eq.{SENTINEL}&limit=1")
if ve:
    veh_id = ve[0]["id"]; print(f"• Vehículo placeholder ya existía ({veh_id})")
else:
    st, res = api("POST", "vehiculos", {
        "org_id": ORG, "patente": PATENTE, "marca": "SIN VEHÍCULO", "modelo": "SIN VEHÍCULO",
        "tipo": "otro", "origen_tallergp_id": SENTINEL, "creado_por": USER,
        "notas": "Placeholder para OTs históricas de TallerGP sin vehículo asignado.",
    }, prefer="return=representation")
    if st not in (200, 201): raise SystemExit(f"Error creando placeholder: {res}")
    veh_id = res[0]["id"]; print(f"✓ Vehículo placeholder creado ({veh_id})")

# 2) Historia técnica
_, ht = api("GET", f"historias_tecnicas?select=id&vehiculo_id=eq.{veh_id}&limit=1")
if not ht:
    api("POST", "historias_tecnicas", {"vehiculo_id": veh_id, "org_id": ORG})

# 3) Recolectar las OTs sin vehículo (de las que fallaron por vehiculo_no_encontrado)
rep = json.load(open(os.path.join(HERE, "..", "..", "reports", "import-ots-reporte.json")))
fallidas = {e["ot"] for e in rep["errores"] if e["estado"] == "error"}
sin_veh = []
for f in glob.glob(os.path.join(BK, "*.json")):
    try: d = json.load(open(f))
    except: continue
    if d.get("order_number") in fallidas and not d.get("vehicle_id"):
        sin_veh.append(d)
print(f"OTs sin vehículo a enganchar: {len(sin_veh)}")

# 4) Importar cada una apuntando al placeholder
ok = skip = err = 0
for o in sin_veh:
    payload = {**o, "vehicle_id": SENTINEL}
    st, res = api("POST", "rpc/fn_importar_ot_historica", {"p_org_id": ORG, "p_user_id": USER, "p_ot": payload})
    if isinstance(res, dict) and res.get("ok"): ok += 1
    elif isinstance(res, dict) and res.get("skipped"): skip += 1
    else: err += 1; print(f"  ⚠ {o.get('order_number')}: {res}")

print(f"\n=== OTs sin vehículo: ok={ok} skip={skip} err={err} ===")
