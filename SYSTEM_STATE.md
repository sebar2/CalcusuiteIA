# FICHA TÉCNICA MAESTRA: CALCU (SupplyFinance-Core)
**Fecha de corte y auditoría:** Octubre 2026  
**Entorno de ejecución verificado:** Windows 11 / Python 3.14 / Node 24 / Docker (PostgreSQL 16 & Redis 7)  
**Estado general del repositorio:** COMPILACIÓN LIMPIA (Frontend: `tsc -b && vite build` OK | Backend: 68/68 tests unitarios `pytest` PASSED).

---

## 1. Stack Tecnológico & Versiones Reales en Producción

### 1.1 Backend & Capa Analítica
- **Lenguaje:** Python `3.14.7`
- **Framework Web:** FastAPI `0.141.1` (ASGI con Uvicorn `0.34.x` / Starlette `0.46.x`)
- **ORM & Dialectos:** SQLAlchemy `2.0.54`
- **Driver Relacional Principal:** `pg8000` (`postgresql+pg8000://calcu_user:calcu_secure_pass_2026@localhost:5432/calcu_db`)
- **Validación de Schemas:** Pydantic `2.13.5` (v2 nativo)
- **Migraciones:** Alembic `1.15.x` + sincronización no destructiva multi-dialecto en `app/database/session.py` (`sync_table_columns()`)
- **Motor Matemático:** Módulo estándar `decimal.Decimal` con política de redondeo `ROUND_HALF_UP` (Tolerancia cero a `float` en montos o porcentajes).
- **Procesamiento de Archivos & Hojas de Cálculo:** `openpyxl`, `pandas`
- **Inteligencia Artificial Local:** Integración vía HTTP con Ollama (`http://localhost:11434`), con modelos locales (`qwen2.5:7b`, `gemma4:31b`, etc.).

### 1.2 Frontend & Experiencia de Usuario (UI)
- **Runtime & Gestor:** Node.js `v24.19.0` / npm `11.17.0`
- **Librería Core:** React `19.2.8` + React DOM `19.2.8`
- **Bundler & Tooling:** Vite `8.3.2` + TypeScript `~6.0.2`
- **Estilos & Diseño:** Tailwind CSS `3.4.19`, PostCSS `8.5.28`, Autoprefixer `10.6.1`
- **Iconografía & Gráficos:** Lucide React `1.52.0`, Recharts `3.10.1`
- **Estado Asíncrono:** TanStack React Query `5.104.1`, Axios `1.20.0`

---

## 2. Base de Datos: Modelos y Tablas Activas (PostgreSQL 16)

La base de datos relacional contiene **33 tablas** organizadas bajo la tercera forma normal de Boyce-Codd (BCNF) y esquemas operativos de abastecimiento:

| Tabla Física | Descripción / Entidad | Claves Foráneas Principales (FKs) |
| :--- | :--- | :--- |
| `productos` | Catálogo maestro de SKUs, costos CIF base, precios de lista y fotos. | `categoria_id` -> `categorias(id)` |
| `categorias` | Clasificación de productos con margen target comercial. | Ninguna |
| `inventario` / `inventarios` | Stock consolidado por nodo logístico y demanda diaria. | `producto_id` -> `productos(id)`, `sku` -> `productos(sku)` |
| `stock_location_batches` | Lotes de mercadería multi-depósito y dual-SKU (fábrica/propio). | `sku` -> `productos(sku)`, `supplier_id` -> `suppliers(id)` |
| `warehouses` | Nodos logísticos (Central MVD, Pocitos, Salto, Ningbo, Hamburgo, Tránsito). | Ninguna |
| `suppliers` | Directorio de proveedores (Fábricas chinas, Proveedores Uy, Reventa y Navieras). | Ninguna |
| `implicit_service_catalog` | Catálogo de servicios implícitos (Flete 40HQ, 20ST, LCL, Seguros, Aduana, Camión). | `proveedor_id` -> `suppliers(id)` |
| `implicit_budget_orders` | Presupuestos y órdenes de compra de costos implícitos / landed cost. | Ninguna |
| `implicit_budget_items` | Renglones de servicios asociados a la orden logística. | `budget_id` -> `implicit_budget_orders`, `service_id` -> `implicit_service_catalog`, `supplier_id` -> `suppliers` |
| `ordenes_compra` | Órdenes de compra de importación o plaza local/reventa. | Ninguna |
| `ordenes_compra_detalles` | Ítems y cantidades adjudicadas en la orden de compra. | `orden_id` -> `ordenes_compra(id)`, `producto_id` -> `productos(id)` |
| `ordenes_reposicion` | Órdenes generadas por sugerencia automática de ROP. | `sku_id` -> `productos(sku)` |
| `commercial_deals` | Oportunidades del pipeline CRM B2B y proyectos. | Ninguna |
| `commercial_deal_items` | SKUs, cantidades y precios acordados en la oportunidad CRM. | `deal_id` -> `commercial_deals(id)`, `sku` -> `productos(sku)` |
| `sales_orders` | Órdenes de Venta formales (OV) emitidas con control de stock. | `deal_id` -> `commercial_deals(id)` |
| `sales_order_items` | Detalle facturado por SKU con subtotal e IVA. | `sales_order_id` -> `sales_orders(id)`, `sku` -> `productos(sku)` |
| `tenders` | Licitaciones públicas y privadas (RUPE/SICE) y proyectos. | Ninguna |
| `tender_items` | Renglones solicitados en pliego con validación de stock y atraso. | `tender_id` -> `tenders(id)`, `sku` -> `productos(sku)` |
| `areas` | Estructura organizacional corporativa (Logística, Comercial, Finanzas, etc.). | Ninguna |
| `responsables_organizacion` | Nómina de directores y líderes responsables de sector. | `area_id` -> `areas(id)` |
| `centros_costo` | Centros de costo operativos (CC-LOG, CC-COM, CC-ADM, etc.). | `area_id` -> `areas(id)`, `responsable_id` -> `responsables_organizacion(id)` |
| `presupuestos_centros_costo`| Ejecución OPEX mensual por centro de costo (Presupuesto vs. Real).| `centro_costo_id` -> `centros_costo(id)` |
| `transacciones_ventas` | Histórico de ventas omnicanal para analítica de demanda. | `canal_id` -> `canales_comerciales(id)`, `producto_id` -> `productos(id)` |
| `canales_comerciales` | Canales de venta (B2B Corporativo, Mercado Libre, Local Físico). | Ninguna |
| `clients` | Clientes corporativos, constructoras, arquitectos y RIT. | Ninguna |
| `audit_logs` | Pistas de auditoría de seguridad y cambios de estado. | Ninguna |
| `user_preferences` | Preferencias de UI por usuario y configuración. | Ninguna |

