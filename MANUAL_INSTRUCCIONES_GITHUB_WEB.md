# MANUAL DE INSTRUCCIONES OPERATIVO: DESPLIEGUE Y MANTENIMIENTO DE LA WEB PÚBLICA EN GITHUB PAGES

## REGLA INQUEBRANTABLE DE DESTINOS DE REPOSITORIO
* **Página Web Pública (https://calcusuiteia.com/):**
  - Directorio local: `C:\Calcu-Web`
  - Repositorio remoto: `https://github.com/sebar2/CalcusuiteIA.git` (rama `main`)
  - Proveedor de hosting: GitHub Pages + Cloudflare DNS/SSL
  - Contenido: `docs/index.html`, `docs/js/account-modal.js`, `docs/js/webchat.js`, 11 `modulo-*.html`, assets, capturas, APKs, PDFs y `CNAME (calcusuiteia.com)`.

* **Core de Producción (Backend, Base de Datos, App Web Interna):**
  - Directorio local: `C:\Calcu-Prod`
  - Repositorio remoto: `https://github.com/sebar2/CalcuSuiteIA-Core.git` (rama `main`)
  - Contenido: Backend FastAPI (:8000), Podman PostgreSQL 16 (:5432), Redis (:6379), Frontend App Vite (:5173).

---

## CÓMO PUBLICAR CAMBIOS EN LA WEB PÚBLICA
### Método 1: Doble clic en el script (Recomendado)
Ejecutar el acceso directo en el escritorio:
`PUBLICAR_WEB_A_GITHUB.bat`

### Método 2: Por Consola
```powershell
cd C:\Calcu-Web
git add docs/ index.html
git commit -m "feat(web): descripcion del cambio"
git push origin main
gh run list --repo sebar2/CalcusuiteIA --limit 1
```

---

## NOTAS TÉCNICAS SOBRE GITHUB ACTIONS
1. `DeprecationWarning: punycode`: Es un aviso interno de Node.js en los runners de GitHub Pages. Es 100% inocuo, no cuesta dinero ($0) y no bloquea el deploy.
2. `deployment_queued`: Es la cola normal de aprovisionamiento de CDN de GitHub Pages (demora 30 a 90 segundos en pasar a `completed/success`).
