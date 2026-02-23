"""
Tier Estimates API Controller
Handles reading and updating tier estimation configuration from YAML file
"""

import os
import yaml
from datetime import datetime
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from app.api.v1.dependencies.auth import get_current_admin_user

router = APIRouter(prefix="/tier-estimates", tags=["Tier Estimates"])

# Path to the tier estimates YAML file
TIER_ESTIMATES_PATH = os.path.join(
    os.path.dirname(__file__),
    "../../../migration/tier_estimates.yaml"
)


class TierBreakdown(BaseModel):
    """Phase breakdown for a tier"""
    planning: str
    migration: str
    testing: str
    deployment: str


class EstimateRange(BaseModel):
    """Min-max range for estimates"""
    min: int
    max: int


class TierEstimate(BaseModel):
    """Single tier estimate configuration"""
    name: str
    description: str
    data_range: str
    collections_range: str
    databases: str
    estimated_weeks: EstimateRange
    estimated_cost: EstimateRange
    breakdown: TierBreakdown
    key_considerations: list[str]


class TierEstimatesConfig(BaseModel):
    """Complete tier estimates configuration"""
    version: str
    last_updated: str
    tiers: Dict[str, TierEstimate]
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TierEstimatesUpdateRequest(BaseModel):
    """Request to update tier estimates"""
    tiers: Dict[str, TierEstimate]
    metadata: Dict[str, Any] = Field(default_factory=dict)


def read_tier_estimates() -> Dict[str, Any]:
    """Read tier estimates from YAML file"""
    try:
        with open(TIER_ESTIMATES_PATH, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Tier estimates configuration file not found"
        )
    except yaml.YAMLError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error parsing YAML file: {str(e)}"
        )


def write_tier_estimates(data: Dict[str, Any]) -> None:
    """Write tier estimates to YAML file"""
    try:
        # Update the last_updated timestamp
        data["last_updated"] = datetime.utcnow().strftime("%Y-%m-%d")
        
        with open(TIER_ESTIMATES_PATH, "w", encoding="utf-8") as f:
            yaml.dump(
                data,
                f,
                default_flow_style=False,
                sort_keys=False,
                allow_unicode=True
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error writing YAML file: {str(e)}"
        )


@router.get("", response_model=TierEstimatesConfig)
async def get_tier_estimates():
    """
    Get the current tier estimates configuration
    Public endpoint - no authentication required
    """
    data = read_tier_estimates()
    return data


@router.get("/raw")
async def get_tier_estimates_raw():
    """
    Get the raw tier estimates configuration (for editing)
    Returns the YAML content as a string
    """
    try:
        with open(TIER_ESTIMATES_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        return {"content": content}
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Tier estimates configuration file not found"
        )


@router.put("")
async def update_tier_estimates(
    request: TierEstimatesUpdateRequest,
    current_user: dict = Depends(get_current_admin_user)
):
    """
    Update tier estimates configuration
    Requires authentication and admin role
    """
    
    # Read current config
    current_config = read_tier_estimates()
    
    # Update tiers and metadata
    current_config["tiers"] = {
        tier_key: tier_value.model_dump()
        for tier_key, tier_value in request.tiers.items()
    }
    
    if request.metadata:
        current_config["metadata"] = request.metadata
    
    # Write updated config
    write_tier_estimates(current_config)
    
    return {
        "success": True,
        "message": "Tier estimates updated successfully",
        "last_updated": current_config["last_updated"]
    }


@router.put("/raw")
async def update_tier_estimates_raw(
    content: dict,
    current_user: dict = Depends(get_current_admin_user)
):
    """
    Update tier estimates from raw YAML content
    Requires authentication and admin role
    """
    
    try:
        # Parse the YAML content to validate it
        yaml_content = content.get("content", "")
        parsed_data = yaml.safe_load(yaml_content)
        
        # Validate basic structure
        if "tiers" not in parsed_data:
            raise HTTPException(
                status_code=400,
                detail="Invalid YAML: missing 'tiers' section"
            )
        
        # Write the validated content
        parsed_data["last_updated"] = datetime.utcnow().strftime("%Y-%m-%d")
        write_tier_estimates(parsed_data)
        
        return {
            "success": True,
            "message": "Tier estimates updated successfully from raw YAML",
            "last_updated": parsed_data["last_updated"]
        }
    except yaml.YAMLError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid YAML format: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error updating tier estimates: {str(e)}"
        )


@router.get("/{tier_name}")
async def get_single_tier_estimate(tier_name: str):
    """
    Get a single tier estimate by name (simple, medium, complex)
    """
    data = read_tier_estimates()
    
    if tier_name not in data.get("tiers", {}):
        raise HTTPException(
            status_code=404,
            detail=f"Tier '{tier_name}' not found"
        )
    
    return {
        "tier": tier_name,
        **data["tiers"][tier_name]
    }
