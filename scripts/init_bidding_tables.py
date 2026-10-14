import sqlite3
from datetime import datetime

conn = sqlite3.connect('calcu.db')
cursor = conn.cursor()

cursor.execute('''
CREATE TABLE IF NOT EXISTS bidding_verticals (
    id VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    icon VARCHAR(20) NOT NULL DEFAULT '📋',
    color_badge VARCHAR(30) NOT NULL DEFAULT 'blue',
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME
)
''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS bidding_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vertical_id VARCHAR(50) NOT NULL REFERENCES bidding_verticals(id),
    keyword VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'INCLUSION',
    peso NUMERIC(4,2) NOT NULL DEFAULT 1.00,
    fuente VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    created_at DATETIME
)
''')

# Precargar los 7 rubros comerciales
verticals = [
    ("ILUMINACION_EFICIENCIA", "Iluminación & Eficiencia Energética", "💡", "amber", "Luminarias LED, proyectores, alumbrado público, drivers DALI, fotocélulas, columnas y balastos."),
    ("MOBILIARIO_EQUIPAMIENTO", "Mobiliario Corporativo & Equipamiento", "🪑", "indigo", "Mobiliario de oficina, puestos operativos, sillas ergonómicas, armarios metálicos y mostradores."),
    ("OBRA_CIVIL_CONSTRUCCION", "Obra Civil & Construcción", "🏗️", "orange", "Albañilería, hormigón, yeso, cielorrasos, impermeabilización, tabiquería y refacciones edilicias."),
    ("ELECTROMECANICA_SUMINISTROS", "Suministros Electromecánicos", "⚡", "cyan", "Grupos electrógenos, tableros eléctricos, transformadores, cableado industrial, motores y bombas."),
    ("EQUIPAMIENTO_HOSPITALARIO", "Equipamiento Médico & Hospitalario", "🏥", "rose", "Mobiliario clínico, camillas, autoclaves, instrumental médico, monitores y equipamiento de salud."),
    ("TECNOLOGIA_REDES", "Tecnología, Redes & Conectividad", "💻", "purple", "Servidores, cableado estructurado, fibra óptica, switches, racks, UPS y equipamiento IT."),
    ("SERVICIOS_LIMPIEZA_MANTENIMIENTO", "Servicios & Mantenimiento Integral", "🧹", "emerald", "Servicios de limpieza integral, higiene, mantenimiento de instalaciones, conserjería y desinfección."),
]

now_str = datetime.now().isoformat()
for v_id, nom, ico, col, desc in verticals:
    cursor.execute('''
    INSERT OR IGNORE INTO bidding_verticals (id, nombre, icon, color_badge, descripcion, activo, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
    ''', (v_id, nom, ico, col, desc, now_str))

