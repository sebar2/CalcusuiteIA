import io
import os
import re
import uuid
import logging
import unicodedata
from datetime import datetime, date
from decimal import Decimal
from typing import Dict, Any, List, Union, Optional
import pandas as pd
import openpyxl
from PIL import Image as PILImage
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

STATIC_UPLOADS_PRODUCTS = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "static",
    "uploads",
    "products"
)
os.makedirs(STATIC_UPLOADS_PRODUCTS, exist_ok=True)
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
    AccionCompromiso,
    SalesOrder,
    SalesOrderItem,
    CommercialDeal,
    CommercialDealItem
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
            elif c_norm in ('costo', 'cost', 'costo_unit', 'costo_compra', 'costo_unitario_pactado'):
                c_norm = 'costo_unitario'
            elif c_norm in ('precio', 'price', 'precio_unit', 'precio_de_venta'):
                c_norm = 'precio_venta'
            elif c_norm in ('comision', 'comision%', 'commission'):
                c_norm = 'comision_pct'
            elif c_norm in ('flete', 'flete_unit', 'freight'):
                c_norm = 'flete_unitario'
            elif c_norm in ('sku_producto', 'cod_producto', 'codigo'):
                c_norm = 'sku'
            elif c_norm in ('imagen', 'imagen_url', 'image', 'image_url', 'foto', 'foto_url', 'thumbnail', 'img_url'):
                c_norm = 'image_url'
            elif c_norm in ('logo', 'logo_url', 'avatar', 'logo_cliente'):
                c_norm = 'logo_url'
            elif c_norm in ('po', 'orden_compra', 'nro_po', 'numero_po', 'purchase_order'):
                c_norm = 'numero_po'
            elif c_norm in ('ov', 'orden_venta', 'nro_ov', 'numero_ov', 'sales_order'):
                c_norm = 'numero_ov'
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
    def _extract_embedded_images_from_xlsx(cls, file_content: bytes) -> Dict[str, str]:
        """
        Extrae imágenes incrustadas físicamente en celdas de un archivo Excel (.xlsx),
        identifica la fila y columna anclada de cada imagen, asocia la imagen al SKU
        de esa fila, guarda el archivo en disco (app/static/uploads/products/{sku}.png)
        y retorna un mapeo {sku: "/static/uploads/products/{sku}.png"}.
        """
        extracted_map: Dict[str, str] = {}
        try:
            wb = openpyxl.load_workbook(io.BytesIO(file_content), data_only=True)
        except Exception as e:
            logger.warning("No se pudo inspeccionar imágenes del libro Excel: %s", e)
            return extracted_map

        for ws in wb.worksheets:
            images = getattr(ws, '_images', [])
            if not images:
                continue

            # Detectar columna que contiene el SKU en las primeras filas de la hoja
            sku_col_idx = None
            header_row_idx = 1
            for r in range(1, min(6, ws.max_row + 1)):
                for c in range(1, min(25, ws.max_column + 1)):
                    cell_val = str(ws.cell(row=r, column=c).value or '').strip().lower()
                    cell_norm = ''.join(ch for ch in unicodedata.normalize('NFKD', cell_val) if not unicodedata.combining(ch))
                    if cell_norm in ('sku', 'cod_producto', 'codigo', 'cod', 'sku_producto', 'item_code', 'product_sku'):
                        sku_col_idx = c
                        header_row_idx = r
                        break
                if sku_col_idx:
                    break

            if not sku_col_idx:
                sku_col_idx = 1

            for img in images:
                try:
                    anchor = getattr(img, 'anchor', None)
                    if not anchor:
                        continue

                    row_idx = None
                    if hasattr(anchor, '_from') and hasattr(anchor._from, 'row'):
                        row_idx = anchor._from.row + 1
                    elif isinstance(anchor, str):
                        from openpyxl.utils import coordinate_to_tuple
                        row_idx = coordinate_to_tuple(anchor)[0]

                    if not row_idx or row_idx <= header_row_idx:
                        continue

                    raw_sku = ws.cell(row=row_idx, column=sku_col_idx).value
                    if not raw_sku:
                        continue
                    sku = str(raw_sku).strip()
                    if not sku or sku.lower() in ('nan', 'none', 'null', ''):
                        continue

                    img_data = img._data() if callable(getattr(img, '_data', None)) else getattr(img, '_data', None)
                    if not img_data:
                        continue

                    clean_sku = re.sub(r'[^a-zA-Z0-9_\-]', '_', sku)
                    
                    # Detectar formato con PIL
                    img_io = io.BytesIO(img_data)
                    pil_img = PILImage.open(img_io)
                    img_format = (pil_img.format or 'PNG').lower()
                    if img_format == 'jpeg':
                        img_format = 'jpg'

                    filename = f"{clean_sku}.{img_format}"
                    file_path = os.path.join(STATIC_UPLOADS_PRODUCTS, filename)
                    pil_img.save(file_path)

                    url = f"/static/uploads/products/{filename}"
                    extracted_map[sku] = url
                    extracted_map[clean_sku] = url
                    logger.info("Imagen física extraída de celda Excel para SKU '%s' -> %s", sku, url)
                except Exception as ex:
                    logger.warning("Error extrayendo imagen individual de Excel: %s", ex)

        return extracted_map

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
                if "numero_po" in cols or "incoterm" in cols or any(k in filename_lower for k in ["orden_compra", "ordenes_compra", "purchase_order", "oc_"]):
                    sheet_type = "ordenes_compra"
                elif "numero_ov" in cols or any(k in filename_lower for k in ["orden_venta", "ordenes_venta", "sales_order", "ov_"]):
                    sheet_type = "ordenes_venta"
                elif any(x in cols for x in ["deposito_central", "transito_maritimo", "demanda_diaria_promedio", "stock_seguridad", "lead_time_dias"]) or "inventario" in filename_lower or "stock" in filename_lower or ("inv" in filename_lower and "vent" not in filename_lower):
                    sheet_type = "inventario"
                elif any(x in cols for x in ["cliente_empresa", "probabilidad_pct"]) or "crm" in filename_lower or "deal" in filename_lower:
                    sheet_type = "crm"
                elif any(x in cols for x in ["monto_presupuestado", "monto_real", "codigo_centro_costo"]) or "presup" in filename_lower or "budget" in filename_lower or "opex" in filename_lower:
                    sheet_type = "presupuestos"
                elif ("sku" in cols or "product_sku" in cols) and ("costo_unitario" in cols or "precio_venta" in cols) and not any(x in cols for x in ["transaction_id", "cantidad", "flete_unitario"]):
                    sheet_type = "productos"
                elif "prod" in filename_lower:
                    sheet_type = "productos"

                sheets = {sheet_type: df}
            else:
                extracted_images = cls._extract_embedded_images_from_xlsx(file_content)
                excel_file = pd.ExcelFile(io.BytesIO(file_content))
                sheets = {}
                for sheet_name in excel_file.sheet_names:
                    parsed_df = excel_file.parse(sheet_name)
                    parsed_df = cls._normalize_df_columns(parsed_df)
                    parsed_df = cls._sanitize_dataframe(parsed_df)

                    # Inyectar imagen extraída automáticamente si la fila no cuenta con URL previa
                    if extracted_images and ("sku" in parsed_df.columns or "product_sku" in parsed_df.columns):
                        sku_col_name = "sku" if "sku" in parsed_df.columns else "product_sku"
                        if "image_url" not in parsed_df.columns:
                            parsed_df["image_url"] = None
                        parsed_df["image_url"] = parsed_df["image_url"].astype(object)
                        for idx, r in parsed_df.iterrows():
                            r_sku = str(r.get(sku_col_name, "")).strip()
                            if r_sku in extracted_images and (pd.isna(r.get("image_url")) or not str(r.get("image_url")).strip()):
                                parsed_df.at[idx, "image_url"] = extracted_images[r_sku]

                    sheets[sheet_name] = parsed_df

            # Procesar colecciones identificadas según jerarquía de firmas
            for sheet_name, df in sheets.items():
                lower_name = sheet_name.lower().strip()
                cols = list(df.columns)

                # 1. Órdenes de Compra (PO / OC)
                if "numero_po" in cols or "incoterm" in cols or any(k in lower_name for k in ["orden_compra", "ordenes_compra", "purchase_order", "oc_"]):
                    count = cls._process_purchase_orders(df, db)
                    records_processed += count
                # 2. Órdenes de Venta (OV) - Se valida 'numero_ov' o términos completos para no colisionar con 'inVENTArio'
                elif "numero_ov" in cols or any(k in lower_name for k in ["orden_venta", "ordenes_venta", "sales_order", "ov_"]):
                    count = cls._process_sales_orders(df, db)
                    records_processed += count
                # 3. Inventario y Stock Físico (Crucial: no ser interceptado por OV)
                elif any(x in cols for x in ["deposito_central", "transito_maritimo", "demanda_diaria_promedio", "stock_seguridad", "lead_time_dias"]) or "inventario" in lower_name or "stock" in lower_name or ("inv" in lower_name and "vent" not in lower_name):
                    count = cls._process_inventory(df, db)
                    records_processed += count
                # 4. Pipeline CRM y Deals Comerciales
                elif any(x in cols for x in ["cliente_empresa", "probabilidad_pct"]) or "crm" in lower_name or "deal" in lower_name or "pipeline" in lower_name:
                    count = cls._process_crm_deals(df, db)
                    records_processed += count
                # 5. Presupuestos y OPEX
                elif any(x in cols for x in ["monto_presupuestado", "monto_real", "codigo_centro_costo"]) or "presup" in lower_name or "budget" in lower_name or "opex" in lower_name:
                    count = cls._process_budget(df, db)
                    records_processed += count
                # 6. Catálogo Maestro de Productos
                elif (("costo_unitario" in cols or "precio_venta" in cols) and ("sku" in cols or "nombre" in cols) and not any(x in cols for x in ["cantidad", "deposito_central", "transito_maritimo", "transaction_id"])) or "prod" in lower_name:
                    count = cls._process_products(df, db)
                    records_processed += count
                # 7. Ventas Transaccionales Históricas
                elif "transaction_id" in cols or any(x in lower_name for x in ["ventas", "sales", "ticket"]) or ("cantidad" in cols and any(x in cols for x in ["canal", "vendedor", "cliente"])):
                    count = cls._process_sales(df, db)
                    records_processed += count
                # Fallback inteligente según columnas
                elif "sku" in cols and any(x in cols for x in ["deposito_central", "transito_maritimo", "stock_seguridad"]):
                    count = cls._process_inventory(df, db)
                    records_processed += count
                elif "sku" in cols and ("costo_unitario" in cols or "precio_venta" in cols):
                    count = cls._process_products(df, db)
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

            raw_img = row.get("image_url", row.get("imagen_url"))
            image_url = str(raw_img).strip() if raw_img and not pd.isna(raw_img) else None
            if image_url and image_url.lower() in ("nan", "none", "null", ""):
                image_url = None

            existing = db.query(Product).filter(Product.sku == sku).first()
            if existing:
                existing.nombre = nombre
                existing.categoria_id = category_id
                existing.costo_base = costo
                existing.precio_lista = precio
                if image_url:
                    existing.image_url = image_url
            else:
                prod = Product(
                    sku=sku,
                    nombre=nombre,
                    categoria_id=category_id,
                    costo_base=costo,
                    precio_lista=precio,
                    doh_seguridad=15,
                    activo=True,
                    image_url=image_url
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

            raw_img = row.get("image_url", row.get("imagen_url"))
            image_url = str(raw_img).strip() if raw_img and not pd.isna(raw_img) else None
            if image_url and image_url.lower() in ("nan", "none", "null", ""):
                image_url = None

            costo = cls._parse_decimal(row.get("costo_unitario", 0))
            precio = cls._parse_decimal(row.get("precio_venta", 0))

            # Asegurar existencia del producto padre y sincronizar multimedia y precios
            prod = db.query(Product).filter(Product.sku == sku).first()
            if not prod:
                prod = Product(
                    sku=sku,
                    nombre=nombre,
                    categoria_id=category_id,
                    costo_base=costo,
                    precio_lista=precio,
                    doh_seguridad=15,
                    activo=True,
                    image_url=image_url
                )
                db.add(prod)
                db.flush()
            else:
                if prod.categoria == "General" and category_id != prod.categoria_id:
                    prod.categoria_id = category_id
                if (prod.nombre.startswith("Producto ") or not prod.nombre) and nombre and not nombre.startswith("Producto "):
                    prod.nombre = nombre
                if image_url:
                    prod.image_url = image_url
                if costo > Decimal('0'):
                    prod.costo_base = costo
                if precio > Decimal('0'):
                    prod.precio_lista = precio
            
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
    def _process_purchase_orders(cls, df: pd.DataFrame, db: Session) -> int:
        df = cls._normalize_df_columns(df)
        count = 0
        for _, row in df.iterrows():
            po_num = str(row.get("numero_po", "")).strip()
            if not po_num or po_num.lower() in ("nan", "none", ""):
                continue
            
            proveedor = str(row.get("proveedor", "Proveedor General")).strip()
            raw_etapa = str(row.get("etapa", "sugerido")).strip().lower()
            etapa = raw_etapa if raw_etapa in ("sugerido", "aprobacion", "fabricacion", "transito", "ingresado") else "sugerido"
            responsable = str(row.get("responsable", "Responsable Logística")).strip()
            sku = str(row.get("sku", "")).strip()
            if not sku:
                continue

            raw_emision = row.get("fecha_emision")
            fecha_emision = date.today()
            if raw_emision and not pd.isna(raw_emision):
                try:
                    fecha_emision = pd.to_datetime(raw_emision).date()
                except Exception:
                    pass

            raw_arribo = row.get("fecha_arribo_estimada")
            fecha_arribo = date.today()
            if raw_arribo and not pd.isna(raw_arribo):
                try:
                    fecha_arribo = pd.to_datetime(raw_arribo).date()
                except Exception:
                    pass

            # Buscar o crear cabecera OrdenCompra
            po = db.query(OrdenCompra).filter(OrdenCompra.numero_po == po_num).first()
            if not po:
                po = OrdenCompra(
                    numero_po=po_num,
                    proveedor=proveedor,
                    etapa=etapa,
                    responsable=responsable,
                    fecha_emision=fecha_emision,
                    fecha_arribo_estimada=fecha_arribo
                )
                db.add(po)
                db.flush()

            # Asegurar existencia de producto
            prod = db.query(Product).filter(Product.sku == sku).first()
            costo = cls._parse_decimal(row.get("costo_unitario", row.get("costo_unitario_pactado", 0)))
            raw_nombre = row.get("nombre", row.get("nombre_producto", f"Producto {sku}"))
            nombre = str(raw_nombre).strip() if raw_nombre and not pd.isna(raw_nombre) else f"Producto {sku}"
            raw_img = row.get("image_url", row.get("imagen_url"))
            image_url = str(raw_img).strip() if raw_img and not pd.isna(raw_img) else None

            if not prod:
                cat_id = cls._clean_and_unify_category(row.get("categoria", "General"), sku, db)
                prod = Product(
                    sku=sku,
                    nombre=nombre,
                    categoria_id=cat_id,
                    costo_base=costo,
                    precio_lista=costo * Decimal('1.5'),
                    doh_seguridad=15,
                    activo=True,
                    image_url=image_url
                )
                db.add(prod)
                db.flush()
            elif image_url and not prod.image_url:
                prod.image_url = image_url

            cantidad = int(row.get("cantidad", 1) or 1)
            det = db.query(OrdenCompraDetalle).filter(
                OrdenCompraDetalle.orden_id == po.id,
                OrdenCompraDetalle.producto_id == prod.id
            ).first()
            if det:
                det.cantidad = cantidad
                det.costo_unitario_pactado = costo
            else:
                det = OrdenCompraDetalle(
                    orden_id=po.id,
                    producto_id=prod.id,
                    cantidad=cantidad,
                    costo_unitario_pactado=costo
                )
                db.add(det)
            count += 1
        return count

    @classmethod
    def _process_sales_orders(cls, df: pd.DataFrame, db: Session) -> int:
        df = cls._normalize_df_columns(df)
        count = 0
        for _, row in df.iterrows():
            ov_num = str(row.get("numero_ov", "")).strip()
            if not ov_num or ov_num.lower() in ("nan", "none", ""):
                continue

            cliente = str(row.get("cliente", row.get("cliente_empresa", "Cliente Corporativo"))).strip()
            rut = str(row.get("rut", "")).strip() or None
            vendedor = str(row.get("vendedor", "Martín Gómez")).strip()
            warehouse_id = str(row.get("almacen_despacho", row.get("warehouse_id", "DEP-CENTRAL-MVD"))).strip()
            moneda = str(row.get("moneda", "USD")).strip()
            sku = str(row.get("sku", "")).strip()
            if not sku:
                continue

            raw_emision = row.get("fecha_emision")
            fecha_emision = date.today()
            if raw_emision and not pd.isna(raw_emision):
                try:
                    fecha_emision = pd.to_datetime(raw_emision).date()
                except Exception:
                    pass

            prod = db.query(Product).filter(Product.sku == sku).first()
            raw_nombre = row.get("nombre", row.get("nombre_producto", f"Producto {sku}"))
            nombre = str(raw_nombre).strip() if raw_nombre and not pd.isna(raw_nombre) else f"Producto {sku}"
            raw_img = row.get("image_url", row.get("imagen_url"))
            image_url = str(raw_img).strip() if raw_img and not pd.isna(raw_img) else None
            precio = cls._parse_decimal(row.get("precio_unitario", row.get("precio_venta", 0)))
            cantidad = int(row.get("cantidad", 1) or 1)

            if not prod:
                cat_id = cls._clean_and_unify_category(row.get("categoria", "General"), sku, db)
                prod = Product(
                    sku=sku,
                    nombre=nombre,
                    categoria_id=cat_id,
                    costo_base=precio * Decimal('0.6'),
                    precio_lista=precio,
                    doh_seguridad=15,
                    activo=True,
                    image_url=image_url
                )
                db.add(prod)
                db.flush()
            elif image_url and not prod.image_url:
                prod.image_url = image_url

            deal = db.query(CommercialDeal).filter(CommercialDeal.cliente == cliente).first()
            if not deal:
                deal = CommercialDeal(
                    id=f"DEAL-{ov_num}",
                    proyecto_nombre=f"Proyecto {cliente}",
                    cliente=cliente,
                    rut=rut,
                    vendedor=vendedor,
                    monto_total=precio * cantidad,
                    moneda=moneda,
                    etapa="ganada"
                )
                db.add(deal)
                db.flush()

            so = db.query(SalesOrder).filter(SalesOrder.numero_ov == ov_num).first()
            subtotal = precio * cantidad
            iva = subtotal * Decimal('0.22')
            total = subtotal + iva

            if not so:
                so = SalesOrder(
                    id=ov_num,
                    deal_id=deal.id,
                    numero_ov=ov_num,
                    cliente=cliente,
                    rut=rut,
                    vendedor=vendedor,
                    warehouse_id=warehouse_id,
                    subtotal=subtotal,
                    iva_monto=iva,
                    total=total,
                    moneda=moneda,
                    estado=str(row.get("estado", "EMITIDA")).strip(),
                    fecha_emision=fecha_emision
                )
                db.add(so)
                db.flush()

            det = db.query(SalesOrderItem).filter(
                SalesOrderItem.sales_order_id == so.id,
                SalesOrderItem.sku == prod.sku
            ).first()
            if det:
                det.cantidad = cantidad
                det.precio_unitario = precio
                det.subtotal = subtotal
            else:
                det = SalesOrderItem(
                    sales_order_id=so.id,
                    sku=prod.sku,
                    cantidad=cantidad,
                    precio_unitario=precio,
                    subtotal=subtotal
                )
                db.add(det)
            count += 1
        return count

    @classmethod
    def _process_crm_deals(cls, df: pd.DataFrame, db: Session) -> int:
        df = cls._normalize_df_columns(df)
        count = 0
        for _, row in df.iterrows():
            cliente = str(row.get("cliente_empresa", row.get("cliente", ""))).strip()
            if not cliente or cliente.lower() in ("nan", "none", ""):
                continue

            deal_title = str(row.get("titulo", row.get("deal_title", row.get("proyecto_nombre", f"Trato {cliente}")))).strip()
            rut = str(row.get("rut", "")).strip() or None
            vendedor = str(row.get("vendedor", "Martín Gómez")).strip()
            raw_etapa = str(row.get("etapa", "prospeccion")).strip().lower()
            valid_etapas = ("prospeccion", "cotizacion", "propuesta_enviada", "negociacion", "ganada", "perdida")
            etapa = raw_etapa if raw_etapa in valid_etapas else "prospeccion"
            
            raw_logo = row.get("logo_url")
            logo_url = str(raw_logo).strip() if raw_logo and not pd.isna(raw_logo) else None
            email = str(row.get("email", "")).strip() or None
            phone = str(row.get("telefono", row.get("phone", ""))).strip() or None
            address = str(row.get("direccion", row.get("address", ""))).strip() or None
            moneda = str(row.get("moneda", "USD")).strip()

            deal = db.query(CommercialDeal).filter(
                (CommercialDeal.proyecto_nombre == deal_title) | 
                ((CommercialDeal.cliente == cliente) & (CommercialDeal.etapa == etapa))
            ).first()

            if not deal:
                deal_id = str(uuid.uuid4())
                deal = CommercialDeal(
                    id=deal_id,
                    proyecto_nombre=deal_title,
                    cliente=cliente,
                    rut=rut,
                    vendedor=vendedor,
                    monto_total=Decimal('0.00'),
                    moneda=moneda,
                    etapa=etapa,
                    logo_url=logo_url,
                    email=email,
                    phone=phone,
                    address=address,
                )
                db.add(deal)
                db.flush()
            else:
                if rut: deal.rut = rut
                if logo_url: deal.logo_url = logo_url
                if email: deal.email = email
                if phone: deal.phone = phone
                if address: deal.address = address

            sku = str(row.get("sku", "")).strip()
            if sku and sku.lower() not in ("nan", "none", ""):
                precio = cls._parse_decimal(row.get("precio_unitario", 0))
                cantidad = int(row.get("cantidad", 1) or 1)
                
                prod = db.query(Product).filter(Product.sku == sku).first()
                if not prod:
                    cat_id = cls._clean_and_unify_category("General", sku, db)
                    prod = Product(
                        sku=sku,
                        nombre=f"Producto {sku}",
                        categoria_id=cat_id,
                        costo_base=precio * Decimal('0.6'),
                        precio_lista=precio,
                        doh_seguridad=15,
                        activo=True,
                    )
                    db.add(prod)
                    db.flush()

                deal_item = db.query(CommercialDealItem).filter(
                    CommercialDealItem.deal_id == deal.id,
                    CommercialDealItem.sku == sku
                ).first()

                if not deal_item:
                    deal_item = CommercialDealItem(
                        deal_id=deal.id,
                        sku=sku,
                        cantidad=cantidad,
                        precio_unitario=precio
                    )
                    db.add(deal_item)
                else:
                    deal_item.cantidad = cantidad
                    deal_item.precio_unitario = precio

                db.flush()
                # Recalcular monto total del trato comercial
                total_items = sum(it.cantidad * it.precio_unitario for it in deal.items)
                deal.monto_total = Decimal(str(total_items))

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
