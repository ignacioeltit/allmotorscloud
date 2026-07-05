#!/usr/bin/env python3
"""
Rescata los 6 vehículos faltantes (con clientes YA existentes) y reimporta sus
OTs. Por cada vehículo: crea vehiculos + historias_tecnicas + propietarios_vehiculo
(service_role bypassa RLS), luego llama fn_importar_ot_historica por cada OT.

Idempotente: si el vehículo ya existe (por origen_tallergp_id) lo reutiliza; las
OTs ya importadas devuelven 'skipped'. Datos de marca/modelo desconocidos quedan
como 'POR CONFIRMAR'.
"""
import json, glob, os, re, urllib.request, urllib.error

ORG  = "1c3df5cb-ff3e-4ce7-b7ae-bdce14a0791a"
USER = "c0a7525b-06ed-4baa-9690-8888918156aa"
HERE = os.path.dirname(os.path.abspath(__file__))
BK   = os.path.join(HERE, "..", "..", "exports", "backup", "repair-orders")
VBK  = os.path.join(HERE, "..", "..", "exports", "backup", "vehicles-list")
ENV  = os.path.join(HERE, "..", "..", "..", "apps", "web", ".env.local")

env = {}
for line in open(ENV):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1); env[k.strip()] = v.strip()
URL = env["NEXT_PUBLIC_SUPABASE_URL"]; SRK = env["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": SRK, "Authorization": "Bearer " + SRK, "Content-Type": "application/json"}


def api(method, path, body=None, prefer=None):
    import time
    h = dict(H)
    if prefer: h["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    for intento in range(4):
        req = urllib.request.Request(URL + "/rest/v1/" + path, data=data, headers=h, method=method)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                t = r.read().decode()
                return r.status, (json.loads(t) if t else None)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and intento < 3:
                time.sleep(1.5 * (intento + 1)); continue
            return e.code, e.read().decode()[:300]
        except Exception:
            if intento < 3:
                time.sleep(1.5 * (intento + 1)); continue
            raise


def norm_plate(p):
    return re.sub(r"[^A-Z0-9]", "", (p or "").upper())


# ── Recolectar OTs fallidas agrupadas por vehículo real ──────────────────────
rep = json.load(open(os.path.join(HERE, "..", "..", "reports", "import-ots-reporte.json")))
fallidas = {e["ot"] for e in rep["errores"] if e["estado"] == "error"}
por_veh = {}
for f in glob.glob(os.path.join(BK, "*.json")):
    try: d = json.load(open(f))
    except: continue
    if d.get("order_number") in fallidas and d.get("vehicle_id"):
        por_veh.setdefault(d["vehicle_id"], []).append(d)

# marca/modelo desde backup de vehículos (si está)
vbk = {}
for f in glob.glob(os.path.join(VBK, "*.json")):
    try: d = json.load(open(f))
    except: continue
    items = d if isinstance(d, list) else d.get("data") or d.get("items") or []
    if isinstance(items, dict): items = items.get("data") or []
    for it in (items if isinstance(items, list) else []):
        if isinstance(it, dict) and (it.get("id") or it.get("_id")):
            vbk[it.get("id") or it.get("_id")] = it

print(f"Vehículos a rescatar: {len(por_veh)}\n")
tot_ok = tot_skip = tot_err = 0

for vid, ots in por_veh.items():
    ej = ots[0]
    plate = norm_plate(next((o.get("plate") for o in ots if o.get("plate")), None))
    vin = next((o.get("vin") for o in ots if o.get("vin")), None)
    cid_tgp = ej.get("client_id")
    vb = vbk.get(vid, {})
    marca = (vb.get("brand_name") or vb.get("brand") or "POR CONFIRMAR")
    modelo = (vb.get("model_name") or vb.get("model") or "POR CONFIRMAR")

    # cliente en DB
    _, cli = api("GET", f"clientes?select=id&origen_tallergp_id=eq.{cid_tgp}&limit=1")
    if not cli:
        print(f"✗ {plate}: cliente {cid_tgp} no está en DB — se omite"); continue
    cliente_id = cli[0]["id"]

    # origen que la RPC usará para encontrar el vehículo al importar la OT.
    import_origen = vid

    # ¿vehículo ya existe por origen_tallergp_id?
    _, ve = api("GET", f"vehiculos?select=id&origen_tallergp_id=eq.{vid}&limit=1")
    if ve:
        veh_id = ve[0]["id"]; print(f"• {plate}: vehículo ya existía ({veh_id})")
    else:
        # colisión de patente: ya hay un vehículo con esa placa (otro tallergp_id)
        _, col = api("GET", f"vehiculos?select=id,origen_tallergp_id&patente=eq.{plate}&limit=1")
        if col:
            veh_id = col[0]["id"]
            existente_origen = col[0].get("origen_tallergp_id")
            if existente_origen:
                # mismo auto, dos fichas en TallerGP → apuntar la OT al que ya existe
                import_origen = existente_origen
                print(f"• {plate}: existe con otro tallergp_id ({veh_id}) — apunto las OTs a ese")
            else:
                # ficha sin origen → completarla con este
                api("PATCH", f"vehiculos?id=eq.{veh_id}", {"origen_tallergp_id": vid})
                print(f"• {plate}: existía sin origen ({veh_id}) — le seteo el tallergp_id")
        else:
            st, res = api("POST", "vehiculos", {
                "org_id": ORG, "patente": plate, "vin": vin, "marca": marca, "modelo": modelo,
                "tipo": "auto", "origen_tallergp_id": vid, "creado_por": USER,
            }, prefer="return=representation")
            if st not in (200, 201):
                print(f"✗ {plate}: error creando vehículo: {res}"); continue
            veh_id = res[0]["id"]; print(f"✓ {plate}: vehículo creado ({veh_id})")

    # historia técnica (idempotente por UNIQUE vehiculo_id)
    _, ht = api("GET", f"historias_tecnicas?select=id&vehiculo_id=eq.{veh_id}&limit=1")
    if not ht:
        st, res = api("POST", "historias_tecnicas", {"vehiculo_id": veh_id, "org_id": ORG}, prefer="return=representation")
        if st not in (200, 201):
            print(f"  ✗ historia: {res}"); continue

    # propietario (si no hay uno activo)
    _, pv = api("GET", f"propietarios_vehiculo?select=id&vehiculo_id=eq.{veh_id}&fecha_fin=is.null&limit=1")
    if not pv:
        api("POST", "propietarios_vehiculo", {"vehiculo_id": veh_id, "cliente_id": cliente_id, "org_id": ORG})

    # reimportar las OTs de este vehículo (apuntando al origen efectivo)
    ok = skip = err = 0
    for o in ots:
        payload_ot = o if import_origen == vid else {**o, "vehicle_id": import_origen}
        st, res = api("POST", "rpc/fn_importar_ot_historica", {"p_org_id": ORG, "p_user_id": USER, "p_ot": payload_ot})
        if isinstance(res, dict) and res.get("ok"): ok += 1
        elif isinstance(res, dict) and res.get("skipped"): skip += 1
        else: err += 1; print(f"    ⚠ {o.get('order_number')}: {res}")
    tot_ok += ok; tot_skip += skip; tot_err += err
    print(f"  OTs -> ok={ok} skip={skip} err={err}")

print(f"\n=== TOTAL OTs rescatadas: ok={tot_ok} skip={tot_skip} err={tot_err} ===")
