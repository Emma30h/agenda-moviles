"""
Importa a Supabase la flota, las nóminas y las designaciones del SAE.

    python scripts/importar_datos.py RUTA_RECURSOS            -> solo muestra el resumen (no carga nada)
    python scripts/importar_datos.py RUTA_RECURSOS --cargar   -> carga en Supabase

Lee la clave service_role de .env.local (nunca la muestra). Se puede correr de
nuevo: actualiza por dominio, DNI y nombre, y rehace las situaciones importadas.
Guarda solo campos operativos: nada de domicilio, teléfono, armamento, chaleco
ni diagnósticos. Los archivos de datos NO van al repositorio.
"""
import csv, collections, datetime as dt, json, os, re, sys, urllib.request, urllib.error
import openpyxl

HOY = dt.date.today()
AQUI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FLOTAS = [("FLOTA MOVILES OJOS EN ALERTA ACTUALIZADA-2.xlsx", "ojos_en_alerta"), ("FLOTA MOVILES POLICIALES ACTUALIZADA.xlsx", "policial")]
NOMINAS = ["NOMINA DPCN.xlsx", "NOMINA DPCS.xlsx"]
SAE = "Designaciones radiales SAE.csv"

SUBOFICIAL = ["Agente", "Cabo", "Cabo Primero", "Sargento", "Sargento Primero", "Sargento Ayudante", "Suboficial Principal", "Suboficial Mayor"]
OFICIAL = ["Oficial Ayudante", "Oficial Subinspector", "Oficial Inspector", "Oficial Principal", "Subcomisario", "Comisario", "Comisario Inspector", "Comisario Mayor", "Comisario General"]
JERARQUIA = {j.upper(): j for j in SUBOFICIAL + OFICIAL}
DIVISIONES_DG = {"D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13", "D14", "D15", "D19", "D20", "D22", "D23", "D24BIS"}
CIVILES = {"PERSONAL CIVIL", "OP. ADMINISTRATIVO", "OPERADOR DE CAMARAS"}

aviso = collections.Counter()   # problemas encontrados, para el resumen


def plano(s):
    s = str(s or "").upper().strip()
    for a, b in zip("ÁÉÍÓÚÜ", "AEIOUU"):
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", s)


def unidad_de(direccion, depto, division):
    d, p, v = plano(direccion), plano(depto), plano(division)
    m = re.search(r"TERRITORIAL (\d+)( BIS)?", v)
    if m:
        return "D" + m.group(1) + ("BIS" if m.group(2) else "")
    for clave, uid in [("ALERTA Y COORD", "DAC"), ("PERSONAL Y LOG", "DPL"), ("SOCIO", "DSOC"), ("AYUDANT", "DAY"), ("EPAT", "EPAT"), ("ANALISIS", "DAE")]:
        if clave in v:
            return uid
    for clave, uid in [("TERRITORIAL NORTE", "N-Norte"), ("TERRITORIAL ESTE", "N-Este"), ("TERRITORIAL CENTRO", "S-Centro"),
                       ("TERRITORIAL OESTE", "S-Oeste"), ("TERRITORIAL SUR", "S-Sur"), ("ALERTA CIUDADANA", "M-AC"),
                       ("LOGISTICA", "SUB-LOG"), ("SOCIOEDUCATIVO", "M-SOC")]:
        if clave in p:
            return uid
    for clave, uid in [("SUBDIRECCION", "SUB"), ("CIUDADANA NORTE", "N"), ("CIUDADANA SUR", "S"), ("MONITOREO", "M")]:
        if clave in d:
            return uid
    if v or p or d:
        aviso["unidad no reconocida (se carga en la Dirección General)"] += 1
    return "G"


def hoja(archivo):
    ws = openpyxl.load_workbook(archivo, read_only=True, data_only=True).worksheets[0]
    filas = [r for r in ws.iter_rows(values_only=True) if any(c not in (None, "") for c in r)]
    i = next(k for k, r in enumerate(filas) if r[0] in ("Nº", "ORDEN"))
    cab = [str(c).strip() if c else "" for c in filas[i]]
    return cab, filas[i + 1:]


