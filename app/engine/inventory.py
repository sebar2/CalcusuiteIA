from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any, Optional

def calculate_inventory_turnover(cogs: Decimal, avg_inventory: Decimal) -> Decimal:
    """
    Calcula Rotación de inventario: CMV / Inventario Promedio
    Si el inventario promedio es cero, retorna Decimal('0').
    """
    if avg_inventory == Decimal('0'):
        return Decimal('0')
    return (cogs / avg_inventory).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

def calculate_doh(avg_inventory: Decimal, cogs: Decimal) -> Decimal:
    """
    Calcula Days on Hand (DOH): (Inventario Promedio / CMV) * 365
    Si el CMV es cero, retorna Decimal('0').
    """
    if cogs == Decimal('0'):
        return Decimal('0')
    doh = (avg_inventory / cogs) * Decimal('365')
    return doh.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

def calculate_rop(daily_demand: Decimal, lead_time: Decimal, safety_stock: Decimal = Decimal('0')) -> Decimal:
    """
    Calcula Punto de Reorden (ROP): (Demanda Diaria * Lead Time) + Stock de Seguridad
    """
    rop = (daily_demand * lead_time) + safety_stock
    return rop.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


# ============================================================================
# SIMULADOR 3D DE CUBICAJE (CONTAINER & TRUCK LOAD PLANNER) & BOTÓN IA 98%
# ============================================================================

CONTAINER_SPECS: Dict[str, Dict[str, Decimal]] = {
    "20ST": {
        "length_m": Decimal("5.8900"),
        "width_m": Decimal("2.3500"),
        "height_m": Decimal("2.3900"),
        "max_weight_kg": Decimal("28200.0000"),
        "volume_m3": Decimal("33.1000"),
    },
    "40HQ": {
        "length_m": Decimal("12.0300"),
        "width_m": Decimal("2.3500"),
        "height_m": Decimal("2.6900"),
        "max_weight_kg": Decimal("28600.0000"),
        "volume_m3": Decimal("76.2000"),
    },
    "TRUCK_3PL": {
        "length_m": Decimal("7.5000"),
        "width_m": Decimal("2.4000"),
        "height_m": Decimal("2.5000"),
        "max_weight_kg": Decimal("12000.0000"),
        "volume_m3": Decimal("45.0000"),
    },
}


