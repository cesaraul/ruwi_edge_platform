CROP_THRESHOLDS: dict[str, dict] = {
    "papa_andina": {
        "soil_moisture": {"critical_low": 25, "warning_low": 35, "warning_high": 75, "critical_high": 85},
        "temperature":   {"critical_low": -2, "warning_low": 5,  "warning_high": 25, "critical_high": 30},
        "humidity":      {"warning_low": 40,  "warning_high": 90},
        "battery":       {"warning_low": 20},
        "frost_risk_temp": 2,
    },
    "maiz_costa": {
        "soil_moisture": {"critical_low": 40, "warning_low": 50, "warning_high": 80, "critical_high": 90},
        "temperature":   {"critical_low": 10, "warning_low": 15, "warning_high": 35, "critical_high": 40},
        "battery":       {"warning_low": 20},
    },
    "quinua": {
        "soil_moisture": {"critical_low": 20, "warning_low": 30, "warning_high": 65, "critical_high": 75},
        "temperature":   {"critical_low": -2, "warning_low": 3,  "warning_high": 28, "critical_high": 32},
        "battery":       {"warning_low": 20},
        "frost_risk_temp": 3,
    },
    "default": {
        "soil_moisture": {"warning_low": 30,  "warning_high": 80},
        "temperature":   {"warning_low": 0,   "warning_high": 35},
        "battery":       {"warning_low": 20},
    },
}


def get_thresholds_for_crop(crop_type: str | None) -> dict:
    return CROP_THRESHOLDS.get(crop_type or "default", CROP_THRESHOLDS["default"])
