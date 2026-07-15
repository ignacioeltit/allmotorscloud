#!/usr/bin/env python3
"""Crea en All Motors los clientes y vehículos faltantes para presupuestos de
TallerGP de los últimos N días cuyo vehículo aún no existe, y les asigna el
propietario. Idempotente: no duplica clientes (match por RUT normalizado) ni
vehículos (match por patente). Luego hay que correr el import de presupuestos.

Uso: python3 importar-vehiculos-clientes-faltantes.py [--dias 30] [--dry-run]
"""
import argparse, datetime, glob, json, os, re, sys, urllib.request, urllib.error, urllib.parse

TOOLKIT = os.path.join(os.path.dirname(__file__), "..", "..")
BUDGETS = os.path.join(TOOLKIT, "exports", "backup", "budgets")
CUSTOMERS = os.path.join(TOOLKIT, "exports", "backup", "customers")
ENV = os.path.join(TOOLKIT, "..", "apps", "web", ".env.local")
HOY = datetime.date(2026, 7, 15)
EMPRESA_KW = ("SPA", "LTDA", "LIMITADA", " SA", "S.A", "MUNICIPALIDAD", "EMPRESA",
              "INVERSIONES", "DEPARTAMENTO", "COMERCIAL", "SOCIEDAD", "EIRL", "SERVICIOS")


def env(key):
    for line in open(ENV, encoding="utf-8"):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("Falta " + key)


def norm_plate(p): return re.sub(r"[^A-Z0-9]", "", (p or "").upper())
def norm_rut(r): return re.sub(r"[^0-9K]", "", (r or "").upper())


def parse_fecha(s):
    for f in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try: return datetime.datetime.strptime(s, f).date()
        except (ValueError, TypeError): pass
    return None


def rest(url, key, path, method="GET", body=None, prefer=None):
    req = urllib.request.Request(url + path, method=method)
    req.add_header("apikey", key); req.add_header("Authorization", "Bearer " + key)
    req.add_header("Content-Type", "application/json")
    if prefer: req.add_header("Prefer", prefer)
    data = json.dumps(body).encode() if body is not None else None
    with urllib.request.urlopen(req, data=data) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else None


def cargar_clientes_tgp():
    idx = {}
    for f in glob.glob(os.path.join(CUSTOMERS, "*.json")):
        for c in json.load(open(f, encoding="utf-8")).get("data", []):
            idx[c["id"]] = c
    return idx


def tipo_cliente(nombre):
    u = (nombre or "").upper()
    return "empresa" if any(k in u for k in EMPRESA_KW) else "persona_natural"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dias", type=int, default=30)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    url, key = env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY")
    corte = HOY - datetime.timedelta(days=args.dias)

    org_id = rest(url, key, "/rest/v1/clientes?select=org_id&limit=1")[0]["org_id"]
    clientes_tgp = cargar_clientes_tgp()

    # patentes existentes
    db_plates = set()
    off = 0
    while True:
        rows = rest(url, key, f"/rest/v1/vehiculos?select=patente&limit=1000&offset={off}")
        if not rows: break
        db_plates |= {norm_plate(v["patente"]) for v in rows}
        if len(rows) < 1000: break
        off += 1000

    # presupuestos objetivo: últimos N días, con líneas, patente NO en DB
    objetivo = {}  # patente_norm -> budget dict (uno por patente)
    for f in glob.glob(os.path.join(BUDGETS, "*.json")):
        try: d = json.load(open(f, encoding="utf-8"))
        except (json.JSONDecodeError, OSError): continue
        if d.get("deleted"): continue
        fe = parse_fecha(d.get("created_at"))
        if not fe or fe < corte: continue
        L = d.get("lines") or {}
        if not any(L.get(g) for g in ("parts", "labors", "others", "paints", "tyres")): continue
        p = norm_plate(d.get("plate"))
        if not p or p in db_plates: continue
        objetivo.setdefault(p, d)

    print(f"Vehículos faltantes a crear: {len(objetivo)} (desde {corte})")

    cache_cli = {}  # rut_norm o nombre -> cliente_id
    creados_cli = creados_veh = 0
    for p, d in objetivo.items():
        cli = clientes_tgp.get(d.get("client_id")) or {}
        nombre = " ".join(str(cli.get(k) or "").strip() for k in ("name", "lastname", "surname")).strip() \
                 or (d.get("client_full_name") or "").strip() or "Cliente sin nombre"
        rut = (cli.get("vat_number") or "").strip()
        tel = (cli.get("mobile") or cli.get("phone") or "").strip()
        email = (cli.get("mail") or "").strip()
        direccion = (cli.get("address") or cli.get("location") or "").strip()
        rn = norm_rut(rut)
        clave = rn or nombre.upper()

        if args.dry_run:
            print(f"  {p}: {d.get('brand')} {d.get('model')} → {nombre} (RUT {rut or '—'})")
            continue

        # 1) cliente: cache → match por rut_norm → match por nombre → crear
        cliente_id = cache_cli.get(clave)
        if not cliente_id and rn:
            hit = rest(url, key, f"/rest/v1/clientes?select=id&rut_norm=eq.{rn}&limit=1")
            if hit: cliente_id = hit[0]["id"]
        if not cliente_id:
            val = urllib.parse.quote('"' + nombre.replace('"', '') + '"', safe="")
            hit = rest(url, key, "/rest/v1/clientes?select=id&limit=1&nombre=eq." + val)
            if hit: cliente_id = hit[0]["id"]
        if not cliente_id:
            body = {"org_id": org_id, "tipo": tipo_cliente(nombre), "nombre": nombre[:255]}
            if rut: body["rut"] = rut[:20]
            if tel: body["telefono"] = tel[:50]
            if email and "@" in email: body["email"] = email[:255]
            if direccion: body["direccion"] = direccion[:255]
            cliente_id = rest(url, key, "/rest/v1/clientes", "POST", [body], "return=representation")[0]["id"]
            creados_cli += 1
        cache_cli[clave] = cliente_id

        # 2) vehículo (por si ya existe, match por patente)
        hit = rest(url, key, f"/rest/v1/vehiculos?select=id&patente=eq.{p}&limit=1")
        if hit:
            vehiculo_id = hit[0]["id"]
        else:
            anio = None
            fr = parse_fecha(d.get("vehicle_registration_date"))
            if fr and 1900 <= fr.year <= HOY.year + 1: anio = fr.year
            vb = {"org_id": org_id, "patente": p, "tipo": "auto",
                  "marca": (d.get("brand") or "—")[:100], "modelo": (d.get("model") or "—")[:100]}
            if anio: vb["anio"] = anio
            if d.get("vin"): vb["vin"] = d["vin"][:20]
            if d.get("vehicle_color"): vb["color"] = d["vehicle_color"][:50]
            vehiculo_id = rest(url, key, "/rest/v1/vehiculos", "POST", [vb], "return=representation")[0]["id"]
            creados_veh += 1

        # 3) propietario (si no tiene uno activo)
        act = rest(url, key, f"/rest/v1/propietarios_vehiculo?select=id&vehiculo_id=eq.{vehiculo_id}&fecha_fin=is.null&limit=1")
        if not act:
            rest(url, key, "/rest/v1/propietarios_vehiculo", "POST",
                 [{"org_id": org_id, "vehiculo_id": vehiculo_id, "cliente_id": cliente_id}], "return=minimal")

    print(f"Clientes creados: {creados_cli} | Vehículos creados: {creados_veh}")


if __name__ == "__main__":
    main()
