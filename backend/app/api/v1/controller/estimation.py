from fastapi import APIRouter, HTTPException

from app.api.v1.schemas.estimation import (
    EstimationRequest,
    EstimationResponse,
    MigrationType,
)
from app.api.v1.services.estimation_service import calculate_estimation

router = APIRouter()


@router.post("/estimation", response_model=EstimationResponse)
async def create_estimation(
    request: EstimationRequest,
) -> EstimationResponse:
    """
    Create a migration estimation based on questionnaire answers.
    
    This endpoint analyzes the provided environment details and questionnaire
    answers, then applies migration rules to calculate the estimated effort.
    
    The estimation includes:
    - Per-environment effort based on data size, collections, and migration options
    - Activity breakdown for setup, validation, discovery, and other tasks
    - Variance bounds for the estimate
    - Key assumptions applied
    """
    try:
        # Validate that number of environments matches the list
        if len(request.environments) != request.number_of_environments:
            raise HTTPException(
                status_code=400,
                detail=f"number_of_environments ({request.number_of_environments}) "
                f"does not match the number of environments provided ({len(request.environments)})",
            )
        
        # Validate migration type is supported
        try:
            MigrationType(request.migration_type)
        except ValueError:
            supported_types = [t.value for t in MigrationType]
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported migration_type: {request.migration_type}. "
                f"Supported types: {supported_types}",
            )
        
        # Calculate the estimate
        response = calculate_estimation(request)
        return response
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error calculating estimation: {str(e)}",
        )


@router.get("/migration-types")
async def get_migration_types():
    """Get list of supported migration types."""
    return {
        "migration_types": [
            {
                "value": t.value,
                "label": t.value.replace("_", " ").title(),
            }
            for t in MigrationType
        ]
    }


@router.get("/health")
async def health_check():
    """Health check endpoint for the migration estimate service."""
    return {"status": "healthy", "service": "estimation"}
