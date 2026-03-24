#!/usr/bin/env python3
"""
Seed script — datos demo para Ruwi IoT Platform.

Crea:
  - 1 organización demo
  - 1 usuario admin (admin@ruwi.io / demo1234)
  - 2 dispositivos demo (1 agro + 1 energia)
  - Reglas básicas de alerta para cada dispositivo

UUIDs fijos para que el simulador siempre apunte a los mismos dispositivos.

Uso:
    docker exec ruwi_backend python /app/seed.py
"""
import asyncio
import sys

# IDs fijos para dispositivos demo
DEMO_ORG_ID    = "00000000-0000-0000-0000-000000000001"
DEMO_USER_ID   = "00000000-0000-0000-0000-000000000010"
DEMO_AGRO_ID   = "00000000-0000-0000-0000-000000000100"
DEMO_ENERGIA_ID = "00000000-0000-0000-0000-000000000200"

DEMO_API_KEY_AGRO    = "demoagrokey00000000000000000000000000000000000000000000000000001"
DEMO_API_KEY_ENERGIA = "demoenergiakey0000000000000000000000000000000000000000000000002"


async def seed():
    from sqlalchemy import text
    from app.database import AsyncSessionLocal
    import bcrypt

    hashed_pwd = bcrypt.hashpw(b"demo1234", bcrypt.gensalt(rounds=12)).decode()

    async with AsyncSessionLocal() as db:
        # ── Organización ─────────────────────────────────────────────────────
        await db.execute(text("""
            INSERT INTO organizations (id, name, vertical, plan, created_at)
            VALUES (:id, 'Ruwi Demo', NULL, 'starter', NOW())
            ON CONFLICT (id) DO NOTHING
        """), {"id": DEMO_ORG_ID})

        # ── Usuario admin ─────────────────────────────────────────────────────
        await db.execute(text("""
            INSERT INTO users
                (id, org_id, email, hashed_password, role,
                 notify_whatsapp, notify_email, active, created_at)
            VALUES
                (:id, :org_id, 'admin@ruwi.io', :pwd, 'admin',
                 false, true, true, NOW())
            ON CONFLICT (id) DO NOTHING
        """), {"id": DEMO_USER_ID, "org_id": DEMO_ORG_ID, "pwd": hashed_pwd})

        # ── Dispositivo agro ──────────────────────────────────────────────────
        await db.execute(text("""
            INSERT INTO devices
                (id, org_id, name, type, vertical, status,
                 lat, lng, location_name, altitude_msnm, crop_type,
                 api_key, active, created_at)
            VALUES
                (:id, :org_id, 'Sensor Parcela Norte', 'soil_sensor', 'agro', 'online',
                 -15.8402, -70.0219, 'Puno, Perú', 3820, 'Papa andina',
                 :api_key, true, NOW())
            ON CONFLICT (id) DO NOTHING
        """), {"id": DEMO_AGRO_ID, "org_id": DEMO_ORG_ID, "api_key": DEMO_API_KEY_AGRO})

        # ── Dispositivo energía ───────────────────────────────────────────────
        await db.execute(text("""
            INSERT INTO devices
                (id, org_id, name, type, vertical, status,
                 lat, lng, location_name, altitude_msnm,
                 api_key, active, created_at)
            VALUES
                (:id, :org_id, 'Medidor Planta A', 'energy_meter', 'energia', 'online',
                 -12.0660, -77.0360, 'Lima, Perú', 0,
                 :api_key, true, NOW())
            ON CONFLICT (id) DO NOTHING
        """), {"id": DEMO_ENERGIA_ID, "org_id": DEMO_ORG_ID, "api_key": DEMO_API_KEY_ENERGIA})

        # ── Reglas agro ───────────────────────────────────────────────────────
        rules_agro = [
            ("Helada crítica", "temperature", "<", None, 2.0, "critical"),
            ("Temperatura baja", "temperature", "<", None, 5.0, "warning"),
            ("Humedad suelo crítica", "soil_moisture", "<", None, 25.0, "critical"),
            ("Humedad suelo baja", "soil_moisture", "<", None, 35.0, "warning"),
            ("Batería baja", "battery", "<", None, 20.0, "warning"),
        ]
        for name, variable, operator, thr_low, thr_high, severity in rules_agro:
            await db.execute(text("""
                INSERT INTO rules
                    (org_id, device_id, name, variable, operator,
                     threshold_low, threshold_high, severity,
                     notify_whatsapp, notify_email, cooldown_min, active, created_at)
                VALUES
                    (:org_id, :device_id, :name, :variable, :operator,
                     :thr_low, :thr_high, :severity,
                     false, true, 60, true, NOW())
                ON CONFLICT DO NOTHING
            """), {
                "org_id": DEMO_ORG_ID,
                "device_id": DEMO_AGRO_ID,
                "name": name,
                "variable": variable,
                "operator": operator,
                "thr_low": thr_low,
                "thr_high": thr_high,
                "severity": severity,
            })

        # ── Reglas energía ────────────────────────────────────────────────────
        rules_energia = [
            ("Factor potencia crítico", "power_factor", "<", None, 0.75, "critical"),
            ("Factor potencia bajo",   "power_factor", "<", None, 0.85, "warning"),
            ("Voltaje alto",           "voltage",       ">", 242.0, None, "warning"),
            ("Voltaje bajo",           "voltage",       "<", None, 198.0, "warning"),
        ]
        for name, variable, operator, thr_low, thr_high, severity in rules_energia:
            await db.execute(text("""
                INSERT INTO rules
                    (org_id, device_id, name, variable, operator,
                     threshold_low, threshold_high, severity,
                     notify_whatsapp, notify_email, cooldown_min, active, created_at)
                VALUES
                    (:org_id, :device_id, :name, :variable, :operator,
                     :thr_low, :thr_high, :severity,
                     false, true, 60, true, NOW())
                ON CONFLICT DO NOTHING
            """), {
                "org_id": DEMO_ORG_ID,
                "device_id": DEMO_ENERGIA_ID,
                "name": name,
                "variable": variable,
                "operator": operator,
                "thr_low": thr_low,
                "thr_high": thr_high,
                "severity": severity,
            })

        await db.commit()

    print("✅ Seed completado.")
    print(f"   Login:          admin@ruwi.io / demo1234")
    print(f"   Org ID:         {DEMO_ORG_ID}")
    print(f"   Agro device:    {DEMO_AGRO_ID}")
    print(f"   Energia device: {DEMO_ENERGIA_ID}")


if __name__ == "__main__":
    asyncio.run(seed())
