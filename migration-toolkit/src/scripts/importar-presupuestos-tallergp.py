#!/usr/bin/env python3
"""Importa a `presupuestos_tallergp` los presupuestos capturados de TallerGP.

Por defecto solo los de los últimos 60 días y que calcen con un vehículo ya
existente (por patente normalizada). Idempotente: upsert por (org_id, budget_id).

Uso:
    python3 importar-presupuestos-tallergp.py [--dias 60] [--dry-run]
"""
import argparse
import datetime
import glob
import json
import os
import re
import sys
import urllib.request

BUDGETS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "exports", "backup", "budgets")
ENV_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "apps", "web", ".env.local")
HOY = datetime.date(2026, 7, 15)  # fecha de referencia del sistema
TIPO = {"parts": "repuesto", "labors": "mano_obra", "others": "otros",
        "paints": "otros", "tyres": "repuesto"}


def env(key):
    for line in open(ENV_PATH, encoding="utf-8"):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit(f"Falta {key} en {ENV_PATH}")


def norm_plate(p):
    return re.sub(r"[^A-Z0-9]", "", (p or "").upper())


def parse_fecha(s):
    for f in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.datetime.strptime(s, f).date()
        except (ValueError, TypeError):
            pass
    return None


def rest(url, key, path, method="GET", body=None, extra_headers=None):
    req = urllib.request.Request(url + path, method=method)
    req.add_header("apikey", key)
    req.add_header("Authorization", "Bearer " + key)
    req.add_header("Content-Type", "application/json")
    for k, v in (extra_headers or {}).items():
        req.add_header(k, v)
    data = json.dumps(body).encode() if body is not None else None
    with urllib.request.urlopen(req, data=data) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else None


def cargar_mapa_vehiculos(url, key):
    """patente_normalizada -> (vehiculo_id, org_id)."""
    mapa = {}
    off = 0
    while True:
        rows = rest(url, key, f"/rest/v1/vehiculos?select=id,org_id,patente&limit=1000&offset={off}")
        if not rows:
            break
        for v in rows:
            mapa[norm_plate(v["patente"])] = (v["id"], v["org_id"])
        if len(rows) < 1000:
            break
        off += 1000
    return mapa


def construir_lineas(d):
    out = []
    lines = d.get("lines") or {}
    for grupo, tipo in TIPO.items():
        for ln in lines.get(grupo) or []:
            try:
                cantidad = float(ln.get("quantity") or 0)
                precio = float(ln.get("unit_price") or 0)
                total = float(ln.get("total_with_discount") or 0)
            except (ValueError, TypeError):
                continue
            out.append({
                "tipo": tipo,
                "codigo": ln.get("reference"),
                "descripcion": (ln.get("description") or "").strip(),
                "cantidad": cantidad,
                "precio_unitario": round(precio),
                "total": round(total),
            })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dias", type=int, default=60)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    url = env("NEXT_PUBLIC_SUPABASE_URL")
    key = env("SUPABASE_SERVICE_ROLE_KEY")
    corte = HOY - datetime.timedelta(days=args.dias)

    print(f"Vehículos: cargando mapa de patentes…", flush=True)
    veh = cargar_mapa_vehiculos(url, key)
    print(f"  {len(veh)} patentes en la base.")

    filas = []
    saltados = {"vieja": 0, "sin_veh": 0, "sin_lineas": 0}
    for f in glob.glob(os.path.join(BUDGETS_DIR, "*.json")):
        try:
            d = json.load(open(f, encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if d.get("deleted"):
            continue
        fecha = parse_fecha(d.get("created_at"))
        if not fecha or fecha < corte:
            saltados["vieja"] += 1
            continue
        p = norm_plate(d.get("plate"))
        match = veh.get(p)
        if not match:
            saltados["sin_veh"] += 1
            continue
        lineas = construir_lineas(d)
        if not lineas:
            saltados["sin_lineas"] += 1
            continue
        vehiculo_id, org_id = match
        filas.append({
            "org_id": org_id,
            "tallergp_budget_id": d.get("budget_id"),
            "vehiculo_id": vehiculo_id,
            "patente": p,
            "numero": d.get("budget_number"),
            "estado": d.get("status_name"),
            "fecha": fecha.isoformat(),
            "cliente_nombre": d.get("client_full_name"),
            "total_neto": round(float(d.get("total_without_vat") or 0)),
            "total_con_iva": round(float(d.get("total_with_vat") or 0)),
            "lineas": lineas,
        })

    print(f"A importar: {len(filas)} presupuestos (desde {corte}).")
    print(f"  Saltados: {saltados}")
    if args.dry_run:
        print("DRY-RUN: no se escribe nada.")
        if filas:
            print("Ejemplo:", json.dumps(filas[0], ensure_ascii=False)[:400])
        return

    # Upsert por lotes (idempotente por la constraint org_id+tallergp_budget_id).
    for i in range(0, len(filas), 100):
        lote = filas[i:i + 100]
        rest(url, key,
             "/rest/v1/presupuestos_tallergp?on_conflict=org_id,tallergp_budget_id",
             method="POST", body=lote,
             extra_headers={"Prefer": "resolution=merge-duplicates,return=minimal"})
        print(f"  {min(i + 100, len(filas))}/{len(filas)}", flush=True)
    print("Listo.")


if __name__ == "__main__":
    main()
