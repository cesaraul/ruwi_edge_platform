EQUIPMENT_THRESHOLDS: dict[str, dict] = {
    "transformer": {
        "power_factor": {"critical_low": 0.75, "warning_low": 0.85},
        "oil_temp":     {"warning_high": 85,   "critical_high": 105},
        "load_pct":     {"warning_high": 90,   "critical_high": 110},
        "voltage":      {"warning_low": 207,   "critical_low": 198, "warning_high": 233, "critical_high": 242},
    },
    "solar_panel": {
        "efficiency_pct": {"critical_low": 50, "warning_low": 70},
        "panel_temp":     {"warning_high": 65, "critical_high": 80},
        "voltage":        {"warning_low": 10},
    },
    "default": {
        "voltage":      {"warning_low": 200,  "warning_high": 240},
        "current":      {"warning_high": 100},
        "power_factor": {"warning_low": 0.80},
    },
}


def get_thresholds_for_equipment(device_type: str | None) -> dict:
    return EQUIPMENT_THRESHOLDS.get(device_type or "default", EQUIPMENT_THRESHOLDS["default"])
