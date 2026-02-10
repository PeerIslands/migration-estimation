from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class MigrationType(str, Enum):
    """Supported migration types."""
    COSMOSDB_TO_MONGODB = "cosmosdb_to_mongodb"


class SourceApiType(str, Enum):
    """CosmosDB API types."""
    MONGO = "mongo"
    SQL = "sql"
    NOSQL = "nosql"


class TargetCloud(str, Enum):
    """Target cloud environments."""
    AWS = "aws"
    AZURE = "azure"
    GOOGLE = "google"


class EnvironmentAnswers(BaseModel):
    """Per-environment answers from the questionnaire."""
    
    # Required for estimation calculation
    total_data_gb: float = Field(..., description="Total size of data in GB", ge=0)
    number_of_collections: int = Field(..., description="Number of collections to migrate", ge=0)
    number_of_databases: int = Field(..., description="Number of databases to migrate", ge=0)
    reverse_sync: bool = Field(False, description="Is reverse sync required?")
    hard_deletes: bool = Field(False, description="Should deletes be captured in the change stream?")
    
    # Optional fields from questionnaire
    api_version: Optional[str] = Field(None, description="API Version (e.g., 3.6, 4.0, 5.0)")
    num_accounts: Optional[int] = Field(None, description="Number of accounts", ge=0)
    has_partitioned_collections: Optional[bool] = Field(None, description="Do you have partitioned collections?")
    ru_configuration: Optional[str] = Field(None, description="RU configuration (single/shared)")
    read_write_tps: Optional[str] = Field(None, description="Read & Write TPS")
    num_consumer_apps: Optional[int] = Field(None, description="Number of consumer applications", ge=0)
    performs_deletes: Optional[bool] = Field(None, description="Does application perform delete transactions?")
    change_stream_required: Optional[bool] = Field(None, description="Is change stream required?")
    app_refactoring_required: Optional[bool] = Field(None, description="Is app/API refactoring required?")
    app_refactoring_details: Optional[str] = Field(None, description="App refactoring details if required")
    maintenance_window: Optional[str] = Field(None, description="Preferred maintenance window")


class Environment(BaseModel):
    """Environment configuration with answers."""
    
    environment_name: str = Field(..., description="Name of the environment (e.g., dev, qa, prod)")
    answers: EnvironmentAnswers


class GlobalAnswers(BaseModel):
    """Global/common answers that apply to all environments."""
    
    source_api: SourceApiType = Field(..., description="CosmosDB API type")
    target_cloud: TargetCloud = Field(..., description="Target cloud environment")
    
    # Optional global fields
    programming_lang_driver_version: Optional[str] = Field(None, description="Programming language and driver version")
    vpn_vpc_required: Optional[bool] = Field(None, description="Is VPN/VPC setup required?")
    is_data_transformation_required: Optional[bool] = Field(None, description="Is data transformation required?")
    data_transformation_details: Optional[str] = Field(None, description="Data transformation details if required")


class EstimationRequest(BaseModel):
    """Request model for migration estimation."""
    
    migration_type: MigrationType = Field(..., description="Type of migration")
    questionnaire_version: str = Field("v1", description="Version of the questionnaire")
    number_of_environments: int = Field(..., description="Number of environments to migrate", ge=1)
    environments: list[Environment] = Field(..., description="List of environments with their answers")
    global_answers: GlobalAnswers = Field(..., description="Global answers applicable to all environments")
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "migration_type": "cosmosdb_to_mongodb",
                "questionnaire_version": "v1",
                "number_of_environments": 3,
                "environments": [
                    {
                        "environment_name": "dev",
                        "answers": {
                            "total_data_gb": 120,
                            "number_of_collections": 40,
                            "number_of_databases": 1,
                            "reverse_sync": False,
                            "hard_deletes": False
                        }
                    },
                    {
                        "environment_name": "qa",
                        "answers": {
                            "total_data_gb": 300,
                            "number_of_collections": 85,
                            "number_of_databases": 2,
                            "reverse_sync": True,
                            "hard_deletes": True
                        }
                    },
                    {
                        "environment_name": "prod",
                        "answers": {
                            "total_data_gb": 850,
                            "number_of_collections": 220,
                            "number_of_databases": 4,
                            "reverse_sync": True,
                            "hard_deletes": True
                        }
                    }
                ],
                "global_answers": {
                    "source_api": "mongo",
                    "target_cloud": "aws"
                }
            }
        }
    }


