import subprocess
import sys
import time
import webbrowser
import os

# Forzar codificación UTF-8 en terminales Windows para evitar UnicodeEncodeError
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def main():
    print("=" * 65)
    print("      🚀 INICIANDO CALCU | SUPPLYFINANCE SUITE (FASTAPI + VITE)")
    print("=" * 65)
    print("\n[1/3] Levantando Backend FastAPI (http://127.0.0.1:8000)...")
    
    # Iniciar servidor FastAPI
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
    )

    # Esperar para asegurar el inicio del backend
    time.sleep(2)

    print("[2/3] Levantando Frontend React + Vite + TypeScript (http://localhost:5173)...")
    frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
    
    # En Windows se usa npm.cmd
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_proc = subprocess.Popen(
        [npm_cmd, "run", "dev", "--", "--port", "5173"],
        cwd=frontend_dir
    )

    time.sleep(2)

    print("[3/3] Abriendo navegador...")
    webbrowser.open("http://localhost:5173")

    print("\n" + "=" * 65)
    print("  ✅ SUITE CALCU OPERATIVA Y DISPONIBLE:")
    print("     - Frontend Suite SPA:     http://localhost:5173")
    print("     - Swagger API & Docs:     http://127.0.0.1:8000/docs")
    print("     - Backend Health:         http://127.0.0.1:8000/health")
    print("=" * 65)
    print("\nPresiona CTRL + C en esta ventana para detener ambos servicios.\n")

    try:
        while True:
            if backend_proc.poll() is not None:
                print("⚠️ El proceso de Backend se detuvo.")
                break
            if frontend_proc.poll() is not None:
                print("⚠️ El proceso de Frontend se detuvo.")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nDeteniendo servicios...")
    finally:
        backend_proc.terminate()
        frontend_proc.terminate()
        print("Servicios detenidos correctamente.")

if __name__ == "__main__":
    main()
