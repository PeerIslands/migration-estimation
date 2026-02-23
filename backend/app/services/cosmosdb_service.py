"""
CosmosDB Service - Extract comprehensive metadata from Azure CosmosDB via MongoDB API.
"""

from typing import Dict, Any, List
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure


class CosmosDBService:
    """Service for extracting metadata from Azure CosmosDB using MongoDB API."""
    
    def __init__(self):
        self.client = None
        self.connection_string = None
    
    async def discover_databases(self, connection_string: str) -> List[Dict[str, Any]]:
        """
        Connect to CosmosDB (via MongoDB API) and discover all databases with basic info.
        
        Args:
            connection_string: MongoDB connection string for CosmosDB
            
        Returns:
            List of databases with basic metadata
        """
        try:
            # Connect using MongoDB connection string
            self.connection_string = connection_string
            self.client = MongoClient(connection_string, serverSelectionTimeoutMS=5000)
            
            # Test connection
            self.client.admin.command('ping')
            
            # List all databases
            db_names = self.client.list_database_names()
            
            # Filter out system databases
            system_dbs = ['admin', 'local', 'config']
            user_dbs = [db for db in db_names if db not in system_dbs]
            
            database_list = []
            for db_name in user_dbs:
                # Get quick stats for this database
                try:
                    db = self.client[db_name]
                    collections = db.list_collection_names()
                    num_collections = len(collections)
                    
                    # Try to get approximate size
                    total_size_gb = 0
                    total_docs = 0
                    
                    for coll_name in collections[:20]:  # Sample first 20 for speed
                        try:
                            collection = db[coll_name]
                            doc_count = collection.estimated_document_count()
                            total_docs += doc_count
                        except:
                            pass
                    
                    # Try to get database-level size
                    try:
                        db_stats = db.command("dbStats")
                        db_size_bytes = (
                            db_stats.get("dataSize", 0) or
                            db_stats.get("storageSize", 0) or
                            db_stats.get("totalSize", 0)
                        )
                        if db_size_bytes > 0:
                            total_size_gb = db_size_bytes / (1024 ** 3)
                    except:
                        pass
                    
                    database_list.append({
                        "name": db_name,
                        "num_containers": num_collections,
                        "estimated_documents": total_docs,
                        "estimated_size_gb": round(total_size_gb, 2) if total_size_gb > 0 else None,
                        "note": "Size from MongoDB API" if total_size_gb > 0 else "Size not available - check Azure Portal"
                    })
                    
                except Exception as e:
                    database_list.append({
                        "name": db_name,
                        "num_containers": 0,
                        "error": str(e)
                    })
            
            return database_list
            
        except ConnectionFailure as e:
            raise ValueError(f"Failed to connect to CosmosDB: {str(e)}")
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
            connection_string: MongoDB connection string for CosmosDB
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
            # Connect using MongoDB connection string
            self.connection_string = connection_string
            self.client = MongoClient(connection_string, serverSelectionTimeoutMS=5000)
            
            # Test connection
            self.client.admin.command('ping')
            
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
            
        except ConnectionFailure as e:
            raise ValueError(f"Failed to connect to CosmosDB: {str(e)}")
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
        has_sharded = False
        
        all_collections_info = []
        
        for db_name in database_names:
            try:
                db = self.client[db_name]
                
                # Get all collections in this database
                collection_names = db.list_collection_names()
                total_collections += len(collection_names)
                
                for coll_name in collection_names:
                    try:
                        collection = db[coll_name]
                        
                        # Get collection stats
                        try:
                            stats = db.command("collStats", coll_name)
                            
                            # Check if sharded (CosmosDB uses sharding similar to partitioning)
                            if stats.get("sharded", False):
                                has_sharded = True
                            
                            # Get document count
                            doc_count = collection.estimated_document_count()
                            total_docs += doc_count
                            
                            # Try multiple size fields (CosmosDB may use different ones)
                            size_bytes = (
                                stats.get("size", 0) or           # Uncompressed data size
                                stats.get("storageSize", 0) or    # On-disk storage size
                                stats.get("totalSize", 0) or      # Total size including indexes
                                stats.get("totalIndexSize", 0)    # Just indexes (better than nothing)
                            )
                            
                            if size_bytes > 0:
                                total_data_gb += size_bytes / (1024 ** 3)
                        
                        except OperationFailure:
                            # If collStats not supported, fall back to count
                            try:
                                doc_count = collection.estimated_document_count()
                                total_docs += doc_count
                            except:
                                pass
                        
                        # Get a sample document to check for nesting
                        if not has_nested_docs:
                            try:
                                sample = collection.find_one()
                                if sample:
                                    for key, value in sample.items():
                                        if key != '_id' and isinstance(value, (dict, list)):
                                            has_nested_docs = True
                                            break
                            except:
                                pass
                        
                        all_collections_info.append({
                            "database": db_name,
                            "name": coll_name,
                            "has_sharding": has_sharded,
                        })
                        
                    except Exception as e:
                        print(f"Error processing collection {coll_name}: {str(e)}")
                
                # Try to get database-level stats (may provide size info)
                db_size_from_stats = 0
                try:
                    db_stats = db.command("dbStats")
                    db_size_bytes = (
                        db_stats.get("dataSize", 0) or
                        db_stats.get("storageSize", 0) or
                        db_stats.get("totalSize", 0)
                    )
                    if db_size_bytes > 0:
                        db_size_from_stats = db_size_bytes
                        # Use db-level size if we didn't get collection-level sizes
                        db_size_gb = db_size_bytes / (1024 ** 3)
                        if db_size_gb > (total_data_gb / max(1, total_databases)):
                            # DB stats seem more accurate, add the difference
                            total_data_gb += db_size_gb
                except Exception as e:
                    print(f"Note: Could not get database-level stats for {db_name}: {str(e)}")
                
                # If stats returned 0 but we have documents, estimate size from sampling
                if db_size_from_stats == 0 and total_docs > 0:
                    print(f"⚠️  Stats returned 0 for {db_name}, attempting size estimation from document sampling...")
                    estimated_size = await self._estimate_size_from_sampling(db, collection_names[:5])  # Sample first 5 collections
                    if estimated_size > 0:
                        total_data_gb += estimated_size
                        print(f"✓ Estimated size from sampling: {estimated_size:.2f} GB")
                
            except Exception as e:
                print(f"Error processing database {db_name}: {str(e)}")
        
        # Note: Size data may not be fully accurate for CosmosDB
        # Recommend getting actual size from Azure Portal Metrics
        
        # Determine extraction method for note
        if total_data_gb > 0.01:  # More than 10MB
            size_note = "Size from MongoDB stats (may be estimated from sampling if stats returned 0)"
            print(f"✓ Total size extracted: {total_data_gb:.2f} GB")
        elif total_docs > 0:
            size_note = "CosmosDB returned 0 for size despite having documents. IMPORTANT: Get accurate size from Azure Portal → Metrics → Data Usage"
            print("⚠️  CosmosDB stats returned 0 GB despite having documents")
            print("   This is a known CosmosDB limitation via MongoDB API")
            print("   📊 ACTION REQUIRED: Get accurate size from Azure Portal → Metrics → Data Usage")
        else:
            size_note = "No data found or size not available - check Azure Portal Metrics"
            print("⚠️  No size or document data available")
        
        return {
            "total_data_gb": round(total_data_gb, 2) if total_data_gb > 0 else None,
            "number_of_collections": total_collections,
            "number_of_databases": total_databases,
            "reverse_sync": False,
            "hard_deletes": False,
            "api_version": None,  # Will be set from account info
            "num_accounts": None,
            "has_partitioned_collections": has_sharded,
            "ru_configuration": None,
            "read_write_tps": None,
            "num_consumer_apps": None,
            "performs_deletes": None,
            "change_stream_required": True if has_sharded else None,  # CosmosDB has change feed
            "app_refactoring_required": has_nested_docs,
            "app_refactoring_details": "Complex nested documents detected" if has_nested_docs else None,
            "maintenance_window": None,
            "size_extraction_note": size_note,
        }
    
    async def _estimate_size_from_sampling(self, db, collection_names: List[str]) -> float:
        """
        Estimate database size by sampling documents (fallback when stats return 0).
        
        Args:
            db: MongoDB database object
            collection_names: List of collection names to sample
            
        Returns:
            Estimated size in GB
        """
        import sys
        
        total_estimated_bytes = 0
        
        for coll_name in collection_names[:10]:  # Sample max 10 collections
            try:
                collection = db[coll_name]
                doc_count = collection.estimated_document_count()
                
                if doc_count == 0:
                    continue
                
                # Sample up to 100 documents to get average size
                sample_size = min(100, doc_count)
                samples = list(collection.find().limit(sample_size))
                
                if not samples:
                    continue
                
                # Calculate average document size (in bytes)
                # Using sys.getsizeof as rough estimate
                total_sample_size = sum(sys.getsizeof(str(doc)) for doc in samples)
                avg_doc_size = total_sample_size / len(samples)
                
                # Estimate total collection size
                estimated_coll_size = avg_doc_size * doc_count
                total_estimated_bytes += estimated_coll_size
                
            except Exception as e:
                print(f"   Could not sample {coll_name}: {str(e)}")
                continue
        
        return total_estimated_bytes / (1024 ** 3)  # Convert to GB
    
    async def _get_account_info(self) -> Dict[str, Any]:
        """Get account-level information."""
        try:
            # Get server info using MongoDB commands
            server_info = self.client.server_info()
            
            return {
                "api_version": f"MongoDB {server_info.get('version', 'Unknown')} (CosmosDB)",
                "is_cosmosdb": True,
                "wire_version": server_info.get("maxWireVersion"),
            }
        except:
            return {
                "api_version": "CosmosDB MongoDB API",
                "is_cosmosdb": True,
            }