def calculate_3d_load_plan(
    container_type: str,
    items: List[Dict[str, Any]],
    enforce_lifo: bool = False,
) -> Dict[str, Any]:
    """
    Algoritmo determinista de 3D Bin Packing en Decimal (ROUND_HALF_UP).
    Ubica cajas en contenedores marítimos (20ST, 40HQ) o camiones 3PL.
    Para camiones 3PL valida distribución de pesos por eje y secuencia LIFO de paradas.
    """
    ctype = container_type.upper().strip()
    if ctype not in CONTAINER_SPECS:
        ctype = "40HQ"

    specs = CONTAINER_SPECS[ctype]
    c_length = specs["length_m"]
    c_width = specs["width_m"]
    c_height = specs["height_m"]
    c_max_weight = specs["max_weight_kg"]
    c_max_vol = specs["volume_m3"]

    unpacked_boxes: List[Dict[str, Any]] = []
    box_seq = 1
    for item in items:
        sku = str(item.get("sku", f"SKU-{box_seq}"))
        desc = str(item.get("description", sku))
        units = int(item.get("units_count", 1))
        w = Decimal(str(item.get("box_width_m", "0.4000"))).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        h = Decimal(str(item.get("box_height_m", "0.3000"))).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        l = Decimal(str(item.get("box_length_m", "0.4000"))).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        weight = Decimal(str(item.get("unit_weight_kg", "10.0000"))).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        stop_number = int(item.get("stop_number", 1))

        w = max(Decimal("0.1000"), min(w, c_width))
        h = max(Decimal("0.1000"), min(h, c_height))
        l = max(Decimal("0.1000"), min(l, c_length))
        weight = max(Decimal("0.1000"), weight)

        for _ in range(units):
            unpacked_boxes.append({
                "box_id": f"BOX-{box_seq:04d}",
                "sku": sku,
                "description": desc,
                "w": w,
                "h": h,
                "l": l,
                "weight": weight,
                "stop_number": stop_number,
                "is_filler": False,
                "color": "#3b82f6",
            })
            box_seq += 1

    if ctype == "TRUCK_3PL" and enforce_lifo:
        unpacked_boxes.sort(key=lambda b: (-b["stop_number"], -b["weight"], -(b["w"] * b["h"] * b["l"])))
    else:
        unpacked_boxes.sort(key=lambda b: (-b["weight"], -(b["w"] * b["h"] * b["l"])))

    placed_boxes: List[Dict[str, Any]] = []
    unfitted_boxes: List[Dict[str, Any]] = []

    curr_x = Decimal("0.0000")
    curr_y = Decimal("0.0000")
    curr_z = Decimal("0.0000")
    layer_max_x = Decimal("0.0000")
    row_max_z = Decimal("0.0000")

    total_weight = Decimal("0.0000")
    total_volume = Decimal("0.0000")

    for box in unpacked_boxes:
        bw = box["w"]
        bh = box["h"]
        bl = box["l"]
        bweight = box["weight"]
        bvol = (bw * bh * bl).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

        if total_weight + bweight > c_max_weight:
            unfitted_boxes.append({**box, "reason": "EXCESO_PESO_MAXIMO"})
            continue

        if curr_y + bh > c_height:
            curr_y = Decimal("0.0000")
            curr_z = curr_z + row_max_z
            row_max_z = Decimal("0.0000")

        if curr_z + bw > c_width:
            curr_y = Decimal("0.0000")
            curr_z = Decimal("0.0000")
            curr_x = curr_x + layer_max_x
            layer_max_x = Decimal("0.0000")
            row_max_z = Decimal("0.0000")

        if curr_x + bl > c_length:
            unfitted_boxes.append({**box, "reason": "ESPACIO_FISICO_AGOTADO"})
            continue

        box_record = {
            "box_id": box["box_id"],
            "sku": box["sku"],
            "description": box["description"],
            "x_m": float(curr_x),
            "y_m": float(curr_y),
            "z_m": float(curr_z),
            "box_width_m": float(bw),
            "box_height_m": float(bh),
            "box_length_m": float(bl),
            "unit_weight_kg": float(bweight),
            "stop_number": box["stop_number"],
            "is_filler": box["is_filler"],
            "color": box["color"],
        }
        placed_boxes.append(box_record)

        total_weight += bweight
        total_volume += bvol

        curr_y += bh
        layer_max_x = max(layer_max_x, bl)
        row_max_z = max(row_max_z, bw)

    occ_vol_pct = ((total_volume / c_max_vol) * Decimal("100.0000")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    occ_weight_pct = ((total_weight / c_max_weight) * Decimal("100.0000")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    result: Dict[str, Any] = {
        "container_type": ctype,
        "specs": {
            "length_m": float(c_length),
            "width_m": float(c_width),
            "height_m": float(c_height),
            "max_weight_kg": float(c_max_weight),
            "volume_m3": float(c_max_vol),
        },
        "total_volume_m3": float(total_volume.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)),
        "total_weight_kg": float(total_weight.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)),
        "occupied_volume_pct": float(min(Decimal("100.00"), occ_vol_pct)),
        "occupied_weight_pct": float(min(Decimal("100.00"), occ_weight_pct)),
        "remaining_volume_m3": float(max(Decimal("0.0000"), (c_max_vol - total_volume).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))),
        "remaining_weight_kg": float(max(Decimal("0.0000"), (c_max_weight - total_weight).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))),
        "placed_boxes_count": len(placed_boxes),
        "unfitted_boxes_count": len(unfitted_boxes),
        "placed_boxes": placed_boxes,
        "unfitted_boxes": unfitted_boxes,
    }

    if ctype == "TRUCK_3PL":
        if total_weight > Decimal("0.0000"):
            weighted_x_sum = sum(
                (Decimal(str(b["x_m"])) + Decimal(str(b["box_length_m"])) / Decimal("2.0000")) * Decimal(str(b["unit_weight_kg"]))
                for b in placed_boxes
            )
            cg_x = weighted_x_sum / total_weight
            front_ratio = max(Decimal("0.1000"), min(Decimal("0.6000"), (c_length - cg_x) / c_length))
            rear_ratio = Decimal("1.0000") - front_ratio

            front_axle_kg = (total_weight * front_ratio).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            rear_axle_kg = (total_weight * rear_ratio).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        else:
            front_axle_kg = Decimal("0.0000")
            rear_axle_kg = Decimal("0.0000")

        result["axle_distribution"] = {
            "front_axle_kg": float(front_axle_kg),
            "front_axle_limit_kg": 4500.0,
            "rear_axle_kg": float(rear_axle_kg),
            "rear_axle_limit_kg": 7500.0,
            "balanced": bool(front_axle_kg <= Decimal("4500.0000") and rear_axle_kg <= Decimal("7500.0000")),
            "lifo_enforced": enforce_lifo,
        }

    return result


