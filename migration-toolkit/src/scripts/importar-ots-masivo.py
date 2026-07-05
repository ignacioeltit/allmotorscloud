#!/usr/bin/env python3
"""
Importa masivamente las OTs históricas respaldadas (JSON de TallerGP) a la base
All Motors, llamando fn_importar_ot_historica vía REST (service_role).

- Idempotente: la función salta las OTs cuyo numero_ot ya existe.
- Concurrente (pool de hilos) porque cada OT es una transacción independiente.
- Clasifica resultados y guarda un reporte con los errores para decidir después.

Uso:  python3 importar-ots-masivo.py [--workers N] [--limit N]
"""
import json, os, glob, sys, time, threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter
import urllib.request, urllib.error

ORG_ID  = "1c3df5cb-ff3e-4ce7-b7ae-bdce14a0791a"   # Taller Demo
USER_ID = "c0a7525b-06ed-4baa-9690-8888918156aa"   # Admin Demo

HERE = os.path.dirname(os.path.abspath(__file__))
BACKUP_DIR = os.path.join(HERE, "..", "..", "exports", "backup", "repair-orders")
ENV_PATH = os.path.join(HERE, "..", "..", "..", "apps", "web", ".env.local")
REPORT = os.path.join(HERE, "..", "..", "reports", "import-ots-reporte.json")


def load_env():
    env = {}
    with open(ENV_PATH) as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def main():
    workers = 6
    limit = None
    args = sys.argv[1:]
    for i, a in enumerate(args):
        if a == "--workers": workers = int(args[i + 1])
        if a == "--limit":   limit = int(args[i + 1])

    env = load_env()
    url = env["NEXT_PUBLIC_SUPABASE_URL"]
    srk = env["SUPABASE_SERVICE_ROLE_KEY"]
    assert "ixnugbxetmkmxfwutxbz" in url, f"proyecto inesperado: {url}"
    endpoint = f"{url}/rest/v1/rpc/fn_importar_ot_historica"
    headers = {"apikey": srk, "Authorization": f"Bearer {srk}", "Content-Type": "application/json"}

    files = sorted(glob.glob(os.path.join(BACKUP_DIR, "*.json")))
    if limit: files = files[:limit]
    total = len(files)
    print(f"OTs a procesar: {total} | workers: {workers}")

    counts = Counter()
    errores = []   # (numero_ot|archivo, motivo)
    lock = threading.Lock()
    done = [0]

    def procesar(path):
        try:
            ot = json.load(open(path))
        except Exception as e:
            return ("archivo_ilegible", os.path.basename(path), str(e))
        payload = json.dumps({"p_org_id": ORG_ID, "p_user_id": USER_ID, "p_ot": ot}).encode()
        for intento in range(3):
            try:
                req = urllib.request.Request(endpoint, data=payload, headers=headers)
                with urllib.request.urlopen(req, timeout=30) as resp:
                    r = json.loads(resp.read().decode())
                if r.get("ok"):        return ("ok", r.get("numero_ot"), None)
                if r.get("skipped"):   return ("skipped", r.get("numero_ot"), None)
                return ("error", r.get("numero_ot") or os.path.basename(path), r.get("error"))
            except urllib.error.HTTPError as e:
                body = e.read().decode()[:200]
                if e.code in (429, 500, 502, 503, 504) and intento < 2:
                    time.sleep(1.5 * (intento + 1)); continue
                return ("http_error", os.path.basename(path), f"{e.code}: {body}")
            except Exception as e:
                if intento < 2: time.sleep(1.0); continue
                return ("excepcion", os.path.basename(path), str(e))

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(procesar, f): f for f in files}
        for fut in as_completed(futs):
            estado, ident, motivo = fut.result()
            with lock:
                counts[estado if motivo is None else f"{estado}:{motivo}"] += 1
                counts["_" + estado] += 1
                if motivo is not None:
                    errores.append({"ot": ident, "estado": estado, "motivo": motivo})
                done[0] += 1
                if done[0] % 250 == 0 or done[0] == total:
                    el = time.time() - t0
                    print(f"  {done[0]}/{total}  ok={counts['_ok']} skip={counts['_skipped']} "
                          f"err={counts['_error']+counts['_http_error']+counts['_excepcion']}  ({el:.0f}s)")

    print("\n=== RESUMEN ===")
    for k in sorted(counts):
        if not k.startswith("_"):
            print(f"  {k}: {counts[k]}")
    os.makedirs(os.path.dirname(REPORT), exist_ok=True)
    json.dump({"resumen": dict(counts), "errores": errores}, open(REPORT, "w"), ensure_ascii=False, indent=2)
    print(f"\nReporte -> {REPORT}  ({len(errores)} con problema)")


if __name__ == "__main__":
    main()
