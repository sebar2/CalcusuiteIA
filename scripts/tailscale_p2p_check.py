#!/usr/bin/env python3
"""
Herramienta CLI de Verificación P2P Direct Connection en Tailscale - Calcu 3PL
Asegura que los choferes móviles y terminales operen sin pasar por servidores relay DERP.
"""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.tailscale_p2p import TailscaleP2PDiagnoser

def main():
    print("=" * 70)
    print(" CALCU 3PL: DIAGNÓSTICO DE LATENCIA Y DIRECT PEER-TO-PEER (TAILSCALE)")
    print("=" * 70)

    result = TailscaleP2PDiagnoser.get_tailscale_status()

    if not result.get("available"):
        print(f"[!] ERROR / AVISO: {result.get('error')}")
        print("\nRecomendaciones:")
        for r in result.get("recommendations", []):
            print(f"  * {r}")
        sys.exit(0)

    print(f"[*] Nodo Local: {result.get('self_hostname')} ({result.get('self_tailscale_ip')})")
    print(f"[*] Peers Conectados: {result.get('total_peers')}")
    print(f"[*] Conexiones Directas P2P (UDP WireGuard): {result.get('direct_count')}")
    print(f"[*] Conexiones DERP Relay (con sobrecarga): {result.get('derp_relay_count')}")

    if result.get("p2p_direct_peers"):
        print("\n[+] NODOS DIRECTOS P2P (BAJA LATENCIA):")
        for p in result["p2p_direct_peers"]:
            print(f"    - {p['hostname']} ({p['tailscale_ip']}) [{p['os']}] -> {p['cur_addr']}")

    if result.get("derp_relay_peers"):
        print("\n[-] NODOS EN RELAY DERP (REQUERIDA OPTIMIZACIÓN):")
        for p in result["derp_relay_peers"]:
            print(f"    - {p['hostname']} ({p['tailscale_ip']}) [{p['os']}] -> Relay: {p['relay_derp']}")

    print("\n" + "-" * 70)
    print("DIRECTRICES DE LATENCIA:")
    for r in result.get("recommendations", []):
        print(f"  > {r}")
    print("=" * 70)

if __name__ == "__main__":
    main()