def recommend_container_filler_skus(
    container_type: str,
    current_load_plan: Dict[str, Any],
    candidate_skus: List[Dict[str, Any]],
    target_occupancy_pct: Decimal = Decimal("98.00"),
) -> Dict[str, Any]:
    """
    Recomendador Heurístico / IA de Relleno Óptimo de Contenedor al 98%.
    Identifica el espacio ocioso y rellena con SKUs de alta rotación (Clase A, ROP crítico,
    mayor margen de contribución) representados con cajas Esmeralda Holográfico (#10b981).
    """
    ctype = container_type.upper().strip()
    specs = CONTAINER_SPECS.get(ctype, CONTAINER_SPECS["40HQ"])
    c_length = specs["length_m"]
    c_width = specs["width_m"]
    c_height = specs["height_m"]
    c_max_weight = specs["max_weight_kg"]
    c_max_vol = specs["volume_m3"]

    current_vol = Decimal(str(current_load_plan.get("total_volume_m3", "0.0")))
    current_weight = Decimal(str(current_load_plan.get("total_weight_kg", "0.0")))
    placed_boxes = list(current_load_plan.get("placed_boxes", []))

    target_vol = (c_max_vol * (target_occupancy_pct / Decimal("100.0000"))).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    vol_gap = max(Decimal("0.0000"), target_vol - current_vol)
    weight_capacity_left = max(Decimal("0.0000"), c_max_weight - current_weight)

    if not candidate_skus:
        candidate_skus = [
            {
                "sku": "VALV-IND-A1",
                "description": "Válvula de Retención Industrial 2\"",
                "box_width_m": Decimal("0.3500"),
                "box_height_m": Decimal("0.2500"),
                "box_length_m": Decimal("0.4000"),
                "unit_weight_kg": Decimal("8.5000"),
                "unit_cost_usd": Decimal("45.0000"),
                "unit_price_usd": Decimal("89.0000"),
                "rop_status": "CRITICO_ROP",
                "rotation_class": "A",
            },
            {
                "sku": "FILT-HYD-500",
                "description": "Filtro Hidráulico Heavy Duty 500L",
                "box_width_m": Decimal("0.4000"),
                "box_height_m": Decimal("0.3000"),
                "box_length_m": Decimal("0.4000"),
                "unit_weight_kg": Decimal("6.2000"),
                "unit_cost_usd": Decimal("28.0000"),
                "unit_price_usd": Decimal("65.0000"),
                "rop_status": "CRITICO_ROP",
                "rotation_class": "A",
            },
            {
                "sku": "MANOM-PREC-100",
                "description": "Manómetro Digital Precisión 100 PSI",
                "box_width_m": Decimal("0.2500"),
                "box_height_m": Decimal("0.2000"),
                "box_length_m": Decimal("0.3000"),
                "unit_weight_kg": Decimal("2.1000"),
                "unit_cost_usd": Decimal("18.5000"),
                "unit_price_usd": Decimal("49.0000"),
                "rop_status": "ALERTA_DOH",
                "rotation_class": "A",
            },
        ]

    def candidate_score(c: Dict[str, Any]) -> tuple:
        is_crit = 1 if c.get("rop_status") == "CRITICO_ROP" else 0
        is_a = 1 if c.get("rotation_class") == "A" else 0
        cost = Decimal(str(c.get("unit_cost_usd", "1.0")))
        price = Decimal(str(c.get("unit_price_usd", "2.0")))
        margin = (price - cost) / max(Decimal("0.01"), cost)
        return (is_crit, is_a, margin)

    sorted_candidates = sorted(candidate_skus, key=candidate_score, reverse=True)

    filler_boxes: List[Dict[str, Any]] = []
    added_vol = Decimal("0.0000")
    added_weight = Decimal("0.0000")
    added_cost = Decimal("0.0000")
    added_revenue = Decimal("0.0000")
    sku_counts: Dict[str, int] = {}

    max_used_x = Decimal("0.0000")
    for b in placed_boxes:
        bx_end = Decimal(str(b["x_m"])) + Decimal(str(b["box_length_m"]))
        if bx_end > max_used_x:
            max_used_x = bx_end

    curr_x = min(max_used_x, c_length)
    curr_y = Decimal("0.0000")
    curr_z = Decimal("0.0000")
    layer_max_x = Decimal("0.0000")
    row_max_z = Decimal("0.0000")

    box_idx = len(placed_boxes) + 1

    candidate_cycle = 0
    while added_vol < vol_gap and added_weight < weight_capacity_left and curr_x < c_length:
        cand = sorted_candidates[candidate_cycle % len(sorted_candidates)]
        candidate_cycle += 1

        bw = Decimal(str(cand.get("box_width_m", "0.4000")))
        bh = Decimal(str(cand.get("box_height_m", "0.3000")))
        bl = Decimal(str(cand.get("box_length_m", "0.4000")))
        bweight = Decimal(str(cand.get("unit_weight_kg", "5.0000")))
        bvol = (bw * bh * bl).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        bcost = Decimal(str(cand.get("unit_cost_usd", "20.0000")))
        bprice = Decimal(str(cand.get("unit_price_usd", "45.0000")))

        if added_weight + bweight > weight_capacity_left:
            break
        if added_vol + bvol > vol_gap * Decimal("1.0200"):
            break

        if curr_y + bh > c_height:
            curr_y = Decimal("0.0000")
            curr_z = curr_z + row_max_z
            row_max_z = Decimal("0.0000")

        if curr_z + bw > c_width:
            curr_y = Decimal("0.0000")
            curr_z = Decimal("0.0000")
            curr_x = curr_x + layer_max_x
            layer_max_x = Decimal("0.0000")
            row_max_z = Decimal("0.0000")

        if curr_x + bl > c_length:
            break

        box_record = {
            "box_id": f"AI-FILL-{box_idx:04d}",
            "sku": cand["sku"],
            "description": f"[IA-SUGGEST] {cand['description']}",
            "x_m": float(curr_x),
            "y_m": float(curr_y),
            "z_m": float(curr_z),
            "box_width_m": float(bw),
            "box_height_m": float(bh),
            "box_length_m": float(bl),
            "unit_weight_kg": float(bweight),
            "stop_number": 99,
            "is_filler": True,
            "status": "SUGGESTED_AI_FILL",
            "color": "#10b981",  # Verde Esmeralda Holográfico
        }
        filler_boxes.append(box_record)
        sku_counts[cand["sku"]] = sku_counts.get(cand["sku"], 0) + 1

        added_vol += bvol
        added_weight += bweight
        added_cost += bcost
        added_revenue += bprice

        curr_y += bh
        layer_max_x = max(layer_max_x, bl)
        row_max_z = max(row_max_z, bw)
        box_idx += 1

    final_total_vol = current_vol + added_vol
    final_total_weight = current_weight + added_weight
    final_occ_vol_pct = ((final_total_vol / c_max_vol) * Decimal("100.0000")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    final_occ_weight_pct = ((final_total_weight / c_max_weight) * Decimal("100.0000")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return {
        "success": True,
        "container_type": ctype,
        "target_occupancy_pct": float(target_occupancy_pct),
        "initial_volume_pct": float(current_load_plan.get("occupied_volume_pct", 0.0)),
        "projected_volume_pct": float(min(Decimal("100.00"), final_occ_vol_pct)),
        "projected_weight_pct": float(min(Decimal("100.00"), final_occ_weight_pct)),
        "filler_boxes_count": len(filler_boxes),
        "filler_volume_m3": float(added_vol.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)),
        "filler_weight_kg": float(added_weight.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)),
        "estimated_additional_cost_usd": float(added_cost.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        "estimated_additional_revenue_usd": float(added_revenue.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        "estimated_margin_contribution_usd": float((added_revenue - added_cost).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        "suggested_skus_breakdown": [
            {"sku": sku, "units_suggested": count}
            for sku, count in sku_counts.items()
        ],
        "filler_boxes": filler_boxes,
        "ai_rationale": (
            f"El contenedor {ctype} presentaba {float((c_max_vol - current_vol).quantize(Decimal('0.01')))} m³ ociosos "
            f"con flete ya contratado. El modelo IA optimizó el hueco incorporando {len(filler_boxes)} cajas "
            f"de alta rotación ({', '.join(sku_counts.keys())}) elevando la ocupación al {float(final_occ_vol_pct)}% "
            f"con un margen incremental proyectado de USD {float((added_revenue - added_cost).quantize(Decimal('0.01')))}."
        ),
    }