def fecha(x):
    if isinstance(x, dt.datetime):
        return x.date()
    if isinstance(x, dt.date):
        return x
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", str(x or ""))
    return dt.date(int(m.group(3)), int(m.group(2)), int(m.group(1))) if m else None


# ------------------------------------------------------------------ flota
def leer_flota(ruta):
    moviles, internos = {}, {}
    for archivo, programa in FLOTAS:
        cab, filas = hoja(os.path.join(ruta, archivo))
        c = {k: cab.index(k) for k in ["MATRICULA INT. Nº", "DIRECCION", "DEPARTAMENTO", "DIVISIÓN", "DOMINIO", "TIPO", "MARCA", "MODELO"]}
        for r in filas:
            dom = re.sub(r"[^A-Z0-9]", "", plano(r[c["DOMINIO"]]))
            if not dom:
                continue
            if not re.fullmatch(r"[A-Z0-9]{6,7}", dom):
                aviso["dominio con formato raro (no se carga)"] += 1
                continue
            if dom in moviles:
                aviso["dominio repetido (se toma el primero)"] += 1
                continue
            num = re.sub(r"\D", "", str(r[c["MATRICULA INT. Nº"]] or ""))
            interno = int(num) if num else None
            baja = "BAJA" in plano(r[c["DIVISIÓN"]])
            m = {
                "dominio": dom, "programa": programa, "interno": interno,
                "tipo": (str(r[c["TIPO"]] or "").strip().title() or None),
                "marca": (str(r[c["MARCA"]] or "").strip().upper() or None),
                "modelo": (str(r[c["MODELO"]] or "").strip() or None),
                "unidad": unidad_de(r[c["DIRECCION"]], r[c["DEPARTAMENTO"]], "" if baja else r[c["DIVISIÓN"]]),
                "activo": not baja, "baja_motivo": "Trámite de baja" if baja else None,
                "baja_fecha": HOY.isoformat() if baja else None,
                "revisar": None, "origen": "importacion",
            }
            if interno is not None and interno in internos:
                m["revisar"] = f"El interno {interno} figuraba también en {internos[interno]}: cargá el interno correcto."
                m["interno"] = None
                aviso[f"interno {interno} repetido: {dom} queda sin interno para corregir"] += 1
            elif interno is not None:
                internos[interno] = dom
            moviles[dom] = m
    return list(moviles.values())


# ------------------------------------------------------------------ personal
SIT_ADMIN = {
    "LICENCIA ESPECIAL (MEDICA)": ("Licencia médica", None, "med"), "LICENCIA MEDICA": ("Licencia médica", None, "med"),
    "CARPETA MEDICA": ("Licencia médica", None, "med"), "EXCESO LICENCIA MEDICA": ("Licencia médica", None, "med"),
    "LICENCIA ANUAL ORDINARIA": ("Licencia anual", None, "anual"),
    "LICENCIA EXTRAORDINARIA": ("Licencia especial", "Extraordinaria", None), "LICENCIA EXCEPCIONAL": ("Licencia especial", "Excepcional", None),
    "FALLECIMIENTO DE FAMILIAR": ("Licencia especial", "Fallecimiento de familiar", None),
    "SUSPENSION PREVENTIVA": ("Suspensión preventiva", None, "med"), "SUSPENSION": ("Suspensión preventiva", None, "med"),
    "ADSCRIPCION": ("Otra", "Adscripción", None), "BAJA EN TRAMITE": ("Otra", "Baja en trámite", None),
    "EXAMEN EN CURSOS NO POLICIALES": ("Otra", "Examen en cursos no policiales", None),
    "DETENIDO": ("Otra", "Situación administrativa especial", None),
}


