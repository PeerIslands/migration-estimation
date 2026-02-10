from fastapi import APIRouter
from app.api.v1.controller.estimation import router as estimation_router

api_router = APIRouter()


api_router.include_router(
    estimation_router,
    tags=["migration-estimation"]
)
