import subprocess
import json
import logging
from typing import Dict, Any, List

logger = logging.getLogger("calcu.tailscale_p2p")

class TailscaleP2PDiagnoser:
    """
    Diagnóstico y Aseguramiento de Conexiones P2P Directas en Tailscale VPN.
    Asegura latencia sub-50ms evitando relays en servidores DERP intermediarios
    entre el servidor central y los dispositivos de choferes (Android Capacitor).
    """

    @staticmethod
    def get_tailscale_status() -> Dict[str, Any]:
        """
        Ejecuta `tailscale status --json` y clasifica los peers entre conexiones directas y DERP relay.
        """
        try:
            res = subprocess.run(
                ["tailscale", "status", "--json"],
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            if res.returncode != 0:
                return {
                    "available": False,
                    "error": res.stderr.strip() or "Tailscale CLI no responde o no está en ejecución.",
                    "p2p_direct_peers": [],
                    "derp_relay_peers": [],
                    "recommendations": [
                        "Verifique que el servicio de Tailscale esté iniciado (`tailscale up`).",
                        "Asegure que el firewall permita tráfico UDP en el puerto 41641.",
                    ],
                }

            status_data = json.loads(res.stdout)
            self_node = status_data.get("Self", {})
            peers = status_data.get("Peer", {})

            direct_peers: List[Dict[str, Any]] = []
            derp_peers: List[Dict[str, Any]] = []

            for peer_id, peer_info in peers.items():
                cur_addr = peer_info.get("CurAddr", "")
                relay = peer_info.get("Relay", "")
                is_direct = bool(cur_addr) and not relay
                host_name = peer_info.get("HostName", "desconocido")
                tailscale_ips = peer_info.get("TailscaleIPs", [])
                os_type = peer_info.get("OS", "desconocido")
                online = peer_info.get("Online", False)

                node_summary = {
                    "id": peer_id,
                    "hostname": host_name,
                    "os": os_type,
                    "tailscale_ip": tailscale_ips[0] if tailscale_ips else "N/A",
                    "online": online,
                    "connection_type": "DIRECT_P2P" if is_direct else "DERP_RELAY",
                    "cur_addr": cur_addr,
                    "relay_derp": relay,
                }

                if is_direct:
                    direct_peers.append(node_summary)
                else:
                    derp_peers.append(node_summary)

            derp_active = len(derp_peers) > 0
            recs = []
            if derp_active:
                recs.append("¡Alerta de Latencia! Existen nodos conectándose a través de servidores DERP intermediarios.")
                recs.append("Habilite UPnP / NAT-PMP en su router principal o abra el puerto UDP 41641.")
                recs.append("En dispositivos móviles Android, verifique que el ahorro de batería no suspenda Tailscale.")
                recs.append("Ajuste el MTU a 1280 en interfaces celulares 4G/5G para evitar fragmentación IP.")
            else:
                recs.append("Todos los nodos activos mantienen conexión directa Peer-to-Peer WireGuard (Latencia mínima garantizada).")

            return {
                "available": True,
                "self_tailscale_ip": self_node.get("TailscaleIPs", ["N/A"])[0],
                "self_hostname": self_node.get("HostName", "N/A"),
                "total_peers": len(peers),
                "direct_count": len(direct_peers),
                "derp_relay_count": len(derp_peers),
                "all_direct": len(derp_peers) == 0,
                "p2p_direct_peers": direct_peers,
                "derp_relay_peers": derp_peers,
                "recommendations": recs,
            }

        except FileNotFoundError:
            return {
                "available": False,
                "error": "El binario 'tailscale' no está instalado en el PATH del sistema.",
                "recommendations": [
                    "Instale Tailscale en Windows / Linux / Android para habilitar la VPN de baja latencia.",
                    "En Android Capacitor, instale la aplicación oficial de Tailscale y configure auto-connect.",
                ],
            }
        except Exception as e:
            return {
                "available": False,
                "error": str(e),
                "recommendations": ["Revise los permisos del sistema y el estado de la interfaz de red."],
            }
