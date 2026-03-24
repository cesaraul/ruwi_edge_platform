from datetime import timedelta
from uuid import UUID

import numpy as np
from sklearn.linear_model import LinearRegression

from app.analytics.base import AnalyticsBase
from app.models.db.device import Device
from app.rules.agro_rules import CROP_THRESHOLDS


class AgroPredictions(AnalyticsBase):
    async def predict_temperature(self, device_id: UUID, hours_ahead: int = 6) -> dict:
        data = await self._query_timebucket(device_id, "temperature", "15 minutes", timedelta(hours=12))

        if len(data) < 4:
            return {"available": False, "reason": "Datos insuficientes (< 4 puntos)"}

        X = np.arange(len(data)).reshape(-1, 1)
        y = np.array([d["avg"] for d in data], dtype=float)

        model = LinearRegression().fit(X, y)
        future_x = np.array([[len(data) + hours_ahead * 4]])
        predicted = float(model.predict(future_x)[0])
        confidence = max(0.0, float(model.score(X, y)))

        device = await self.db.get(Device, device_id)
        frost_threshold = (
            CROP_THRESHOLDS.get(device.crop_type or "default", CROP_THRESHOLDS["default"])
            .get("frost_risk_temp", 2)
            if device else 2
        )

        return {
            "available": True,
            "variable": "temperature",
            "predicted_value": round(predicted, 1),
            "hours_ahead": hours_ahead,
            "confidence": round(confidence, 2),
            "frost_risk": predicted < frost_threshold,
            "frost_threshold": frost_threshold,
            "current_trend": "down" if model.coef_[0] < 0 else "up",
        }
