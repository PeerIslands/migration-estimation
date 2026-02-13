from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.api.v1.schemas.estimation import (
    EstimationRequest,
    EstimationResponse,
)


class SavedEstimationCreate(BaseModel):
    """Schema for saving an estimation."""
    name: Optional[str] = Field(None, description="Optional name for this estimation")
    request_data: EstimationRequest
    response_data: EstimationResponse


class SavedEstimation(BaseModel):
    """Schema for a saved estimation."""
    id: str = Field(..., alias="_id")
    user_id: str
    name: Optional[str] = None
    request_data: dict  # Stored as dict in DB
    response_data: dict  # Stored as dict in DB
    created_at: datetime
    updated_at: datetime
    
    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "_id": "507f1f77bcf86cd799439011",
                "user_id": "507f1f77bcf86cd799439012",
                "name": "Production Migration Q1 2024",
                "created_at": "2024-01-01T00:00:00",
                "updated_at": "2024-01-01T00:00:00"
            }
        }
    }


class SavedEstimationResponse(BaseModel):
    """Detailed response with full request and response data."""
    id: str = Field(..., alias="_id")
    user_id: str
    name: Optional[str] = None
    request_data: EstimationRequest
    response_data: EstimationResponse
    created_at: datetime
    updated_at: datetime
    
    model_config = {
        "populate_by_name": True
    }


class SavedEstimationList(BaseModel):
    """List item for saved estimations (summary only)."""
    id: str = Field(..., alias="_id")
    name: Optional[str] = None
    migration_type: str
    number_of_environments: int
    total_migration_days: float
    created_at: datetime
    
    model_config = {
        "populate_by_name": True
    }
