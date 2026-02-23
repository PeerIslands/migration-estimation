from fastapi import APIRouter
from app.api.v1.controller.estimation import router as estimation_router
from app.api.v1.controller.auth import router as auth_router
from app.api.v1.controller.saved_estimations import router as saved_estimations_router
from app.api.v1.controller.admin import router as admin_router
from app.api.v1.controller.ai_autofill import router as ai_autofill_router
from app.api.v1.controller.tier_estimates import router as tier_estimates_router

api_router = APIRouter()


# Authentication routes
api_router.include_router(
    auth_router,
    prefix="/auth",
    tags=["authentication"]
)

# Migration estimation routes (public)
api_router.include_router(
    estimation_router,
    tags=["migration-estimation"]
)

# Saved estimations routes (protected)
api_router.include_router(
    saved_estimations_router,
    prefix="/estimations",
    tags=["saved-estimations"]
)

# AI Autofill routes (optional auth)
api_router.include_router(
    ai_autofill_router,
    prefix="/ai-autofill",
    tags=["ai-autofill"]
)

# Admin routes (admin only)
api_router.include_router(
    admin_router,
    prefix="/admin",
    tags=["admin"]
)

# Tier estimates routes (public read, admin write)
api_router.include_router(
    tier_estimates_router,
    tags=["tier-estimates"]
)
