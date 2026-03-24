from fastapi import APIRouter

from app.api.v1 import alerts, analytics, auth, devices, organizations, rules, telemetry, users

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(devices.router)
api_router.include_router(telemetry.router)
api_router.include_router(alerts.router)
api_router.include_router(rules.router)
api_router.include_router(organizations.router)
api_router.include_router(users.router)
api_router.include_router(analytics.router)
