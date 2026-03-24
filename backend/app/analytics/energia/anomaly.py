from datetime import timedelta
from uuid import UUID

import numpy as np

from app.analytics.base import AnalyticsBase


class EnergiaAnomalyDetector(AnalyticsBase):
    async def detect_zscore(self, device_id: UUID, variable: str, window_hours: int = 24) -> list[dict]:
        data = await self._query_timebucket(device_id, variable, "15 minutes", timedelta(hours=window_hours))

        if len(data) < 6:
            return []

        values = np.array([d["avg"] for d in data], dtype=float)
        mean = np.mean(values)
        std = np.std(values)

        if std == 0:
            return []

        anomalies = []
        for d, v in zip(data, values):
            zscore = abs((v - mean) / std)
            if zscore > 2.5:
                anomalies.append({
                    "time": d["t"].isoformat() if hasattr(d["t"], "isoformat") else str(d["t"]),
                    "value": round(v, 4),
                    "zscore": round(zscore, 2),
                    "mean": round(mean, 4),
                    "std": round(std, 4),
                })

        return anomalies
