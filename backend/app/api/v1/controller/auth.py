from fastapi import APIRouter, HTTPException, status, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import timedelta

from app.core.database import get_database
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import get_settings
from app.api.v1.schemas.user import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    UserRole,
)

router = APIRouter()
settings = get_settings()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Register a new user.
    
    Creates a new user account with the provided username and password.
    Password is hashed using bcrypt before storage.
    Returns access token upon successful registration.
    """
    # Check if username already exists
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Create user document
    from datetime import datetime
    user_doc = {
        "username": user_data.username,
        "hashed_password": get_password_hash(user_data.password),
        "role": UserRole.USER,  # Default role is user
        "created_at": datetime.utcnow()
    }
    
    # Insert user
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = str(result.inserted_id)
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_data.username},
        expires_delta=access_token_expires
    )
    
    # Prepare response
    user_response = UserResponse(
        _id=str(result.inserted_id),
        username=user_doc["username"],
        role=user_doc["role"],
        created_at=user_doc["created_at"]
    )
    
    return TokenResponse(
        access_token=access_token,
        user=user_response
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: UserLogin,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Login user.
    
    Authenticates user with username and password.
    Returns JWT access token upon successful authentication.
    """
    # Find user
    user = await db.users.find_one({"username": credentials.username})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify password
    if not verify_password(credentials.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]},
        expires_delta=access_token_expires
    )
    
    # Prepare response
    user_response = UserResponse(
        _id=str(user["_id"]),
        username=user["username"],
        role=user["role"],
        created_at=user["created_at"]
    )
    
    return TokenResponse(
        access_token=access_token,
        user=user_response
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(lambda: None)  # Will be replaced with actual dependency
):
    """Get current authenticated user information."""
    from app.api.v1.dependencies.auth import get_current_user
    user = await get_current_user(db=db)
    
    return UserResponse(
        _id=str(user["_id"]),
        username=user["username"],
        role=user["role"],
        created_at=user["created_at"]
    )
