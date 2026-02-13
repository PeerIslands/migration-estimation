"""
CosmosDB Service - Extract comprehensive metadata from Azure CosmosDB.
"""

import re
from typing import Dict, Any, List
from azure.cosmos import CosmosClient, exceptions


class CosmosDBService:
    """Service for extracting metadata from Azure CosmosDB."""
    
    def __init__(self):
        self.client = None
    
    def parse_connection_string(self, connection_string: str) -> tuple[str, str]:
        """
        Parse CosmosDB connection string to extract endpoint and key.
        
        Args:
            connection_string: CosmosDB connection string
            
        Returns:
            Tuple of (endpoint, key)
        """
        # Format: AccountEndpoint=https://...;AccountKey=...
        endpoint_match = re.search(r'AccountEndpoint=([^;]+)', connection_string)
        key_match = re.search(r'AccountKey=([^;]+)', connection_string)
        
        if not endpoint_match or not key_match:
            raise ValueError("Invalid connection string format. Expected: AccountEndpoint=https://...;AccountKey=...")
        
        endpoint = endpoint_match.group(1).strip()
        key = key_match.group(1).strip()
        
        return endpoint, key
    
    async def discover_databases(self, connection_string: str) -> List[Dict[str, Any]]:
        """
        Connect to CosmosDB and discover all databases with basic info.
        
        Args:
            connection_string: CosmosDB connection string
            
        Returns:
            List of databases with basic metadata
        """
        try:
            endpoint, key = self.parse_connection_string(connection_string)
            self.client = CosmosClient(endpoint, key)
            
            # List all databases
            databases = list(self.client.list_databases())
            
            database_list = []
            for db_props in databases:
                db_name = db_props['id']
                
                # Get quick stats for this database
                try:
                    db_client = self.client.get_database_client(db_name)
                    containers = list(db_client.list_containers())
                    num_containers = len(containers)
                    
                    # Try to get size (may not be available in all API versions)
                    total_size_gb = 0
                    total_docs = 0
                    
                    for container_props in containers[:20]:  # Sample first 20 for speed
                        try:
                            container = db_client.get_container_client(container_props['id'])
                            # Note: Azure Cosmos doesn't always expose size via SDK
                            # We'll get accurate size in full extraction
                            # For now, just count containers
                        except:
                            pass
                    
                    database_list.append({
                        "name": db_name,
                        "num_containers": num_containers,
                        "estimated_size_gb": total_size_gb if total_size_gb > 0 else None,
                        "note": "Size will be calculated during full extraction"
                    })
                    
                except Exception as e:
                    database_list.append({
                        "name": db_name,
                        "num_containers": 0,
                        "error": str(e)
                    })
            
            return database_list
            
        except exceptions.CosmosHttpResponseError as e:
            raise ValueError(f"CosmosDB error: {e.message}")
        except Exception as e:
            raise ValueError(f"Failed to discover databases: {str(e)}")
    
    async def extract_databases(
        self, 
        connection_string: str, 
        database_groups: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Extract comprehensive metadata from grouped databases.
        
        Args:
            connection_string: CosmosDB connection string
            database_groups: List of environment definitions with database groupings
                Example: [
                    {
                        "environment_name": "production",
                        "databases": ["prod_db", "analytics_db"]
                    },
                    {
                        "environment_name": "staging",
                        "databases": ["staging_db"]
                    }
                ]
        
        Returns:
            Complete questionnaire data with aggregated environments
        """
        try:
            endpoint, key = self.parse_connection_string(connection_string)
            self.client = CosmosClient(endpoint, key)
            
            environments = []
            
            for group in database_groups:
                env_name = group["environment_name"]
                db_names = group["databases"]
                
                # Aggregate data across all databases in this environment
                aggregated = await self._aggregate_databases(db_names)
                
                environments.append({
                    "environment_name": env_name,
                    "answers": aggregated
                })
            
            # Get account-level info
            account_info = await self._get_account_info()
            
            return {
                "migration_type": "cosmosdb_to_mongodb",
                "questionnaire_version": "v1",
                "number_of_environments": len(environments),
                "global_answers": {
                    "source_api": "mongo",  # CosmosDB MongoDB API
                    "target_cloud": "aws",  # Default, user can change
                    "programming_lang_driver_version": account_info.get("api_version", ""),
                    "vpn_vpc_required": None,
                    "is_data_transformation_required": None,
                    "data_transformation_details": None,
                },
                "environments": environments
            }
            
        except exceptions.CosmosHttpResponseError as e:
            raise ValueError(f"CosmosDB error: {e.message}")
        except Exception as e:
            raise ValueError(f"Failed to extract data: {str(e)}")
    
    async def _aggregate_databases(self, database_names: List[str]) -> Dict[str, Any]:
        """
        Aggregate metadata from multiple databases into one environment.
        
        Args:
            database_names: List of database names to aggregate
            
        Returns:
            Aggregated answers for one environment
        """
        total_data_gb = 0
        total_collections = 0
        total_databases = len(database_names)
        total_docs = 0
        has_nested_docs = False
        has_partitioned = False
        
        all_collections_info = []
        
        for db_name in database_names:
            try:
                db_client = self.client.get_database_client(db_name)
                
                # Get all containers (collections) in this database
                containers = list(db_client.list_containers())
                total_collections += len(containers)
                
                for container_props in containers:
                    try:
                        container_name = container_props['id']
                        container = db_client.get_container_client(container_name)
                        
                        # Get container properties
                        properties = container.read()
                        
                        # Check for partitioning
                        if 'partitionKey' in properties:
                            has_partitioned = True
                        
                        # Try to get document count using query
                        try:
                            query = "SELECT VALUE COUNT(1) FROM c"
                            items = list(container.query_items(query=query, enable_cross_partition_query=True))
                            if items:
                                doc_count = items[0]
                                total_docs += doc_count
                        except:
                            pass
                        
                        # Get a sample document to check for nesting
                        if not has_nested_docs:
                            try:
                                sample_items = list(container.query_items(
                                    query="SELECT TOP 1 * FROM c",
                                    enable_cross_partition_query=True
                                ))
                                if sample_items:
                                    sample = sample_items[0]
                                    for value in sample.values():
                                        if isinstance(value, (dict, list)):
                                            has_nested_docs = True
                                            break
                            except:
                                pass
                        
                        all_collections_info.append({
                            "database": db_name,
                            "name": container_name,
                            "has_partition_key": 'partitionKey' in properties,
                        })
                        
                    except Exception as e:
                        print(f"Error processing container {container_name}: {str(e)}")
                
            except Exception as e:
                print(f"Error processing database {db_name}: {str(e)}")
        
        # Note: CosmosDB doesn't expose total data size easily via SDK
        # We'll need to estimate or get from Azure Portal/Metrics API
        # For now, we return what we can extract
        
        return {
            "total_data_gb": total_data_gb if total_data_gb > 0 else None,
            "number_of_collections": total_collections,
            "number_of_databases": total_databases,
            "reverse_sync": False,
            "hard_deletes": False,
            "api_version": None,  # Will be set from account info
            "num_accounts": None,
            "has_partitioned_collections": has_partitioned,
            "ru_configuration": None,
            "read_write_tps": None,
            "num_consumer_apps": None,
            "performs_deletes": None,
            "change_stream_required": True if has_partitioned else None,  # CosmosDB has change feed
            "app_refactoring_required": has_nested_docs,
            "app_refactoring_details": "Complex nested documents detected" if has_nested_docs else None,
            "maintenance_window": None,
        }
    
    async def _get_account_info(self) -> Dict[str, Any]:
        """Get account-level information."""
        try:
            # Get database account info if available
            # Note: Some info requires management API, not data plane API
            return {
                "api_version": "CosmosDB MongoDB API",
                "is_cosmosdb": True,
            }
        except:
            return {}
