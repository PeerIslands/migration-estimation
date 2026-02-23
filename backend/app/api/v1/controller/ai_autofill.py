"""
AI Autofill Controller - Endpoints for AI-assisted form filling.
"""

from fastapi import APIRouter, File, UploadFile, HTTPException, status, Depends
from fastapi.responses import FileResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, Any, List
from pydantic import BaseModel
import json
import os

from app.services.llm_service import LLMService
from app.services.document_service import DocumentService
from app.services.cosmosdb_service import CosmosDBService
from app.core.database import get_database
from app.api.v1.dependencies.auth import get_optional_current_user

router = APIRouter()


class CosmosDBDiscoverRequest(BaseModel):
    """Request to discover databases in CosmosDB account."""
    connection_string: str


class CosmosDBExtractRequest(BaseModel):
    """Request to extract data from CosmosDB with environment groupings."""
    connection_string: str
    environment_groups: List[Dict[str, Any]]
    # Example: [
    #   {"environment_name": "production", "databases": ["prod_db", "analytics_db"]},
    #   {"environment_name": "staging", "databases": ["staging_db"]}
    # ]


class ManualPromptRequest(BaseModel):
    """Request with manual text description."""
    description: str


@router.post("/upload-document")
async def upload_document_autofill(
    file: UploadFile = File(...),
    current_user: dict | None = Depends(get_optional_current_user)
):
    """
    Upload a document (PDF/TXT) and extract questionnaire data using AI.
    
    Args:
        file: Uploaded document file
        
    Returns:
        Extracted questionnaire data ready to prefill the form
    """
    
    # Validate file type
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided"
        )
    
    file_extension = file.filename.lower().split('.')[-1]
    if file_extension not in ['pdf', 'txt']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload PDF or TXT files."
        )
    
    # Validate file size (max 10MB)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 10MB."
        )
    
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )
    
    try:
        # Extract text from document
        doc_service = DocumentService()
        extracted_text = await doc_service.extract_text(content, file.filename)
        
        # Process with LLM
        llm_service = LLMService()
        questionnaire_data = await llm_service.extract_questionnaire_data(extracted_text)
        
        return {
            "success": True,
            "source": "document",
            "filename": file.filename,
            "data": questionnaire_data,
            "message": "Document processed successfully. Review and edit the extracted data before submission."
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing document: {str(e)}"
        )


@router.post("/cosmosdb/discover")
async def discover_cosmosdb_databases(
    request: CosmosDBDiscoverRequest,
    current_user: dict | None = Depends(get_optional_current_user)
):
    """
    Step 1: Discover all databases in a CosmosDB account.
    
    Args:
        request: CosmosDB connection string
        
    Returns:
        List of all databases with basic metadata
    """
    
    try:
        cosmosdb_service = CosmosDBService()
        databases = await cosmosdb_service.discover_databases(request.connection_string)
        
        return {
            "success": True,
            "databases": databases,
            "total_databases": len(databases),
            "message": f"Found {len(databases)} database(s) in your CosmosDB account."
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error discovering databases: {str(e)}"
        )


@router.post("/cosmosdb/extract")
async def extract_cosmosdb_data(
    request: CosmosDBExtractRequest,
    current_user: dict | None = Depends(get_optional_current_user)
):
    """
    Step 2: Extract comprehensive metadata from grouped CosmosDB databases.
    
    Args:
        request: Connection string and environment groupings
        
    Returns:
        Complete questionnaire data with aggregated environments
    """
    
    if not request.environment_groups:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one environment group must be specified"
        )
    
    try:
        cosmosdb_service = CosmosDBService()
        questionnaire_data = await cosmosdb_service.extract_databases(
            request.connection_string,
            request.environment_groups
        )
        
        # Calculate totals for message
        total_envs = len(questionnaire_data["environments"])
        total_dbs = sum(
            env["answers"]["number_of_databases"] 
            for env in questionnaire_data["environments"]
        )
        total_collections = sum(
            env["answers"]["number_of_collections"]
            for env in questionnaire_data["environments"]
        )
        
        return {
            "success": True,
            "source": "cosmosdb",
            "data": questionnaire_data,
            "message": f"Successfully extracted {total_envs} environment(s) with {total_dbs} database(s) and {total_collections} collection(s). Review and edit before submission."
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error extracting CosmosDB data: {str(e)}"
        )


@router.post("/manual-prompt")
async def manual_prompt_autofill(
    request: ManualPromptRequest,
    current_user: dict | None = Depends(get_optional_current_user)
):
    """
    Generate questionnaire data from a manual text description using AI.
    
    Args:
        request: Manual text description of the migration
        
    Returns:
        Generated questionnaire data from the description
    """
    
    if not request.description or len(request.description.strip()) < 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Description too short. Please provide at least 20 characters describing your migration."
        )
    
    try:
        # Process with LLM
        llm_service = LLMService()
        questionnaire_data = await llm_service.extract_questionnaire_data(request.description)
        
        return {
            "success": True,
            "source": "manual",
            "data": questionnaire_data,
            "message": "Questionnaire generated from your description. Review and edit before submission."
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating questionnaire: {str(e)}"
        )


@router.get("/download-script")
async def download_extraction_script(
    current_user: dict | None = Depends(get_optional_current_user)
):
    """
    Download the Python script for extracting CosmosDB metadata.
    
    Returns:
        The extraction script file
    """
    # Get the absolute path to the backend directory
    # __file__ is at: backend/app/api/v1/controller/ai_autofill.py
    current_file = os.path.abspath(__file__)
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(current_file)))))
    script_path = os.path.join(backend_dir, "scripts", "extract_cosmosdb_metadata.py")
    
    if not os.path.exists(script_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Script file not found at {script_path}"
        )
    
    return FileResponse(
        path=script_path,
        media_type="text/x-python",
        filename="extract_cosmosdb_metadata.py"
    )


@router.post("/upload-script-output")
async def upload_script_output(
    file: UploadFile = File(...),
    current_user: dict | None = Depends(get_optional_current_user)
):
    """
    Upload and process the JSON output from the extraction script.
    
    Args:
        file: JSON file generated by the extraction script
        
    Returns:
        Processed questionnaire data
    """
    
    if not file.filename.endswith('.json'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JSON files are accepted"
        )
    
    if file.size and file.size > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds 10MB limit"
        )
    
    try:
        # Read and parse JSON
        content = await file.read()
        script_output = json.loads(content)
        
        # Validate structure
        if "questionnaire" not in script_output:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid script output format: 'questionnaire' key not found"
            )
        
        questionnaire_data = script_output["questionnaire"]
        
        # Validate questionnaire structure
        required_keys = ["migration_type", "questionnaire_version", "number_of_environments", "environments", "global_answers"]
        missing_keys = [key for key in required_keys if key not in questionnaire_data]
        
        if missing_keys:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid questionnaire format: missing keys {missing_keys}"
            )
        
        # Calculate totals for message
        total_envs = len(questionnaire_data["environments"])
        total_dbs = sum(
            env["answers"]["number_of_databases"] 
            for env in questionnaire_data["environments"]
        )
        total_collections = sum(
            env["answers"]["number_of_collections"]
            for env in questionnaire_data["environments"]
        )
        
        return {
            "success": True,
            "source": "script_output",
            "data": questionnaire_data,
            "message": f"Successfully processed script output: {total_envs} environment(s) with {total_dbs} database(s) and {total_collections} collection(s). Review and edit before submission."
        }
        
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON file"
        )
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required field in script output: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing script output: {str(e)}"
        )