# Keywords de Inclusión y Exclusión iniciales
keywords_data = [
    # Iluminación
    ("ILUMINACION_EFICIENCIA", "luminaria", "INCLUSION"),
    ("ILUMINACION_EFICIENCIA", "led", "INCLUSION"),
    ("ILUMINACION_EFICIENCIA", "panel led", "INCLUSION"),
    ("ILUMINACION_EFICIENCIA", "campana", "INCLUSION"),
    ("ILUMINACION_EFICIENCIA", "high bay", "INCLUSION"),
    ("ILUMINACION_EFICIENCIA", "proyector", "INCLUSION"),
    ("ILUMINACION_EFICIENCIA", "alumbrado", "INCLUSION"),
    ("ILUMINACION_EFICIENCIA", "driver", "INCLUSION"),
    ("ILUMINACION_EFICIENCIA", "dali", "INCLUSION"),
    ("ILUMINACION_EFICIENCIA", "fotocelula", "INCLUSION"),
    ("ILUMINACION_EFICIENCIA", "columna", "INCLUSION"),
    ("ILUMINACION_EFICIENCIA", "brazo", "INCLUSION"),
    ("ILUMINACION_EFICIENCIA", "downlight", "INCLUSION"),
    ("ILUMINACION_EFICIENCIA", "plafon", "INCLUSION"),
    ("ILUMINACION_EFICIENCIA", "luz de emergencia", "INCLUSION"),
    ("ILUMINACION_EFICIENCIA", "alta tension", "EXCLUSION"),
    ("ILUMINACION_EFICIENCIA", "pintura vial", "EXCLUSION"),

    # Mobiliario
    ("MOBILIARIO_EQUIPAMIENTO", "mobiliario", "INCLUSION"),
    ("MOBILIARIO_EQUIPAMIENTO", "silla", "INCLUSION"),
    ("MOBILIARIO_EQUIPAMIENTO", "sillon", "INCLUSION"),
    ("MOBILIARIO_EQUIPAMIENTO", "armario", "INCLUSION"),
    ("MOBILIARIO_EQUIPAMIENTO", "escritorio", "INCLUSION"),
    ("MOBILIARIO_EQUIPAMIENTO", "mostrador", "INCLUSION"),
    ("MOBILIARIO_EQUIPAMIENTO", "estanteria", "INCLUSION"),
    ("MOBILIARIO_EQUIPAMIENTO", "biblioteca", "INCLUSION"),
    ("MOBILIARIO_EQUIPAMIENTO", "puesto de trabajo", "INCLUSION"),
    ("MOBILIARIO_EQUIPAMIENTO", "mampara", "INCLUSION"),
    ("MOBILIARIO_EQUIPAMIENTO", "silla de ruedas", "EXCLUSION"),
    ("MOBILIARIO_EQUIPAMIENTO", "articulos de oficina", "EXCLUSION"),

    # Obra Civil
    ("OBRA_CIVIL_CONSTRUCCION", "obra civil", "INCLUSION"),
    ("OBRA_CIVIL_CONSTRUCCION", "hormigon", "INCLUSION"),
    ("OBRA_CIVIL_CONSTRUCCION", "albanileria", "INCLUSION"),
    ("OBRA_CIVIL_CONSTRUCCION", "yeso", "INCLUSION"),
    ("OBRA_CIVIL_CONSTRUCCION", "drywall", "INCLUSION"),
    ("OBRA_CIVIL_CONSTRUCCION", "revoque", "INCLUSION"),
    ("OBRA_CIVIL_CONSTRUCCION", "impermeabilizacion", "INCLUSION"),
    ("OBRA_CIVIL_CONSTRUCCION", "cielorraso", "INCLUSION"),
    ("OBRA_CIVIL_CONSTRUCCION", "pintura edilicia", "INCLUSION"),
    ("OBRA_CIVIL_CONSTRUCCION", "techado", "INCLUSION"),
    ("OBRA_CIVIL_CONSTRUCCION", "obra vial", "EXCLUSION"),
    ("OBRA_CIVIL_CONSTRUCCION", "asfalto", "EXCLUSION"),

    # Electromecánica
    ("ELECTROMECANICA_SUMINISTROS", "generador", "INCLUSION"),
    ("ELECTROMECANICA_SUMINISTROS", "grupo electrogeno", "INCLUSION"),
    ("ELECTROMECANICA_SUMINISTROS", "transformador", "INCLUSION"),
    ("ELECTROMECANICA_SUMINISTROS", "tablero electrico", "INCLUSION"),
    ("ELECTROMECANICA_SUMINISTROS", "bomba de agua", "INCLUSION"),
    ("ELECTROMECANICA_SUMINISTROS", "cable subterraneo", "INCLUSION"),
    ("ELECTROMECANICA_SUMINISTROS", "motor electrico", "INCLUSION"),
    ("ELECTROMECANICA_SUMINISTROS", "llave termica", "INCLUSION"),
    ("ELECTROMECANICA_SUMINISTROS", "subestacion", "INCLUSION"),

    # Equipamiento Hospitalario
    ("EQUIPAMIENTO_HOSPITALARIO", "camilla", "INCLUSION"),
    ("EQUIPAMIENTO_HOSPITALARIO", "autoclave", "INCLUSION"),
    ("EQUIPAMIENTO_HOSPITALARIO", "monitor multiparametrico", "INCLUSION"),
    ("EQUIPAMIENTO_HOSPITALARIO", "instrumental quirurgico", "INCLUSION"),
    ("EQUIPAMIENTO_HOSPITALARIO", "electrocardiografo", "INCLUSION"),
    ("EQUIPAMIENTO_HOSPITALARIO", "desfibrilador", "INCLUSION"),
    ("EQUIPAMIENTO_HOSPITALARIO", "medicamentos", "EXCLUSION"),
    ("EQUIPAMIENTO_HOSPITALARIO", "reactivos de laboratorio", "EXCLUSION"),

    # Tecnología & Redes
    ("TECNOLOGIA_REDES", "servidor", "INCLUSION"),
    ("TECNOLOGIA_REDES", "rack", "INCLUSION"),
    ("TECNOLOGIA_REDES", "switch", "INCLUSION"),
    ("TECNOLOGIA_REDES", "fibra optica", "INCLUSION"),
    ("TECNOLOGIA_REDES", "cableado estructurado", "INCLUSION"),
    ("TECNOLOGIA_REDES", "ups", "INCLUSION"),
    ("TECNOLOGIA_REDES", "firewall", "INCLUSION"),
    ("TECNOLOGIA_REDES", "punto de acceso", "INCLUSION"),

    # Servicios & Limpieza
    ("SERVICIOS_LIMPIEZA_MANTENIMIENTO", "servicio de limpieza", "INCLUSION"),
    ("SERVICIOS_LIMPIEZA_MANTENIMIENTO", "limpieza integral", "INCLUSION"),
    ("SERVICIOS_LIMPIEZA_MANTENIMIENTO", "mantenimiento edilicio", "INCLUSION"),
    ("SERVICIOS_LIMPIEZA_MANTENIMIENTO", "conserjeria", "INCLUSION"),
    ("SERVICIOS_LIMPIEZA_MANTENIMIENTO", "desinfeccion", "INCLUSION"),
    ("SERVICIOS_LIMPIEZA_MANTENIMIENTO", "higiene ambiental", "INCLUSION"),
    ("SERVICIOS_LIMPIEZA_MANTENIMIENTO", "lavado de vidrios", "INCLUSION"),
]

for vert_id, kw, tip in keywords_data:
    cursor.execute('''
    INSERT INTO bidding_keywords (vertical_id, keyword, tipo, peso, fuente, created_at)
    VALUES (?, ?, ?, 1.00, 'PRECARGA', ?)
    ''', (vert_id, kw, tip, now_str))

conn.commit()
print("Base de datos actualizada con 7 rubros comerciales y sus keywords.")
conn.close()