class EnvironmentEstimate(BaseModel):
    """Estimation result for a single environment."""
    
    environment_name: str
    data_tier: str = Field(..., description="Data size tier used for estimation")
    base_days: float = Field(..., description="Base days from the estimation matrix")
    collection_adjustment_days: float = Field(..., description="Additional days for collections beyond base")
    total_days: float = Field(..., description="Total estimated days for this environment")
    total_hours: float = Field(..., description="Total estimated hours for this environment")
    notes: list[str] = Field(default_factory=list, description="Notes about the estimation")


class ActivityBreakdown(BaseModel):
    """Breakdown of additional activities."""
    
    activity: str
    description: str
    effort_days: float
    effort_hours: float
    per: str = Field(..., description="Per customer, environment, or collection")


class EnvironmentActivityBreakdown(BaseModel):
    """Activity breakdown for a specific environment."""
    
    activity: str
    description: str


class PerEnvironmentEstimate(BaseModel):
    """Complete estimation for a single environment including activities."""
    
    environment_name: str
    
    # Migration effort from rules
    data_tier: str = Field(..., description="Data size tier used for estimation")
    base_days: float = Field(..., description="Base days from the estimation matrix")
    collection_adjustment_days: float = Field(..., description="Additional days for collections beyond base")
    migration_days: float = Field(..., description="Migration effort days (base + collection adjustment)")
    migration_hours: float = Field(..., description="Migration effort hours")
    
    # Per-environment activities
    activities: list[EnvironmentActivityBreakdown] = Field(
        default_factory=list, description="Activities specific to this environment"
    )
    
    # Environment totals
    total_days: float = Field(..., description="Total days for this environment (migration)")
    total_hours: float = Field(..., description="Total hours for this environment")
    
    # Variance for this environment
    total_days_low: float = Field(..., description="Lower bound estimate for this environment")
    total_days_high: float = Field(..., description="Upper bound estimate for this environment")
    
    notes: list[str] = Field(default_factory=list, description="Notes about the estimation")


class SharedActivityBreakdown(BaseModel):
    """Activities shared across all environments (one-time costs)."""
    
    activity: str
    description: str
    note: str = Field(..., description="Explanation of how this is allocated")


class EstimationResponse(BaseModel):
    """Response model for migration estimation."""
    
    migration_type: str
    questionnaire_version: str
    
    # Per-environment estimates (detailed)
    per_environment_estimates: list[PerEnvironmentEstimate]
    
    # Shared activities (one-time, not per environment)
    shared_activities: list[SharedActivityBreakdown] = Field(
        default_factory=list, description="One-time activities shared across all environments"
    )
    
    # Grand totals
    total_migration_days: float = Field(..., description="Total migration effort in days")
    total_migration_hours: float = Field(..., description="Total migration effort in hours")
    
    # Variance
    estimation_variance_percent: float = Field(..., description="Estimation variance percentage")
    total_days_low: float = Field(..., description="Lower bound estimate (days)")
    total_days_high: float = Field(..., description="Upper bound estimate (days)")
    
    # Assumptions applied
    assumptions: list[str] = Field(default_factory=list, description="Key assumptions applied")
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "migration_type": "cosmosdb_to_mongodb",
                "questionnaire_version": "v1",
                "per_environment_estimates": [
                    {
                        "environment_name": "dev",
                        "data_tier": "250GB",
                        "base_days": 6,
                        "collection_adjustment_days": 0,
                        "migration_days": 6,
                        "migration_hours": 48,
                        "activities": [
                            {
                                "activity": "Environment Validation",
                                "description": "Access validation"
                            }
                        ],
                        "total_days": 6,
                        "total_hours": 48,
                        "total_days_low": 4.8,
                        "total_days_high": 7.2,
                        "notes": ["Using tier 250GB for 120GB data"]
                    }
                ],
                "shared_activities": [
                    {
                        "activity": "Base Setup",
                        "description": "VM verification, cluster provisioning, tool installation",
                        "note": "One-time per customer"
                    }
                ],
                "total_migration_days": 25,
                "total_migration_hours": 200,
                "estimation_variance_percent": 20,
                "total_days_low": 20,
                "total_days_high": 30,
                "assumptions": [
                    "VM access, storage and tool installation handled before migration start"
                ]
            }
        }
    }
