from fastapi import APIRouter, HTTPException, status, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from bson import ObjectId
from datetime import datetime

from app.core.database import get_database
from app.api.v1.dependencies.auth import get_current_user
from app.api.v1.schemas.saved_estimation import (
    SavedEstimationCreate,
    SavedEstimation,
    SavedEstimationResponse,
    SavedEstimationList,
)

router = APIRouter()


@router.post("/", response_model=SavedEstimation, status_code=status.HTTP_201_CREATED)
async def save_estimation(
    estimation: SavedEstimationCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Save an estimation for the current user.
    
    Stores both the request data (questionnaire answers) and the 
    calculated response (estimation results) in the database.
    """
    estimation_doc = {
        "user_id": str(current_user["_id"]),
        "name": estimation.name,
        "request_data": estimation.request_data.model_dump(),
        "response_data": estimation.response_data.model_dump(),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.estimations.insert_one(estimation_doc)
    estimation_doc["_id"] = str(result.inserted_id)
    
    return SavedEstimation(**estimation_doc)


@router.get("/", response_model=List[SavedEstimationList])
async def get_user_estimations(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
    skip: int = 0,
    limit: int = 50
):
    """
    Get all saved estimations for the current user.
    
    Returns a summary list of estimations (without full details).
    Use GET /estimations/{id} to get full details.
    """
    cursor = db.estimations.find(
        {"user_id": str(current_user["_id"])}
    ).sort("created_at", -1).skip(skip).limit(limit)
    
    estimations = await cursor.to_list(length=limit)
    
    # Convert to list format with summary info
    result = []
    for est in estimations:
        result.append(SavedEstimationList(
            _id=str(est["_id"]),
            name=est.get("name"),
            migration_type=est["response_data"]["migration_type"],
            number_of_environments=len(est["response_data"].get("per_environment_estimates", [])),
            total_migration_days=est["response_data"]["total_migration_days"],
            created_at=est["created_at"]
        ))
    
    return result


@router.get("/{estimation_id}", response_model=SavedEstimationResponse)
async def get_estimation(
    estimation_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get full details of a specific saved estimation.
    
    Returns both the original request data and the calculated response.
    """
    try:
        obj_id = ObjectId(estimation_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid estimation ID format"
        )
    
    estimation = await db.estimations.find_one({
        "_id": obj_id,
        "user_id": str(current_user["_id"])
    })
    
    if not estimation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estimation not found"
        )
    
    estimation["_id"] = str(estimation["_id"])
    return SavedEstimationResponse(**estimation)


@router.put("/{estimation_id}", response_model=SavedEstimation)
async def update_estimation_name(
    estimation_id: str,
    name: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Update the name of a saved estimation.
    """
    try:
        obj_id = ObjectId(estimation_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid estimation ID format"
        )
    
    result = await db.estimations.update_one(
        {"_id": obj_id, "user_id": str(current_user["_id"])},
        {"$set": {"name": name, "updated_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estimation not found"
        )
    
    estimation = await db.estimations.find_one({"_id": obj_id})
    estimation["_id"] = str(estimation["_id"])
    
    return SavedEstimation(**estimation)


@router.delete("/{estimation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_estimation(
    estimation_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Delete a saved estimation.
    """
    try:
        obj_id = ObjectId(estimation_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid estimation ID format"
        )
    
    result = await db.estimations.delete_one({
        "_id": obj_id,
        "user_id": str(current_user["_id"])
    })
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estimation not found"
        )
    
    return None


# Admin endpoint to view all estimations
@router.get("/admin/all", response_model=List[SavedEstimationList])
async def get_all_estimations_admin(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
    skip: int = 0,
    limit: int = 100
):
    """
    Admin only: Get all estimations from all users.
    """
    from app.api.v1.dependencies.auth import get_current_admin_user
    await get_current_admin_user(current_user)
    
    cursor = db.estimations.find().sort("created_at", -1).skip(skip).limit(limit)
    estimations = await cursor.to_list(length=limit)
    
    result = []
    for est in estimations:
        result.append(SavedEstimationList(
            _id=str(est["_id"]),
            name=est.get("name"),
            migration_type=est["response_data"]["migration_type"],
            number_of_environments=len(est["response_data"].get("per_environment_estimates", [])),
            total_migration_days=est["response_data"]["total_migration_days"],
            created_at=est["created_at"]
        ))
    
    return result