def leer_personal(ruta):
    personas, situaciones = {}, []
    for archivo in NOMINAS:
        cab, filas = hoja(os.path.join(ruta, archivo))
        ix = lambda nombre, n=0: [k for k, x in enumerate(cab) if x == nombre][n]
        c = {k: ix(k) for k in ["DNI", "JERARQUIA", "APELLIDO Y NOMBRE", "DIRECCIÓN GENERAL", "DEPARTAMENTO", "DIVISIÓN", "FUNCION",
                                "PERSONAL DE CALLE", "GUARDIA", "HORARIO", "SITUACION REVISTA", "SITUACION ADMINISTRATIVA", "TNO",
                                "T.N.O. DESDE", "T.N.O. HASTA", "MEDICA HASTA", "ANUAL HASTA"]}
        c["MED DESDE"], c["ANUAL DESDE"] = ix("LICENCIA DESDE", 0), ix("LICENCIA DESDE", 1)
        for r in filas:
            v = lambda k: r[c[k]] if c[k] < len(r) else None
            dni = re.sub(r"\D", "", str(v("DNI") or ""))
            if not re.fullmatch(r"\d{7,8}", dni):
                aviso["DNI inválido (no se carga)"] += 1
                continue
            if dni in personas:
                aviso["persona repetida entre o dentro de las nóminas (se toma una)"] += 1
                continue
            jer_txt = plano(v("JERARQUIA"))
            if jer_txt in CIVILES:
                tipo, jer = "civil_policial", None
            elif jer_txt in JERARQUIA:
                tipo, jer = "seguridad", JERARQUIA[jer_txt]
            else:
                aviso[f"jerarquía desconocida «{jer_txt}» (se carga como Civil Policial)"] += 1
                tipo, jer = "civil_policial", None
            nom = str(v("APELLIDO Y NOMBRE") or "").strip()
            ape, _, nombre = nom.partition(",")
            guardia = plano(v("GUARDIA")).replace("ADMINISTRATIVO", "ADMINISTRATIVA") or None
            horario = re.sub(r"\s+", " ", plano(v("HORARIO")).replace(".", ":").replace("HS", "")).strip() or None
            revista = str(v("SITUACION REVISTA") or "").strip().capitalize() or None
            personas[dni] = {
                "dni": dni, "apellido": ape.strip().upper(), "nombre": nombre.strip(), "tipo_personal": tipo, "jerarquia": jer,
                "unidad": unidad_de(v("DIRECCIÓN GENERAL"), v("DEPARTAMENTO"), v("DIVISIÓN")),
                "funcion": (str(v("FUNCION") or "").strip().capitalize() or None),
                "calle": plano(v("PERSONAL DE CALLE")) == "SI", "guardia": guardia, "horario": horario, "revista": revista,
                "activo": True, "origen": "importacion",
            }

            def agregar(tipo_sit, detalle, desde, hasta):
                desde, hasta = fecha(desde), fecha(hasta)
                if hasta and hasta < HOY:
                    aviso["situación ya terminada (no se carga)"] += 1
                    return
                if hasta and desde and hasta < desde:
                    desde = None
                situaciones.append({"dni": dni, "tipo": tipo_sit, "detalle": detalle, "desde": (desde or HOY).isoformat(),
                                    "hasta": hasta.isoformat() if hasta else None, "origen": "importacion"})

            if plano(v("TNO")) == "SI":
                agregar("TNO", None, v("T.N.O. DESDE"), v("T.N.O. HASTA"))
            adm = plano(v("SITUACION ADMINISTRATIVA"))
            if adm and adm != "NORMAL":
                if adm in SIT_ADMIN:
                    t, det, fechas = SIT_ADMIN[adm]
                    if fechas == "anual":
                        agregar(t, det, v("ANUAL DESDE"), v("ANUAL HASTA"))
                    elif fechas == "med":
                        agregar(t, det, v("MED DESDE"), v("MEDICA HASTA"))
                    else:
                        agregar(t, det, None, None)
                else:
                    aviso[f"situación administrativa desconocida «{adm}» (no se carga)"] += 1
            if plano(revista) in ("PASIVA", "DISPONIBILIDAD"):
                agregar("Otra", f"Situación de revista: {revista}", None, None)
    return list(personas.values()), situaciones


