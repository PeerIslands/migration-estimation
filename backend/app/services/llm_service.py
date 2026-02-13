"""
LLM Service - Process extracted text with Azure OpenAI to generate questionnaire data.
"""

import json
from typing import Dict, Any
from openai import AzureOpenAI
from app.core.config import get_settings

settings = get_settings()


class LLMService:
    """Service for processing text with Azure OpenAI LLM."""
    
    def __init__(self):
        if not settings.AZURE_OPENAI_API_KEY or not settings.AZURE_OPENAI_ENDPOINT:
            raise ValueError("Azure OpenAI credentials not configured. Please set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT in .env file.")
        
        self.client = AzureOpenAI(
            api_key=settings.AZURE_OPENAI_API_KEY,
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            api_version=settings.AZURE_OPENAI_API_VERSION,
        )
        self.model = settings.AZURE_OPENAI_DEPLOYMENT_NAME
    
    async def extract_questionnaire_data(self, text: str) -> Dict[str, Any]:
        """
        Process extracted text and generate structured questionnaire data.
        
        Args:
            text: Extracted text from the document
            
        Returns:
            Dictionary with questionnaire fields
        """
        
        prompt = self._build_extraction_prompt(text)
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at analyzing migration documentation and extracting structured technical information. Always respond with valid JSON."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.2,  # Low temperature for consistent extraction
                response_format={"type": "json_object"}
            )
            
            result_text = response.choices[0].message.content
            result = json.loads(result_text)
            
            return self._normalize_result(result)
            
        except Exception as e:
            raise ValueError(f"Error processing with Azure OpenAI: {str(e)}")
    
    def _build_extraction_prompt(self, text: str) -> str:
        """Build the prompt for extracting questionnaire data from a document."""
        return f"""
Analyze this document and extract migration questionnaire information for a CosmosDB to MongoDB migration.

IMPORTANT INSTRUCTIONS:
- Extract all relevant technical information from the document
- If field names are not explicitly labeled, INFER them from context
- Look for patterns like: environment names, data sizes, collection counts, database counts
- Make reasonable assumptions based on common migration patterns
- If information is not found, use sensible defaults

Extract these fields:

**Migration Type & Scope:**
- migration_type: Always "cosmosdb_to_mongodb"
- number_of_environments: Number of environments mentioned (dev, qa, staging, prod, etc.) - default to 1 if not specified
- source_api: Type of CosmosDB API being used (mongo, sql, or nosql) - default to "mongo"
- target_cloud: Target cloud provider (aws, azure, or google) - default to "aws"

**Environment Details:**
For each environment detected (dev, qa, prod, etc.), extract:
- environment_name: Name of the environment (e.g., "dev", "qa", "production")
- total_data_gb: Total size of data in GB (REQUIRED - if not found, estimate based on context or default to 100)
- number_of_collections: Number of collections/tables to migrate (REQUIRED - if not found, default to 10)
- number_of_databases: Number of databases to migrate (REQUIRED - if not found, default to 1)
- reverse_sync: Is reverse synchronization required? (boolean, default: false)
- hard_deletes: Should deletes be captured? (boolean, default: false)

Optional environment fields (leave empty string "" if not found):
- api_version: API Version (e.g., "3.6", "4.0", "5.0")
- num_accounts: Number of accounts
- has_partitioned_collections: boolean or null
- ru_configuration: "single" or "shared" or ""
- read_write_tps: Read & Write transactions per second (string)
- num_consumer_apps: Number of consumer applications (integer or null)
- performs_deletes: Does application perform delete transactions? (boolean or null)
- change_stream_required: Is change stream required? (boolean or null)
- app_refactoring_required: Is app/API refactoring required? (boolean or null)
- app_refactoring_details: Details about refactoring (string)
- maintenance_window: Preferred maintenance window (string)

**Global Configuration (applies to all environments):**
- programming_lang_driver_version: Programming language and driver version (e.g., "Python 3.9 with pymongo 4.0")
- vpn_vpc_required: Is VPN/VPC setup required? (boolean or null)
- is_data_transformation_required: Is data transformation needed? (boolean or null)
- data_transformation_details: Details about transformation (string)

RETURN FORMAT - MUST be valid JSON:
{{
  "migration_type": "cosmosdb_to_mongodb",
  "number_of_environments": 1,
  "source_api": "mongo",
  "target_cloud": "aws",
  "programming_lang_driver_version": "",
  "vpn_vpc_required": null,
  "is_data_transformation_required": null,
  "data_transformation_details": "",
  "environments": [
    {{
      "environment_name": "production",
      "total_data_gb": 100,
      "number_of_collections": 10,
      "number_of_databases": 1,
      "reverse_sync": false,
      "hard_deletes": false,
      "api_version": "",
      "num_accounts": null,
      "has_partitioned_collections": null,
      "ru_configuration": "",
      "read_write_tps": "",
      "num_consumer_apps": null,
      "performs_deletes": null,
      "change_stream_required": null,
      "app_refactoring_required": null,
      "app_refactoring_details": "",
      "maintenance_window": ""
    }}
  ]
}}

Document text to analyze:
{text}

Remember: Return ONLY valid JSON. No additional text or explanations. Fill in ALL required fields with sensible defaults if not found in the document.
"""
    
    def _normalize_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize and validate the questionnaire result."""
        
        # Ensure required fields
        normalized = {
            "migration_type": result.get("migration_type", "cosmosdb_to_mongodb"),
            "questionnaire_version": "v1",
            "number_of_environments": result.get("number_of_environments", 1),
            "global_answers": {
                "source_api": result.get("source_api", "mongo"),
                "target_cloud": result.get("target_cloud", "aws"),
                "programming_lang_driver_version": result.get("programming_lang_driver_version", ""),
                "vpn_vpc_required": result.get("vpn_vpc_required"),
                "is_data_transformation_required": result.get("is_data_transformation_required"),
                "data_transformation_details": result.get("data_transformation_details", "")
            },
            "environments": []
        }
        
        # Process environments
        environments = result.get("environments", [])
        if not environments:
            # Create default environment if none found
            environments = [{
                "environment_name": "production",
                "total_data_gb": 100,
                "number_of_collections": 10,
                "number_of_databases": 1,
                "reverse_sync": False,
                "hard_deletes": False
            }]
        
        for env in environments:
            normalized_env = {
                "environment_name": env.get("environment_name", "production"),
                "answers": {
                    "total_data_gb": float(env.get("total_data_gb", 100)),
                    "number_of_collections": int(env.get("number_of_collections", 10)),
                    "number_of_databases": int(env.get("number_of_databases", 1)),
                    "reverse_sync": bool(env.get("reverse_sync", False)),
                    "hard_deletes": bool(env.get("hard_deletes", False)),
                    "api_version": env.get("api_version") or None,
                    "num_accounts": env.get("num_accounts"),
                    "has_partitioned_collections": env.get("has_partitioned_collections"),
                    "ru_configuration": env.get("ru_configuration") or None,
                    "read_write_tps": env.get("read_write_tps") or None,
                    "num_consumer_apps": env.get("num_consumer_apps"),
                    "performs_deletes": env.get("performs_deletes"),
                    "change_stream_required": env.get("change_stream_required"),
                    "app_refactoring_required": env.get("app_refactoring_required"),
                    "app_refactoring_details": env.get("app_refactoring_details") or None,
                    "maintenance_window": env.get("maintenance_window") or None
                }
            }
            normalized["environments"].append(normalized_env)
        
        # Update number of environments based on actual count
        normalized["number_of_environments"] = len(normalized["environments"])
        
        return normalized
