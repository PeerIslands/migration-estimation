from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from pathlib import Path
import yaml

from app.api.v1.dependencies.auth import get_current_admin_user

router = APIRouter()

# Path to rules.yaml file
RULES_FILE_PATH = Path(__file__).parent.parent.parent.parent / "migration" / "cosmosdb_to_mongodb" / "rules.yaml"


class RulesUpdate(BaseModel):
    """Schema for updating rules."""
    content: str


@router.get("/rules")
async def get_rules(
    current_user: dict = Depends(get_current_admin_user)
):
    """
    Get the current rules.yaml content.
    Admin only endpoint.
    """
    try:
        if not RULES_FILE_PATH.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Rules file not found"
            )
        
        with open(RULES_FILE_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return {
            "content": content,
            "file_path": str(RULES_FILE_PATH),
            "file_size": RULES_FILE_PATH.stat().st_size
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading rules file: {str(e)}"
        )


@router.put("/rules")
async def update_rules(
    rules: RulesUpdate,
    current_user: dict = Depends(get_current_admin_user)
):
    """
    Update the rules.yaml file.
    Admin only endpoint.
    
    Validates YAML syntax before saving.
    """
    try:
        # Validate YAML syntax
        try:
            yaml.safe_load(rules.content)
        except yaml.YAMLError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid YAML syntax: {str(e)}"
            )
        
        # Create backup of current file
        backup_path = RULES_FILE_PATH.with_suffix('.yaml.backup')
        if RULES_FILE_PATH.exists():
            with open(RULES_FILE_PATH, 'r', encoding='utf-8') as f:
                backup_content = f.read()
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(backup_content)
        
        # Write new content
        with open(RULES_FILE_PATH, 'w', encoding='utf-8') as f:
            f.write(rules.content)
        
        return {
            "message": "Rules updated successfully",
            "backup_created": str(backup_path),
            "updated_by": current_user.get("username")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating rules file: {str(e)}"
        )


@router.get("/weights")
async def get_weights(
    current_user: dict = Depends(get_current_admin_user)
):
    """Get the current weights.yaml content."""
    weights_path = RULES_FILE_PATH.parent / "weights.yaml"
    
    try:
        if not weights_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Weights file not found"
            )
        
        with open(weights_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return {
            "content": content,
            "file_path": str(weights_path)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading weights file: {str(e)}"
        )


@router.get("/assumptions")
async def get_assumptions(
    current_user: dict = Depends(get_current_admin_user)
):
    """Get the current assumptions.yaml content."""
    assumptions_path = RULES_FILE_PATH.parent / "assumptions.yaml"
    
    try:
        if not assumptions_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assumptions file not found"
            )
        
        with open(assumptions_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return {
            "content": content,
            "file_path": str(assumptions_path)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading assumptions file: {str(e)}"
        )
