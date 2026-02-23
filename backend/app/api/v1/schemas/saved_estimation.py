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
    estimation_type: str = Field("detailed", description="Type of estimation: 'quick' or 'detailed'")
    request_data: Optional[EstimationRequest] = Field(None, description="Request data for detailed estimations")
    response_data: Optional[EstimationResponse] = Field(None, description="Response data for detailed estimations")
    quick_estimate_data: Optional[dict] = Field(None, description="Quick estimate data (dataSize, cost, weeks, etc.)")
    # Client details
    client_name: Optional[str] = Field(None, description="Client/Project name for this estimation (required from frontend)")
    # User details (for non-authenticated users)
    user_name: Optional[str] = Field(None, description="User's full name")
    user_email: Optional[str] = Field(None, description="User's email address")
    user_designation: Optional[str] = Field(None, description="User's job title/designation")
    user_company: Optional[str] = Field(None, description="User's company name")
    # Enquiry/query
    enquiry: Optional[str] = Field(None, description="User's enquiry or query about the estimation")
    has_enquiry: bool = Field(False, description="Whether the user has submitted an enquiry")
    lead_status: Optional[str] = Field(None, description="Lead status: new, under_review, quote_sent, converted, rejected, cold")
    lead_status_updated_at: Optional[datetime] = Field(None, description="When the lead status was last updated")
    # Archive status
    archived: bool = Field(False, description="Whether the estimation is archived")


class SavedEstimation(BaseModel):
    """Schema for a saved estimation."""
    id: str = Field(..., alias="_id")
    user_id: Optional[str] = None  # Optional for non-authenticated users
    name: Optional[str] = None
    estimation_type: str = "detailed"  # 'quick' or 'detailed'
    request_data: Optional[dict] = None  # Stored as dict in DB (for detailed estimations)
    response_data: Optional[dict] = None  # Stored as dict in DB (for detailed estimations)
    quick_estimate_data: Optional[dict] = None  # Quick estimate data
    # Client details
    client_name: Optional[str] = None
    # User details
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_designation: Optional[str] = None
    user_company: Optional[str] = None
    # Enquiry
    enquiry: Optional[str] = None
    has_enquiry: bool = False
    enquiry_read: bool = False  # Track if admin has read the enquiry
    lead_status: Optional[str] = None  # new, under_review, quote_sent, converted, rejected, cold
    lead_status_updated_at: Optional[datetime] = None
    # Archive
    archived: bool = False
    created_at: datetime
    updated_at: datetime
    
    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "_id": "507f1f77bcf86cd799439011",
                "user_id": "507f1f77bcf86cd799439012",
                "user_name": "John Doe",
                "user_email": "john@company.com",
                "user_designation": "CTO",
                "user_company": "Acme Corp",
                "name": "Production Migration Q1 2024",
                "estimation_type": "detailed",
                "created_at": "2024-01-01T00:00:00",
                "updated_at": "2024-01-01T00:00:00"
            }
        }
    }


class SavedEstimationResponse(BaseModel):
    """Detailed response with full request and response data."""
    id: str = Field(..., alias="_id")
    user_id: Optional[str] = None
    name: Optional[str] = None
    estimation_type: str = "detailed"
    request_data: Optional[EstimationRequest] = None
    response_data: Optional[EstimationResponse] = None
    quick_estimate_data: Optional[dict] = None
    client_name: Optional[str] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_designation: Optional[str] = None
    user_company: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = {
        "populate_by_name": True
    }


class SavedEstimationList(BaseModel):
    """List item for saved estimations (summary only)."""
    id: str = Field(..., alias="_id")
    name: Optional[str] = None
    estimation_type: str = "detailed"
    migration_type: Optional[str] = None  # Optional for quick estimates
    number_of_environments: Optional[int] = None  # Optional for quick estimates
    total_migration_days: Optional[float] = None  # Optional for quick estimates
    data_size: Optional[str] = None  # For quick estimates
    estimated_weeks_min: Optional[int] = None  # For quick estimates
    estimated_weeks_max: Optional[int] = None  # For quick estimates
    client_name: Optional[str] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_designation: Optional[str] = None
    user_company: Optional[str] = None
    enquiry: Optional[str] = None
    has_enquiry: bool = False
    enquiry_read: bool = False
    lead_status: Optional[str] = None
    lead_status_updated_at: Optional[datetime] = None
    archived: bool = False
    created_at: datetime
    
    model_config = {
        "populate_by_name": True
    }