---

## 3. Catálogo de Endpoints REST (FastAPI)

Los endpoints están expuestos bajo el prefijo unificado `/api/v1` organizados en routers funcionales:

### 3.1 Routers Core (`app/api/v1/endpoints.py`)
- **ETL & Multimedia**:
  - `POST /api/v1/etl/upload`: Ingesta de plantillas Excel/CSV de productos, ventas e inventario con extracción automática de imágenes.
  - `GET /api/v1/etl/templates/sample-excel`: Descarga de planillas modelo estandarizadas.
- **Inventario & Abastecimiento**:
  - `GET /api/v1/inventory/alerts`: SKUs en riesgo o quiebre de stock por comparación frente al ROP.
  - `PATCH /api/v1/inventory/quick-update`: Ajuste ágil de parámetros de inventario (lead time, demanda, stock de seguridad).
  - `GET /api/v1/inventory/purchase-order-suggestions`: Sugerencias automáticas de compra según demanda y lead time.
- **Multi-Depósito & Lotes (`/warehouses`)**:
  - `GET /api/v1/warehouses`: Listado de depósitos físicos nacionales e internacionales.
  - `POST /api/v1/warehouses`: Alta de nuevos depósitos o hubs logísticos.
  - `GET /api/v1/warehouses/batches`: Matriz unificada de lotes en las 5 etapas logísticas.
  - `POST /api/v1/warehouses/transfer`: Transferencia física entre almacenes con control de estado de aprobación.
  - `POST /api/v1/warehouses/assign-stock`: Alta directa de lotes con trazabilidad.
  - `POST /api/v1/warehouses/batches/approve`: Aprobación comercial/directorio de lotes en estado pendiente.
- **Proveedores & Reventa (`/suppliers`)**:
  - `GET /api/v1/suppliers`: Directorio filtrable de proveedores (Fábricas, Proveedores Uy, Reventa).
  - `POST /api/v1/suppliers`: Alta de proveedor con RUT, datos de contacto y tipo.
  - `POST /api/v1/suppliers/reventa-batch`: Creación de lote de inventario manual con SKU propio y de proveedor.
- **Presupuestos Implícitos & Órdenes Locales (`/implicit-budgets` & `/purchase-orders`)**:
  - `GET /api/v1/implicit-budgets/catalog`: Catálogo de tarifas base (marítimo, seguro, aduana, camión).
  - `POST /api/v1/implicit-budgets/catalog`: Alta de nuevo servicio logístico implícito.
  - `GET /api/v1/implicit-budgets/orders`: Histórico de presupuestos implícitos generados.
  - `POST /api/v1/implicit-budgets/orders`: Creación de orden logística multi-proveedor para aprobación.
  - `POST /api/v1/implicit-budgets/orders/{order_id}/approve`: Aprobación formal por Directorio/Admin.
  - `GET /api/v1/purchase-orders/local`: Listado de órdenes de compra de plaza local.
  - `POST /api/v1/purchase-orders/local`: Emisión de orden de compra para proveedor uruguayo.
- **Pricing & Rentabilidad (`/pricing`)**:
  - `GET /api/v1/pricing/margins`: Márgenes brutos y markup por SKU.
  - `POST /api/v1/pricing/simulate`: Simulador de cascada de descuentos comerciales y elasticidad.
  - `POST /api/v1/pricing/ai-bundles-suggest`: Motor de paquetes cruzados anti-sobrestock con selección de modelo Ollama en demanda.