# ------------------------------------------------------------------ designaciones SAE
def leer_designaciones(ruta):
    salida = []
    with open(os.path.join(ruta, SAE), encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f, delimiter=";"):
            dp = (r.get("distrito_principal") or "").strip().upper()
            m = re.fullmatch(r"D(\d+)( ?BIS)?", dp)
            unidad = ("D24BIS" if m and m.group(1) == "24" else "D" + m.group(1)) if m else None
            if unidad not in DIVISIONES_DG:
                aviso["designación de una división fuera de la Dirección General (queda sin división)"] += 1
                unidad = None
            alias = sorted({a for a in (r.get("variantes_escritura") or "").split() if a and a != r["nombre"]})
            salida.append({"nombre": r["nombre"].strip(), "tipo": (r.get("tipo") or "").strip() or None, "zona": (r.get("zona") or "").strip() or None,
                           "unidad": unidad, "distritos": (r.get("distritos") or "").strip() or None, "alias": alias,
                           "usos": int(r.get("sucesos") or 0), "activa": True, "origen": "sae"})
    return salida


# ------------------------------------------------------------------ Supabase
def entorno():
    env = {}
    with open(os.path.join(AQUI, ".env.local"), encoding="utf-8") as f:
        for linea in f:
            if re.match(r"^[A-Z_]+=", linea):
                k, _, v = linea.strip().partition("=")
                env[k] = v
    return env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]


def pedir(metodo, ruta, datos=None, extra=""):
    url, key = entorno()
    req = urllib.request.Request(f"{url}/rest/v1/{ruta}", method=metodo, data=json.dumps(datos).encode() if datos is not None else None,
                                 headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
                                          "Prefer": "return=minimal" + extra})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status
    except urllib.error.HTTPError as e:
        sys.exit(f"Error de Supabase en {ruta}: {e.code} {e.read().decode()[:400]}")


def subir(tabla, filas, clave):
    for i in range(0, len(filas), 500):
        pedir("POST", f"{tabla}?on_conflict={clave}", filas[i:i + 500], ",resolution=merge-duplicates")


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    ruta = sys.argv[1]
    moviles = leer_flota(ruta)
    personas, situaciones = leer_personal(ruta)
    designaciones = leer_designaciones(ruta)

    print("Móviles:", len(moviles), dict(collections.Counter(m["programa"] for m in moviles)), "· de baja:", sum(not m["activo"] for m in moviles))
    print("  por unidad:", dict(collections.Counter(m["unidad"] for m in moviles).most_common()))
    print("Personal:", len(personas), dict(collections.Counter(p["tipo_personal"] for p in personas)), "· de calle:", sum(p["calle"] for p in personas))
    print("  por Dirección:", dict(collections.Counter(p["unidad"] for p in personas).most_common(12)), "…")
    print("Situaciones vigentes o futuras:", len(situaciones), dict(collections.Counter(s["tipo"] for s in situaciones)))
    print("Designaciones SAE:", len(designaciones), "· sin división:", sum(d["unidad"] is None for d in designaciones))
    print("Avisos:")
    for k, v in aviso.most_common():
        print(f"  - {v} × {k}")

    if "--cargar" not in sys.argv:
        print("\nNo se cargó nada. Para cargar, agregá --cargar.")
        return
    subir("designacion", designaciones, "nombre")
    subir("movil", moviles, "dominio")
    subir("personal", personas, "dni")
    pedir("DELETE", "situacion_personal?origen=eq.importacion")
    subir("situacion_personal", situaciones, "id")
    print("\nCarga completa.")


if __name__ == "__main__":
    main()
