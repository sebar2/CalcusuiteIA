import io
import unicodedata
from datetime import datetime, date
from decimal import Decimal
from typing import Dict, Any, List, Union, Optional
import pandas as pd
from sqlalchemy.orm import Session
from app.models.entities import (
    Category,
    Product, 
    CanalComercial,
    Inventory, 
    Sale, 
    PresupuestoMeta,
    Budget, 
    PresupuestoVersion, 
    OrdenReposicion, 
    OrdenCompra,
    OrdenCompraDetalle,
    AccionCompromiso
)

class ETLService:
    MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # Límite estricto de 10 MB

    @staticmethod
    def _sanitize_anti_injection(val: Any) -> Any:
        """
        Neutraliza ataques de inyección de fórmulas CSV/Excel (=, +, -, @).
        Si el campo comienza con estos caracteres y no es un valor numérico legítimo,
        se neutraliza anteponiendo comilla simple (').
        """
        if isinstance(val, str):
            s = val.strip()
            if s and s[0] in ('=', '+', '-', '@'):
                try:
                    float(s)
                    return val
                except ValueError:
                    return f"'{val}"
        return val

    @classmethod
    def _sanitize_dataframe(cls, df: pd.DataFrame) -> pd.DataFrame:
        """Sanitiza todas las celdas del DataFrame para neutralizar fórmulas maliciosas"""
        return df.map(cls._sanitize_anti_injection)
    @staticmethod
    def _parse_decimal(val: Any, default: Decimal = Decimal('0')) -> Decimal:
        if val is None or pd.isna(val):
            return default
        try:
            if isinstance(val, (int, float)):
                return Decimal(str(val)).quantize(Decimal('0.0001'))
            s = str(val).strip().replace('$', '').replace(' ', '')
            if not s or s.lower() in ('nan', 'none', 'null', ''):
                return default
            
            is_percent = '%' in s
            if is_percent:
                s = s.replace('%', '').strip()
                
            if ',' in s and '.' in s:
                last_dot = s.rfind('.')
                last_comma = s.rfind(',')
                if last_comma > last_dot:
                    # Formato 14.900,00 -> punto es miles, coma es decimal
                    s = s.replace('.', '').replace(',', '.')
                else:
                    # Formato 14,900.00 -> coma es miles, punto es decimal
                    s = s.replace(',', '')
            elif ',' in s:
                # Formato 850,00 o 4,2
                s = s.replace(',', '.')
            
            d = Decimal(s)
            if is_percent:
                d = d / Decimal('100')
            return d.quantize(Decimal('0.0001'))
        except Exception:
            return default

    @staticmethod
    def _normalize_df_columns(df: pd.DataFrame) -> pd.DataFrame:
        mapping = {}
        for col in df.columns:
            c_norm = str(col).strip().lower()
            c_norm = ''.join(ch for ch in unicodedata.normalize('NFKD', c_norm) if not unicodedata.combining(ch))
            c_norm = c_norm.replace(' ', '_').replace('-', '_')
            
            if c_norm in ('description', 'desc', 'descripcion', 'producto', 'item', 'nombre_producto'):
                c_norm = 'descripcion' if 'nombre' in df.columns else 'nombre'
            elif c_norm in ('rubro', 'familia', 'category', 'categoria', 'cat'):
                c_norm = 'categoria'
            elif c_norm in ('costo', 'cost', 'costo_unit', 'costo_compra'):
                c_norm = 'costo_unitario'
            elif c_norm in ('precio', 'price', 'precio_unit', 'precio_de_venta'):
                c_norm = 'precio_venta'
            elif c_norm in ('comision', 'comision%', 'commission'):
                c_norm = 'comision_pct'
            elif c_norm in ('flete', 'flete_unit', 'freight'):
                c_norm = 'flete_unitario'
            elif c_norm in ('sku_producto', 'cod_producto', 'codigo'):
                c_norm = 'sku'
            mapping[col] = c_norm
        return df.rename(columns=mapping)

    @classmethod
    def _infer_category_from_sku(cls, sku: str) -> Optional[str]:
        sku_u = sku.upper()
        if "COL" in sku_u:
            return "Colchones y Sommiers"
        if "LIV" in sku_u:
            return "Living"
        if "DOR" in sku_u:
            return "Dormitorio"
        if "COM" in sku_u:
            return "Comedor"
        if "OFI" in sku_u:
            return "Oficina"
        if "TEX" in sku_u:
            return "Textiles"
        if "DEC" in sku_u:
            return "Decoración"
        if "IND" in sku_u:
            return "Industrial"
        if "ELE" in sku_u:
            return "Electrónica"
        if "INS" in sku_u:
            return "Insumos"
        return None

    @classmethod
    def _clean_and_unify_category(cls, cat_val: Any, sku: str, db: Session) -> int:
        from app.models.entities import Category
        s = str(cat_val).strip() if cat_val is not None and not pd.isna(cat_val) else ""
        if not s or s.lower() in ("nan", "none", "null", "", "general"):
            inferred = cls._infer_category_from_sku(sku)
            if inferred:
                s = inferred
            else:
                s = "General"
        
        words = s.split()
        clean_words = []
        for idx, w in enumerate(words):
            w_low = w.lower()
            if idx > 0 and w_low in ("y", "e", "de", "del", "en", "para", "con", "a"):
                clean_words.append(w_low)
            else:
                clean_words.append(w.capitalize())
        final_name = " ".join(clean_words)

        existing = db.query(Category).filter(Category.nombre.ilike(final_name)).first()
        if existing:
            return existing.id
        
        cat = Category(nombre=final_name)
        db.add(cat)
        db.flush()
        return cat.id

    @classmethod
    def ingest_spreadsheet(cls, file_content: bytes, filename: str, db: Session) -> Dict[str, Any]:
        """
        Ingesta planillas Excel o CSV con inserciones idempotentes y soporte para hojas múltiples.
        Incluye validación estricta de tamaño (<= 10MB) y sanitización anti-inyección de fórmulas.
        """
        if len(file_content) > cls.MAX_FILE_SIZE_BYTES:
            return {
                "status": "error",
                "records_processed": 0,
                "errors": [f"El archivo ({len(file_content) / (1024*1024):.2f} MB) excede el límite máximo permitido de 10 MB."],
                "message": "Archivo denegado por políticas de ciberseguridad financiera: tamaño superior a 10 MB."
            }

        records_processed = 0
        errors: List[str] = []
        filename_lower = filename.lower()

        try:
            if filename_lower.endswith(".csv"):
                df = pd.read_csv(io.BytesIO(file_content))
                df = cls._normalize_df_columns(df)
                df = cls._sanitize_dataframe(df)
                cols = list(df.columns)
                sheet_type = "ventas"
                if any(x in cols for x in ["deposito_central", "transito_maritimo", "demanda_diaria_promedio", "stock_seguridad"]) or "inv" in filename_lower or "stock" in filename_lower:
                    sheet_type = "inventario"
                elif any(x in cols for x in ["monto_presupuestado", "monto_real"]) or "presup" in filename_lower or "budget" in filename_lower:
                    sheet_type = "presupuestos"
                elif ("sku" in cols or "product_sku" in cols) and ("costo_unitario" in cols or "precio_venta" in cols) and not any(x in cols for x in ["transaction_id", "cantidad", "flete_unitario"]):
                    sheet_type = "productos"
                elif "prod" in filename_lower:
                    sheet_type = "productos"

                sheets = {sheet_type: df}
            else:
                excel_file = pd.ExcelFile(io.BytesIO(file_content))
                sheets = {sheet_name: cls._sanitize_dataframe(cls._normalize_df_columns(excel_file.parse(sheet_name))) for sheet_name in excel_file.sheet_names}

            # Procesar colecciones identificadas
            for sheet_name, df in sheets.items():
                lower_name = sheet_name.lower()
                cols = list(df.columns)
                if "prod" in lower_name or (("costo_unitario" in cols or "precio_venta" in cols) and ("sku" in cols or "nombre" in cols) and not ("cantidad" in cols or "transito_maritimo" in cols)):
                    count = cls._process_products(df, db)
                    records_processed += count
                elif "inv" in lower_name or "stock" in lower_name or any(x in cols for x in ["deposito_central", "transito_maritimo", "demanda_diaria_promedio"]):
                    count = cls._process_inventory(df, db)
                    records_processed += count
                elif "vent" in lower_name or "sale" in lower_name or any(x in cols for x in ["transaction_id", "cantidad"]):
                    count = cls._process_sales(df, db)
                    records_processed += count
                elif "presup" in lower_name or "budget" in lower_name or any(x in cols for x in ["monto_presupuestado", "monto_real"]):
                    count = cls._process_budget(df, db)
                    records_processed += count

            db.commit()
            return {
                "status": "success",
                "records_processed": records_processed,
                "errors": errors,
                "message": f"Procesamiento completado con {records_processed} registros procesados."
            }
        except Exception as e:
            db.rollback()
            return {
                "status": "error",
                "records_processed": records_processed,
                "errors": [str(e)],
                "message": f"Error durante la ingesta ETL: {str(e)}"
            }

    @classmethod
    def _process_products(cls, df: pd.DataFrame, db: Session) -> int:
        df = cls._normalize_df_columns(df)
        count = 0
        for _, row in df.iterrows():
            sku = str(row.get("sku", row.get("product_sku", ""))).strip()
            if not sku:
                continue
            
            raw_nombre = row.get("nombre", row.get("descripcion", f"Producto {sku}"))
            nombre = str(raw_nombre).strip() if raw_nombre and not pd.isna(raw_nombre) else f"Producto {sku}"
            
            raw_cat = row.get("categoria", None)
            category_id = cls._clean_and_unify_category(raw_cat, sku, db)
            costo = cls._parse_decimal(row.get("costo_unitario", 0))
            precio = cls._parse_decimal(row.get("precio_venta", 0))

            existing = db.query(Product).filter(Product.sku == sku).first()
            if existing:
                existing.nombre = nombre
                existing.categoria_id = category_id
                existing.costo_base = costo
                existing.precio_lista = precio
            else:
                prod = Product(
                    sku=sku,
                    nombre=nombre,
                    categoria_id=category_id,
                    costo_base=costo,
                    precio_lista=precio,
                    doh_seguridad=15,
                    activo=True
                )
                db.add(prod)
            count += 1
        return count

    @classmethod
    def _process_inventory(cls, df: pd.DataFrame, db: Session) -> int:
        df = cls._normalize_df_columns(df)
        count = 0
        for _, row in df.iterrows():
            sku = str(row.get("product_sku", row.get("sku", ""))).strip()
            if not sku:
                continue

            raw_nombre = row.get("descripcion", row.get("nombre", f"Producto {sku}"))
            nombre = str(raw_nombre).strip() if raw_nombre and not pd.isna(raw_nombre) else f"Producto {sku}"
            raw_cat = row.get("categoria", None)
            category_id = cls._clean_and_unify_category(raw_cat, sku, db)

            # Asegurar existencia del producto padre
            prod = db.query(Product).filter(Product.sku == sku).first()
            if not prod:
                prod = Product(
                    sku=sku,
                    nombre=nombre,
                    categoria_id=category_id,
                    costo_base=Decimal('0'),
                    precio_lista=Decimal('0'),
                    doh_seguridad=15,
                    activo=True
                )
                db.add(prod)
                db.flush()
            else:
                if prod.categoria == "General" and category_id != prod.categoria_id:
                    prod.categoria_id = category_id
                if (prod.nombre.startswith("Producto ") or not prod.nombre) and nombre and not nombre.startswith("Producto "):
                    prod.nombre = nombre
            
            dep_central = int(row.get("deposito_central", 0) or 0)
            transito = int(row.get("transito_maritimo", 0) or 0)
            aduana = int(row.get("aduana", 0) or 0)
            stock_seg = int(row.get("stock_seguridad", 0) or 0)
            lead_time = cls._parse_decimal(row.get("lead_time_dias", 0))
            demanda_prom = cls._parse_decimal(row.get("demanda_diaria_promedio", 0))

            existing = db.query(Inventory).filter(Inventory.producto_id == prod.id).first()
            if existing:
                existing.deposito_central = dep_central
                existing.transito_maritimo = transito
                existing.aduana = aduana
                existing.stock_seguridad = stock_seg
                existing.lead_time_dias = lead_time
                existing.demanda_diaria_promedio = demanda_prom
            else:
                inv = Inventory(
                    producto_id=prod.id,
                    deposito_central=dep_central,
                    transito_maritimo=transito,
                    aduana=aduana,
                    stock_seguridad=stock_seg,
                    lead_time_dias=lead_time,
                    demanda_diaria_promedio=demanda_prom
                )
                db.add(inv)
            count += 1
        return count

    @classmethod
    def _process_sales(cls, df: pd.DataFrame, db: Session) -> int:
        df = cls._normalize_df_columns(df)
        count = 0
        default_canal = db.query(CanalComercial).first()
        if not default_canal:
            default_canal = CanalComercial(nombre="General", comision_pct=Decimal('0.10'), flete_estimado=Decimal('15.00'))
            db.add(default_canal)
            db.flush()

        for idx, row in df.iterrows():
            sku = str(row.get("product_sku", row.get("sku", ""))).strip()
            if not sku:
                continue

            raw_tx = row.get("transaction_id")
            if raw_tx is not None and not pd.isna(raw_tx) and str(raw_tx).strip():
                tx_id = str(raw_tx).strip()
            else:
                tx_id = f"TX-{sku}-{idx}"

            cantidad = int(row.get("cantidad", 1) or 1)
            precio = cls._parse_decimal(row.get("precio_unitario", row.get("precio", 0)))
            costo = cls._parse_decimal(row.get("costo_unitario", row.get("costo", 0)))

            # Asegurar existencia del producto padre
            prod = db.query(Product).filter(Product.sku == sku).first()
            if not prod:
                raw_cat = row.get("categoria", None)
                category_id = cls._clean_and_unify_category(raw_cat, sku, db)
                prod = Product(
                    sku=sku,
                    nombre=f"Producto {sku}",
                    categoria_id=category_id,
                    costo_base=costo,
                    precio_lista=precio,
                    doh_seguridad=15,
                    activo=True
                )
                db.add(prod)
                db.flush()

            raw_fecha = row.get("fecha", None)
            fecha_val = date.today()
            if raw_fecha and not pd.isna(raw_fecha):
                try:
                    fecha_val = pd.to_datetime(raw_fecha).date()
                except Exception:
                    pass

            periodo = str(row.get("periodo", fecha_val.strftime("%Y-%m"))).strip()

            existing = db.query(Sale).filter(Sale.transaction_id == tx_id).first()
            if existing:
                existing.producto_id = prod.id
                existing.cantidad = cantidad
                existing.precio_unitario_real = precio
                existing.costo_unitario_real = costo
                existing.fecha = fecha_val
                existing.periodo = periodo
                existing.canal_id = default_canal.id
            else:
                sale = Sale(
                    transaction_id=tx_id,
                    producto_id=prod.id,
                    canal_id=default_canal.id,
                    cantidad=cantidad,
                    precio_unitario_real=precio,
                    costo_unitario_real=costo,
                    fecha=fecha_val,
                    periodo=periodo
                )
                db.add(sale)
            count += 1
        return count

    @classmethod
    def _process_budget(cls, df: pd.DataFrame, db: Session) -> int:
        df = cls._normalize_df_columns(df)
        count = 0
        for _, row in df.iterrows():
            periodo = str(row.get("periodo", "2026-Q1")).strip()
            raw_cat = row.get("categoria", "General")
            category_id = cls._clean_and_unify_category(raw_cat, "", db)
            monto_presup = cls._parse_decimal(row.get("monto_presupuestado", 0))
            unidades = int(row.get("unidades_presupuestadas", 0) or 0)

            existing = db.query(PresupuestoMeta).filter(
                PresupuestoMeta.periodo == periodo,
                PresupuestoMeta.categoria_id == category_id,
                PresupuestoMeta.version == "V0"
            ).first()

            if existing:
                existing.monto_presupuestado = monto_presup
                existing.unidades_presupuestadas = unidades
            else:
                budget = PresupuestoMeta(
                    version="V0",
                    periodo=periodo,
                    categoria_id=category_id,
                    monto_presupuestado=monto_presup,
                    unidades_presupuestadas=unidades
                )
                db.add(budget)
            count += 1
        return count

    @classmethod
    def seed_demo_data(cls, db: Session) -> None:
        """Carga datos de demostración si las tablas respectivas están vacías"""
        from app.models.entities import Category

        if db.query(Product).first() is None:
            # 1. Categorías BCNF
            cat_map = {}
            for cat_name in ["Industrial", "Electrónica", "Insumos"]:
                existing_cat = db.query(Category).filter(Category.nombre == cat_name).first()
                if not existing_cat:
                    cat = Category(nombre=cat_name, margen_target_pct=Decimal('0.35'))
                    db.add(cat)
                    db.flush()
                    cat_map[cat_name] = cat.id
                else:
                    cat_map[cat_name] = existing_cat.id

            # 2. Canales Comerciales
            canales_demo = [
                ("Mercado Libre", Decimal('0.12'), Decimal('20.00')),
                ("Web Directo", Decimal('0.03'), Decimal('15.00')),
                ("Mayorista B2B", Decimal('0.00'), Decimal('0.00')),
            ]
            canal_map = {}
            for c_nom, c_com, c_fle in canales_demo:
                c_exist = db.query(CanalComercial).filter(CanalComercial.nombre == c_nom).first()
                if not c_exist:
                    c_inst = CanalComercial(nombre=c_nom, comision_pct=c_com, flete_estimado=c_fle)
                    db.add(c_inst)
                    db.flush()
                    canal_map[c_nom] = c_inst.id
                else:
                    canal_map[c_nom] = c_exist.id

            # 3. Productos BCNF
            productos_demo = [
                ("SKU-1001", "Válvula Reguladora de Flujo A1", "Industrial", Decimal('100.00'), Decimal('150.00')),
                ("SKU-1002", "Bomba Hidráulica 2HP", "Industrial", Decimal('250.00'), Decimal('400.00')),
                ("SKU-1003", "Sensor de Presión Digital", "Electrónica", Decimal('45.00'), Decimal('80.00')),
                ("SKU-1004", "Empaque de Silicona Alta Temp", "Insumos", Decimal('8.50'), Decimal('12.00')),
                ("SKU-1005", "Filtro de Aceite Heavy Duty", "Insumos", Decimal('22.00'), Decimal('35.00')),
            ]

            prod_map = {}
            for sku, nombre, cat_name, costo, precio in productos_demo:
                p = Product(
                    sku=sku,
                    nombre=nombre,
                    categoria_id=cat_map[cat_name],
                    costo_base=costo,
                    precio_lista=precio,
                    doh_seguridad=15,
                    activo=True
                )
                db.add(p)
                db.flush()
                prod_map[sku] = p

            # 4. Inventarios
            inventarios_demo = [
                ("SKU-1001", 30, 20, 10, 25, Decimal('15'), Decimal('5.0')),
                ("SKU-1002", 50, 10, 5, 15, Decimal('10'), Decimal('2.0')),
                ("SKU-1003", 10, 0, 5, 20, Decimal('20'), Decimal('3.5')),
                ("SKU-1004", 500, 100, 50, 100, Decimal('5'), Decimal('25.0')),
                ("SKU-1005", 40, 0, 0, 30, Decimal('12'), Decimal('4.0')),
            ]

            for sku, dep_c, trans, adu, sec_s, lead_t, dem in inventarios_demo:
                db.add(Inventory(
                    producto_id=prod_map[sku].id,
                    deposito_central=dep_c,
                    transito_maritimo=trans,
                    aduana=adu,
                    stock_seguridad=sec_s,
                    lead_time_dias=lead_t,
                    demanda_diaria_promedio=dem
                ))

            # 5. Transacciones de Ventas Reales (Base para cálculo de runtime BCNF)
            ventas_demo = [
                ("TX-1001-A", "SKU-1001", "Mercado Libre", 680, Decimal('150.00'), Decimal('100.00'), date(2025, 9, 10), "2025-09"),
                ("TX-1002-A", "SKU-1002", "Web Directo", 150, Decimal('400.00'), Decimal('250.00'), date(2025, 9, 15), "2025-09"),
                ("TX-1003-A", "SKU-1003", "Mercado Libre", 925, Decimal('80.00'), Decimal('45.00'), date(2025, 9, 18), "2025-09"),
                ("TX-1004-A", "SKU-1004", "Mayorista B2B", 2500, Decimal('12.00'), Decimal('8.50'), date(2025, 9, 22), "2025-09"),
                ("TX-1005-A", "SKU-1005", "Web Directo", 430, Decimal('35.00'), Decimal('22.00'), date(2025, 9, 25), "2025-09"),
            ]
            for tx_id, sku, canal_nom, cant, p_real, c_real, f_val, per in ventas_demo:
                db.add(Sale(
                    transaction_id=tx_id,
                    fecha=f_val,
                    periodo=per,
                    producto_id=prod_map[sku].id,
                    canal_id=canal_map.get(canal_nom),
                    cantidad=cant,
                    precio_unitario_real=p_real,
                    costo_unitario_real=c_real
                ))

            # 6. Presupuestos Metas (BCNF estricto: cero campos redundantes calculados)
            metas_demo = [
                ("V0", "2025-09", "Industrial", Decimal('150000.00'), 1000),
                ("V0", "2025-09", "Electrónica", Decimal('80000.00'), 1000),
                ("V0", "2025-09", "Insumos", Decimal('45000.00'), 3500),
                ("V0", "2026-Q1", "Industrial", Decimal('150000.00'), 1000),
                ("V0", "2026-Q1", "Electrónica", Decimal('80000.00'), 1000),
                ("V0", "2026-Q1", "Insumos", Decimal('45000.00'), 3500),
            ]
            for ver, per, cat_nom, presup, unids in metas_demo:
                db.add(PresupuestoMeta(
                    version=ver,
                    periodo=per,
                    categoria_id=cat_map[cat_nom],
                    monto_presupuestado=presup,
                    unidades_presupuestadas=unids
                ))

            # 7. Órdenes de Compra Normalizadas
            oc = OrdenCompra(
                numero_po="OC-2025-001",
                proveedor="Válvulas & Metales SA",
                etapa="sugerido",
                responsable="Carlos Méndez",
                fecha_emision=date(2025, 9, 28),
                fecha_arribo_estimada=date(2025, 10, 15)
            )
            db.add(oc)
            db.flush()
            db.add(OrdenCompraDetalle(
                orden_id=oc.id,
                producto_id=prod_map["SKU-1001"].id,
                cantidad=500,
                costo_unitario_pactado=Decimal('100.00')
            ))

        # -------------------------------------------------------------
        # 1. Sembrar Pipeline Kanban de Reposición
        # Acumulador Etapa 1 (Sugerido Stock <= ROP): Exactamente $127,930.00
        # -------------------------------------------------------------
        if db.query(OrdenReposicion).first() is None:
            ordenes_demo = [
                # Etapa 1: 'sugerido' -> $50,000 + $67,500 + $10,430 = $127,930.00
                ("SKU-1001", 500, Decimal('50000.00'), "Válvulas & Metales SA", "sugerido", "Carlos Méndez", date(2025, 10, 15)),
                ("SKU-1003", 1500, Decimal('67500.00'), "MicroSensores Global", "sugerido", "Lucía Torres", date(2025, 10, 20)),
                ("SKU-1005", 474, Decimal('10430.00'), "Lubricantes del Sur", "sugerido", "Martín Gómez", date(2025, 10, 18)),
                # Etapa 2: 'aprobacion'
                ("SKU-1002", 80, Decimal('20000.00'), "Hidráulica Industrial", "aprobacion", "Carlos Méndez", date(2025, 10, 25)),
                # Etapa 3: 'fabricacion'
                ("SKU-1004", 2000, Decimal('17000.00'), "Polímeros Avanzados", "fabricacion", "Lucía Torres", date(2025, 11, 5)),
                # Etapa 4: 'transito'
                ("SKU-1001", 300, Decimal('30000.00'), "Válvulas & Metales SA", "transito", "Martín Gómez", date(2025, 10, 12)),
                # Etapa 5: 'ingresado'
                ("SKU-1005", 200, Decimal('4400.00'), "Lubricantes del Sur", "ingresado", "Carlos Méndez", date(2025, 10, 2)),
            ]
            for sku_id, cant, monto, prov, etapa, resp, f_arr in ordenes_demo:
                db.add(OrdenReposicion(
                    sku_id=sku_id,
                    cantidad=cant,
                    monto_total=monto,
                    proveedor=prov,
                    etapa=etapa,
                    responsable=resp,
                    fecha_arribo_estimada=f_arr
                ))

        # -------------------------------------------------------------
        # 2. Sembrar Presupuestos Versionados (V0_Aprobado vs Forecast_Q1)
        # -------------------------------------------------------------
        if db.query(PresupuestoVersion).first() is None:
            versiones_demo = [
                # V0_Aprobado
                ("V0_Aprobado", "2025-09", "Ventas", "Industrial", Decimal('150000.00')),
                ("V0_Aprobado", "2025-09", "Ventas", "Electrónica", Decimal('80000.00')),
                ("V0_Aprobado", "2025-09", "Ventas", "Insumos", Decimal('45000.00')),
                ("V0_Aprobado", "2025-09", "COGS", "Industrial", Decimal('90000.00')),
                ("V0_Aprobado", "2025-09", "COGS", "Electrónica", Decimal('42000.00')),
                ("V0_Aprobado", "2025-09", "COGS", "Insumos", Decimal('25000.00')),
                # Forecast_Q1
                ("Forecast_Q1", "2025-09", "Ventas", "Industrial", Decimal('162000.00')),
                ("Forecast_Q1", "2025-09", "Ventas", "Electrónica", Decimal('74000.00')),
                ("Forecast_Q1", "2025-09", "Ventas", "Insumos", Decimal('45000.00')),
                ("Forecast_Q1", "2025-09", "COGS", "Industrial", Decimal('98000.00')),
                ("Forecast_Q1", "2025-09", "COGS", "Electrónica", Decimal('41000.00')),
                ("Forecast_Q1", "2025-09", "COGS", "Insumos", Decimal('26000.00')),
            ]
            for ver, per, cta, cat, monto in versiones_demo:
                db.add(PresupuestoVersion(
                    version=ver,
                    periodo=per,
                    cuenta=cta,
                    categoria=cat,
                    monto=monto
                ))

        # -------------------------------------------------------------
        # 3. Sembrar Acciones y Compromisos Cross-Área
        # -------------------------------------------------------------
        if db.query(AccionCompromiso).first() is None:
            acciones_demo = [
                ("Auditar impacto de fletes marítimos en margen EBITDA", "Dirección General", "Hernán Cortés", date(2025, 10, 15), "En Progreso", "Auditoría FP&A"),
                ("Ajustar markup en canal Mercado Libre para salvaguardar margen neto > 15%", "Comercial", "Valeria Rossi", date(2025, 10, 10), "Pendiente", "Matriz Comercial"),
                ("Priorizar desaduanaje para Bomba Hidráulica (SKU-1002)", "Logística", "Mariano Díaz", date(2025, 10, 8), "Completado", "Alerta ROP"),
            ]
            for tit, ar, resp, flim, est, orig in acciones_demo:
                db.add(AccionCompromiso(
                    titulo=tit,
                    area=ar,
                    responsable=resp,
                    fecha_limite=flim,
                    estado=est,
                    origen=orig
                ))

        db.commit()