- **Comercial & Licitaciones (`/commercial` & `/tenders`)**:
  - `GET|POST /api/v1/commercial/deals`: Gestión del pipeline de oportunidades CRM.
  - `POST /api/v1/commercial/deals/{deal_id}/sales-order`: Cierre de negocio y emisión de Orden de Venta.
  - `GET /api/v1/tenders`: Listado de licitaciones y proyectos B2B.
  - `POST /api/v1/tenders/evaluate`: Scoring de viabilidad de pliego licitatorio frente a stock.
  - `GET /api/v1/tenders/live-feed`: Monitor de compras estatales en Uruguay.

### 3.2 Routers Adicionales Especializados
- **`/api/v1/advisor`**: Diagnósticos automáticos de abastecimiento e integración con Ollama (`/ollama-status`, `/models`).
- **`/api/v1/cockpit`**: Sala de control ejecutivo con KPIs de caja, inventario y ventas.
- **`/api/v1/initiatives`**: Módulo de arbitraje comercial (Mercado Libre vs. Alibaba) y exportación a Excel.
- **`/api/v1/auth`**: Inicio de sesión JWT, validación de token y endpoints de perfil.
- **`/api/v1/settings`**: Configuración de entorno y preferencias corporativas.

---

## 4. Mapeo de Vistas en el Frontend (`frontend/src/views/`)

| Vista | Estado Operativo | Componentes y Modales Clave |
| :--- | :--- | :--- |
| **`MultiLocationStockView.tsx`** | **COMPLETA** | Matriz de 5 columnas (Fábricas, Depósitos Int., Alta Mar, Proveedores Uy, Depósitos Uruguay). Modales: `ReventaBatchModal`, `OrderDetailModal`. Selector multi-columna de visibilidad. |
| **`SupplyKanbanView.tsx`** | **COMPLETA** | Tablero físico ROP + Secciones integradas de Órdenes Locales Uy, Presupuestos Implícitos (Landed Costs) y Proveedores Reventa. |
| **`PricingAnalyticsView.tsx`** | **COMPLETA** | Gráfico Waterfall de costos, simulador de descuentos comerciales y selector interactivo de modelo Ollama para packs IA en demanda. |
| **`CommercialKanbanView.tsx`** | **COMPLETA** | Embudo CRM B2B (Prospección -> Negociación -> Orden de Venta formal con control de stock). Drawer de detalle y resumen de ítems. |
| **`TendersView.tsx`** | **COMPLETA** | Licitaciones B2B, scoring de riesgo, feed en tiempo real y simulador dialéctico de márgenes. |
| **`InitiativesEvaluatorView.tsx`** | **COMPLETA** | Buscador de arbitraje comercial (Mercado Libre Uruguay vs. Alibaba), cálculo de logística internacional y exportador a Excel. |
| **`ControlRoomView.tsx`** | **COMPLETA** | KPIs ejecutivos consolidados de caja, DOH de inventario y semáforo general. |
| **`VarianceScenariosView.tsx`** | **COMPLETA** | Análisis de variaciones presupuestarias OPEX por centro de costo y simulación de escenarios económicos. |
| **`ExecutiveReportsView.tsx`** | **COMPLETA** | Reportes ejecutivos consolidados descargables en PDF y Excel para directorio. |
| **`EtlIngestView.tsx`** | **COMPLETA** | Carga masiva de planillas Excel/CSV, barra de progreso y descarga de plantillas oficiales. |
| **`ClientsView.tsx`** | **COMPLETA** | Directorio de clientes corporativos con historial de compras. |
| **`SuppliersView.tsx`** | **COMPLETA** | Directorio maestro de proveedores clasificados por origen (Fábricas chinas, Proveedores Uy, Navieras). |

---

## 5. Puntos Críticos & Deuda Técnica Identificada

1. **Acoplamiento de Datos de Prueba con la marca "Serlux"**:
   - En el seeder y catálogo inicial persisten SKUs etiquetados como iluminación técnica (`LUM-6060`, `UFO-150W`, `DRV-DALI`). Aunque son válidos para pruebas, el sistema debe permitir configuraciones multicategoría completamente agnósticas a través de la interfaz.
2. **Mezcla Conceptual en Depósitos Locales**:
   - Anteriormente existía ambigüedad entre `showrooms_locales`, `deposito_central` y sucursales del interior (Salto). El servicio `InventorySyncService` unifica ahora estos nodos bajo la columna maestra de **Depósitos Uruguay**, pero se recomienda formalizar un selector explícito de almacén destino en cada orden.
3. **Persistencia de Lotes en Tests Unitarios**:
   - Los tests de integración crean registros que pueden acumularse si no se ejecutan contra una base de datos de test efímera en SQLite o en un esquema aislado. El script `scripts/clean_test_lots.py` mitiga este comportamiento manteniendo la BD limpia.
4. **Respaldo de Documentos de Proveedores**:
   - Los presupuestos implícitos y órdenes locales registran costos y números de seguimiento, pero aún no cuentan con un almacén digital de archivos adjuntos (PDFs de facturas de flete o despachos aduaneros).
