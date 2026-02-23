from fastapi import APIRouter, HTTPException, status, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from bson import ObjectId
from datetime import datetime

from app.core.database import get_database
from app.api.v1.dependencies.auth import get_current_user, get_optional_current_user, get_current_admin_user
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
    current_user: dict = Depends(get_optional_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Save an estimation.
    
    Stores both the request data (questionnaire answers) and the 
    calculated response (estimation results) in the database.
    
    Authentication is optional - if user is authenticated, stores user_id,
    otherwise stores user details (name, email, designation, company).
    """
    # Set lead_status to "new" if has_enquiry is true (unless already provided)
    lead_status = estimation.lead_status if estimation.lead_status else ("new" if estimation.has_enquiry else None)
    
    estimation_doc = {
        "user_id": str(current_user["_id"]) if current_user else None,
        "name": estimation.name,
        "estimation_type": estimation.estimation_type,
        "request_data": estimation.request_data.model_dump() if estimation.request_data else None,
        "response_data": estimation.response_data.model_dump() if estimation.response_data else None,
        "quick_estimate_data": estimation.quick_estimate_data,
        "client_name": estimation.client_name,
        "user_name": estimation.user_name,
        "user_email": estimation.user_email,
        "user_designation": estimation.user_designation,
        "user_company": estimation.user_company,
        "enquiry": estimation.enquiry,
        "has_enquiry": estimation.has_enquiry,
        "enquiry_read": False,  # New enquiries are unread by default
        "lead_status": lead_status,
        "lead_status_updated_at": datetime.utcnow() if lead_status else None,
        "archived": False,  # New estimations are not archived by default
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.estimations.insert_one(estimation_doc)
    estimation_doc["_id"] = str(result.inserted_id)
    
    return SavedEstimation(**estimation_doc)


@router.put("/{estimation_id}", response_model=SavedEstimation)
async def update_estimation(
    estimation_id: str,
    estimation: SavedEstimationCreate,
    current_user: dict = Depends(get_optional_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Update an existing estimation (e.g., replace quick estimate with detailed estimate).
    
    This is used when a user does a quick estimate first, then proceeds to do a detailed estimate.
    We update the existing record instead of creating a new one.
    """
    # Validate estimation_id format
    if not ObjectId.is_valid(estimation_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid estimation ID format"
        )
    
    # Set lead_status to "new" if has_enquiry is true (unless already provided)
    lead_status = estimation.lead_status if estimation.lead_status else ("new" if estimation.has_enquiry else None)
    
    update_doc = {
        "name": estimation.name,
        "estimation_type": estimation.estimation_type,
        "request_data": estimation.request_data.model_dump() if estimation.request_data else None,
        "response_data": estimation.response_data.model_dump() if estimation.response_data else None,
        "quick_estimate_data": estimation.quick_estimate_data,
        "client_name": estimation.client_name,
        "user_name": estimation.user_name,
        "user_email": estimation.user_email,
        "user_designation": estimation.user_designation,
        "user_company": estimation.user_company,
        "enquiry": estimation.enquiry,
        "has_enquiry": estimation.has_enquiry,
        "lead_status": lead_status,
        "lead_status_updated_at": datetime.utcnow() if lead_status else None,
        "updated_at": datetime.utcnow()
    }
    
    # Update the estimation
    result = await db.estimations.find_one_and_update(
        {"_id": ObjectId(estimation_id)},
        {"$set": update_doc},
        return_document=True
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estimation not found"
        )
    
    result["_id"] = str(result["_id"])
    return SavedEstimation(**result)


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
        estimation_type = est.get("estimation_type", "detailed")
        
        if estimation_type == "quick":
            quick_data = est.get("quick_estimate_data", {})
            result.append(SavedEstimationList(
                _id=str(est["_id"]),
                name=est.get("name"),
                estimation_type="quick",
                data_size=quick_data.get("dataSize"),
                estimated_weeks_min=quick_data.get("estimatedWeeks", {}).get("min"),
                estimated_weeks_max=quick_data.get("estimatedWeeks", {}).get("max"),
                user_name=est.get("user_name"),
                user_email=est.get("user_email"),
                user_designation=est.get("user_designation"),
                user_company=est.get("user_company"),
                enquiry=est.get("enquiry"),
                has_enquiry=est.get("has_enquiry", False),
                enquiry_read=est.get("enquiry_read", False),
                lead_status=est.get("lead_status"),
                lead_status_updated_at=est.get("lead_status_updated_at"),
                created_at=est["created_at"]
            ))
        else:
            # Detailed estimation
            response_data = est.get("response_data", {})
            result.append(SavedEstimationList(
                _id=str(est["_id"]),
                name=est.get("name"),
                estimation_type="detailed",
                migration_type=response_data.get("migration_type"),
                number_of_environments=len(response_data.get("per_environment_estimates", [])),
                total_migration_days=response_data.get("total_migration_days"),
                user_name=est.get("user_name"),
                user_email=est.get("user_email"),
                user_designation=est.get("user_designation"),
                user_company=est.get("user_company"),
                enquiry=est.get("enquiry"),
                has_enquiry=est.get("has_enquiry", False),
                enquiry_read=est.get("enquiry_read", False),
                lead_status=est.get("lead_status"),
                lead_status_updated_at=est.get("lead_status_updated_at"),
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
    current_user: dict = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
    skip: int = 0,
    limit: int = 100
):
    """
    Admin only: Get all estimations from all users (excluding archived).
    """
    cursor = db.estimations.find({"archived": {"$ne": True}}).sort("created_at", -1).skip(skip).limit(limit)
    estimations = await cursor.to_list(length=limit)
    
    result = []
    for est in estimations:
        estimation_type = est.get("estimation_type", "detailed")
        
        if estimation_type == "quick":
            quick_data = est.get("quick_estimate_data", {})
            result.append(SavedEstimationList(
                _id=str(est["_id"]),
                name=est.get("name"),
                estimation_type="quick",
                data_size=quick_data.get("dataSize"),
                estimated_weeks_min=quick_data.get("estimatedWeeks", {}).get("min"),
                estimated_weeks_max=quick_data.get("estimatedWeeks", {}).get("max"),
                user_name=est.get("user_name"),
                user_email=est.get("user_email"),
                user_designation=est.get("user_designation"),
                user_company=est.get("user_company"),
                enquiry=est.get("enquiry"),
                has_enquiry=est.get("has_enquiry", False),
                enquiry_read=est.get("enquiry_read", False),
                lead_status=est.get("lead_status"),
                lead_status_updated_at=est.get("lead_status_updated_at"),
                created_at=est["created_at"]
            ))
        else:
            # Detailed estimation
            response_data = est.get("response_data", {})
            result.append(SavedEstimationList(
                _id=str(est["_id"]),
                name=est.get("name"),
                estimation_type="detailed",
                migration_type=response_data.get("migration_type"),
                number_of_environments=len(response_data.get("per_environment_estimates", [])),
                total_migration_days=response_data.get("total_migration_days"),
                user_name=est.get("user_name"),
                user_email=est.get("user_email"),
                user_designation=est.get("user_designation"),
                user_company=est.get("user_company"),
                enquiry=est.get("enquiry"),
                has_enquiry=est.get("has_enquiry", False),
                enquiry_read=est.get("enquiry_read", False),
                lead_status=est.get("lead_status"),
                lead_status_updated_at=est.get("lead_status_updated_at"),
                created_at=est["created_at"]
            ))
    
    return result


@router.patch("/{estimation_id}/mark-enquiry-read", status_code=status.HTTP_200_OK)
async def mark_enquiry_read(
    estimation_id: str,
    current_user: dict = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Mark an enquiry as read (Admin only).
    """
    try:
        obj_id = ObjectId(estimation_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid estimation ID format"
        )
    
    result = await db.estimations.update_one(
        {"_id": obj_id},
        {"$set": {"enquiry_read": True, "updated_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estimation not found"
        )
    
    return {"message": "Enquiry marked as read"}


@router.get("/admin/enquiries/count", response_model=dict)
async def get_unread_enquiries_count(
    current_user: dict = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get count of unread enquiries (Admin only).
    """
    count = await db.estimations.count_documents({
        "has_enquiry": True,
        "enquiry_read": False
    })
    
    return {"unread_count": count}


@router.patch("/{estimation_id}/add-enquiry", status_code=status.HTTP_200_OK)
async def add_enquiry_to_estimation(
    estimation_id: str,
    enquiry: dict,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Add an enquiry to an existing estimation.
    Authentication not required - allows non-authenticated users to submit enquiries.
    """
    try:
        obj_id = ObjectId(estimation_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid estimation ID format"
        )
    
    enquiry_text = enquiry.get("enquiry", "")
    if not enquiry_text or not enquiry_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enquiry text is required"
        )
    
    result = await db.estimations.update_one(
        {"_id": obj_id},
        {
            "$set": {
                "enquiry": enquiry_text,
                "has_enquiry": True,
                "enquiry_read": False,
                "lead_status": "new",
                "lead_status_updated_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estimation not found"
        )
    
    return {"message": "Enquiry added successfully"}


@router.patch("/{estimation_id}/update-lead-status", status_code=status.HTTP_200_OK)
async def update_lead_status(
    estimation_id: str,
    status_update: dict,
    current_user: dict = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Update lead status for an estimation with enquiry (Admin only).
    Valid statuses: new, under_review, quote_sent, converted, rejected, cold
    """
    try:
        obj_id = ObjectId(estimation_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid estimation ID format"
        )
    
    new_status = status_update.get("lead_status", "").lower()
    valid_statuses = ["new", "under_review", "quote_sent", "converted", "rejected", "cold"]
    
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid lead status. Must be one of: {', '.join(valid_statuses)}"
        )
    
    # Verify estimation has enquiry
    estimation = await db.estimations.find_one({"_id": obj_id})
    if not estimation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estimation not found"
        )
    
    if not estimation.get("has_enquiry", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot set lead status on estimation without enquiry"
        )
    
    result = await db.estimations.update_one(
        {"_id": obj_id},
        {
            "$set": {
                "lead_status": new_status,
                "lead_status_updated_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {"message": f"Lead status updated to '{new_status}'", "lead_status": new_status}


@router.get("/admin/leads/status-counts", response_model=dict)
async def get_lead_status_counts(
    current_user: dict = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get count of enquiries by lead status (Admin only).
    """
    pipeline = [
        {"$match": {"has_enquiry": True}},
        {"$group": {
            "_id": "$lead_status",
            "count": {"$sum": 1}
        }}
    ]
    
    results = await db.estimations.aggregate(pipeline).to_list(None)
    
    status_counts = {
        "new": 0,
        "under_review": 0,
        "quote_sent": 0,
        "converted": 0,
        "rejected": 0,
        "cold": 0,
        "total": 0
    }
    
    for result in results:
        status = result["_id"]
        count = result["count"]
        if status in status_counts:
            status_counts[status] = count
        status_counts["total"] += count
    
    return status_counts


@router.get("/admin/archived", response_model=List[SavedEstimationList])
async def get_archived_estimations(
    current_user: dict = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get all archived estimations (Admin only).
    """
    cursor = db.estimations.find({"archived": True}).sort("created_at", -1)
    estimations_list = await cursor.to_list(length=None)
    
    result = []
    for est in estimations_list:
        est["_id"] = str(est["_id"])
        estimation_type = est.get("estimation_type", "detailed")
        
        if estimation_type == "quick":
            quick_data = est.get("quick_estimate_data", {})
            result.append(SavedEstimationList(
                _id=est["_id"],
                name=est.get("name"),
                estimation_type="quick",
                data_size=quick_data.get("dataSize"),
                estimated_weeks_min=quick_data.get("estimatedWeeks", {}).get("min"),
                estimated_weeks_max=quick_data.get("estimatedWeeks", {}).get("max"),
                user_name=est.get("user_name"),
                user_email=est.get("user_email"),
                user_designation=est.get("user_designation"),
                user_company=est.get("user_company"),
                enquiry=est.get("enquiry"),
                has_enquiry=est.get("has_enquiry", False),
                enquiry_read=est.get("enquiry_read", False),
                lead_status=est.get("lead_status"),
                lead_status_updated_at=est.get("lead_status_updated_at"),
                archived=est.get("archived", False),
                created_at=est["created_at"]
            ))
        else:
            response_data = est.get("response_data", {})
            request_data = est.get("request_data", {})
            result.append(SavedEstimationList(
                _id=est["_id"],
                name=est.get("name"),
                estimation_type="detailed",
                migration_type=request_data.get("migration_type", "cosmosdb_to_mongodb"),
                number_of_environments=request_data.get("number_of_environments"),
                total_migration_days=response_data.get("total_migration_days"),
                user_name=est.get("user_name"),
                user_email=est.get("user_email"),
                user_designation=est.get("user_designation"),
                user_company=est.get("user_company"),
                enquiry=est.get("enquiry"),
                has_enquiry=est.get("has_enquiry", False),
                enquiry_read=est.get("enquiry_read", False),
                lead_status=est.get("lead_status"),
                lead_status_updated_at=est.get("lead_status_updated_at"),
                archived=est.get("archived", False),
                created_at=est["created_at"]
            ))
    
    return result


@router.get("/admin/reminders", response_model=List[dict])
async def get_inactivity_reminders(
    current_user: dict = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get estimations with 15+ days of inactivity (Admin only).
    Returns estimations that need attention.
    """
    from datetime import timedelta
    
    # Calculate 15 days ago
    fifteen_days_ago = datetime.utcnow() - timedelta(days=15)
    
    # Find non-archived estimations with enquiries that haven't been updated in 15+ days
    # Exclude converted, rejected, and cold statuses (but allow null/missing lead_status)
    cursor = db.estimations.find({
        "archived": {"$ne": True},
        "has_enquiry": True,
        "$and": [
            {
                "$or": [
                    {"lead_status": None},
                    {"lead_status": {"$exists": False}},
                    {"lead_status": {"$nin": ["converted", "rejected", "cold"]}}
                ]
            },
            {
                "$or": [
                    {"updated_at": {"$lt": fifteen_days_ago}},
                    {"updated_at": {"$exists": False}, "created_at": {"$lt": fifteen_days_ago}}
                ]
            }
        ]
    }).sort("updated_at", 1)
    
    reminders = []
    async for est in cursor:
        last_update = est.get("updated_at") or est.get("created_at")
        days_inactive = (datetime.utcnow() - last_update).days if last_update else 0
        
        reminders.append({
            "_id": str(est["_id"]),
            "name": est.get("name"),
            "user_name": est.get("user_name"),
            "user_email": est.get("user_email"),
            "user_company": est.get("user_company"),
            "lead_status": est.get("lead_status"),
            "days_inactive": days_inactive,
            "last_updated": last_update.isoformat() if last_update else None
        })
    
    return reminders


@router.post("/admin/update-cold-status", response_model=dict)
async def update_cold_status(
    current_user: dict = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Automatically update status to "cold" for estimations with 90+ days of inactivity (Admin only).
    This should be called periodically (e.g., daily cron job or on-demand).
    """
    from datetime import timedelta
    
    # Calculate 90 days ago
    ninety_days_ago = datetime.utcnow() - timedelta(days=90)
    
    # Find archived estimations with enquiries that haven't been updated in 90+ days
    # Exclude already cold, converted, and rejected statuses
    result = await db.estimations.update_many(
        {
            "archived": True,
            "has_enquiry": True,
            "lead_status": {"$nin": ["cold", "converted", "rejected"]},
            "$or": [
                {"updated_at": {"$lt": ninety_days_ago}},
                {"updated_at": {"$exists": False}, "created_at": {"$lt": ninety_days_ago}}
            ]
        },
        {
            "$set": {
                "lead_status": "cold",
                "lead_status_updated_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "message": f"Updated {result.modified_count} estimation(s) to cold status",
        "count": result.modified_count
    }


@router.get("/admin/{estimation_id}", response_model=SavedEstimationResponse)
async def get_estimation_admin(
    estimation_id: str,
    current_user: dict = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Admin endpoint to get full details of any estimation including response_data.
    
    Returns the complete estimation with request_data and response_data for analysis.
    """
    try:
        obj_id = ObjectId(estimation_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid estimation ID format"
        )
    
    estimation = await db.estimations.find_one({"_id": obj_id})
    
    if not estimation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estimation not found"
        )
    
    estimation["_id"] = str(estimation["_id"])
    return SavedEstimationResponse(**estimation)


@router.patch("/{estimation_id}/archive", status_code=status.HTTP_200_OK)
async def archive_estimation(
    estimation_id: str,
    current_user: dict = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Archive an estimation (Admin only).
    """
    try:
        obj_id = ObjectId(estimation_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid estimation ID format"
        )
    
    result = await db.estimations.update_one(
        {"_id": obj_id},
        {"$set": {
            "archived": True,
            "updated_at": datetime.utcnow()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estimation not found"
        )
    
    return {"message": "Estimation archived successfully"}


@router.patch("/{estimation_id}/unarchive", status_code=status.HTTP_200_OK)
async def unarchive_estimation(
    estimation_id: str,
    current_user: dict = Depends(get_current_admin_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Unarchive an estimation (Admin only).
    """
    try:
        obj_id = ObjectId(estimation_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid estimation ID format"
        )
    
    result = await db.estimations.update_one(
        {"_id": obj_id},
        {"$set": {
            "archived": False,
            "updated_at": datetime.utcnow()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estimation not found"
        )
    
    return {"message": "Estimation unarchived successfully"}
