#!/usr/bin/env python3
"""
CosmosDB Metadata Extraction Script (via MongoDB API)

This script connects to an Azure CosmosDB account using the MongoDB API and extracts
all relevant information needed for migration estimation.

Usage:
    python extract_cosmosdb_metadata.py <mongodb_connection_string>
    
Example:
    python extract_cosmosdb_metadata.py "mongodb://account:key@account.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000"
"""

import sys
import json
from datetime import datetime
from typing import Dict, Any, List
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure


class CosmosDBExtractor:
    """Extract comprehensive metadata from Azure CosmosDB (MongoDB API) for migration estimation."""
    
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.client = None
    
    def connect(self) -> bool:
        """Connect to CosmosDB and verify connection."""
        try:
            self.client = MongoClient(self.connection_string, serverSelectionTimeoutMS=5000)
            # Test connection
            self.client.admin.command('ping')
            print(f"✅ Connected to CosmosDB account (MongoDB API)")
            return True
        except ConnectionFailure as e:
            print(f"❌ Failed to connect: {str(e)}")
            return False
        except Exception as e:
            print(f"❌ Failed to connect: {str(e)}")
            return False
    
    def discover_all_databases(self) -> List[Dict[str, Any]]:
        """Discover all databases in the account."""
        print("\n📊 Discovering databases...\n")
        
        # Get all database names
        db_names = self.client.list_database_names()
        
        # Filter out system databases
        system_dbs = ['admin', 'local', 'config']
        user_dbs = [db for db in db_names if db not in system_dbs]
        
        databases = []
        for db_name in user_dbs:
            print(f"  → Found database: {db_name}")
            
            try:
                db = self.client[db_name]
                collections = db.list_collection_names()
                
                databases.append({
                    "name": db_name,
                    "num_containers": len(collections),
                    "containers": collections
                })
                print(f"    ✓ {len(collections)} collections")
                
            except Exception as e:
                print(f"    ⚠️  Error: {str(e)}")
                databases.append({
                    "name": db_name,
                    "num_containers": 0,
                    "error": str(e)
                })
        
        return databases
    
    def extract_database_metadata(self, db_name: str) -> Dict[str, Any]:
        """Extract detailed metadata for a single database."""
        print(f"\n  → Extracting metadata for: {db_name}")
        
        db = self.client[db_name]
        collections = db.list_collection_names()
        
        container_details = []
        total_docs = 0
        has_nested_docs = False
        has_sharded = False
        total_size_bytes = 0
        
        for coll_name in collections:
            try:
                collection = db[coll_name]
                
                # Get collection stats
                is_sharded = False
                doc_count = 0
                shard_key = None
                
                try:
                    stats = db.command("collStats", coll_name)
                    
                    # Check if sharded (CosmosDB uses sharding)
                    is_sharded = stats.get("sharded", False)
                    if is_sharded:
                        has_sharded = True
                        shard_key = stats.get("shardKey")
                    
                    # Get document count
                    doc_count = stats.get("count", 0)
                    total_docs += doc_count
                    
                    # Try multiple size fields (CosmosDB may use different ones)
                    size_bytes = (
                        stats.get("size", 0) or           # Uncompressed data size
                        stats.get("storageSize", 0) or    # On-disk storage size
                        stats.get("totalSize", 0) or      # Total size including indexes
                        stats.get("totalIndexSize", 0)    # Just indexes
                    )
                    total_size_bytes += size_bytes
                    
                except OperationFailure:
                    # If collStats not supported, fall back to count
                    try:
                        doc_count = collection.estimated_document_count()
                        total_docs += doc_count
                    except:
                        pass
                
                # Sample document for schema analysis
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
                
                container_details.append({
                    "name": coll_name,
                    "document_count": doc_count,
                    "has_sharding": is_sharded,
                    "shard_key": str(shard_key) if shard_key else None
                })
                
                print(f"    ✓ {coll_name}: {doc_count:,} documents")
                
            except Exception as e:
                print(f"    ⚠️  Error with {coll_name}: {str(e)}")
        
        # Try to get database-level stats as fallback
        if total_size_bytes == 0:
            try:
                db_stats = db.command("dbStats")
                db_size_bytes = (
                    db_stats.get("dataSize", 0) or
                    db_stats.get("storageSize", 0) or
                    db_stats.get("totalSize", 0)
                )
                if db_size_bytes > 0:
                    total_size_bytes = db_size_bytes
                    print(f"    ℹ️  Using database-level size: {db_size_bytes / (1024**3):.2f} GB")
            except Exception as e:
                print(f"    ⚠️  Could not get database-level stats: {str(e)}")
        
        return {
            "database_name": db_name,
            "num_containers": len(collections),
            "total_documents": total_docs,
            "total_size_gb": round(total_size_bytes / (1024 ** 3), 2) if total_size_bytes > 0 else 0,
            "has_nested_documents": has_nested_docs,
            "has_partitioned_collections": has_sharded,
            "containers": container_details
        }


def interactive_grouping(databases: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Interactive CLI for grouping databases into environments."""
    
    print("\n" + "=" * 70)
    print("🏗️  DEFINE ENVIRONMENTS")
    print("=" * 70)
    
    print(f"\nYou have {len(databases)} database(s) to migrate.")
    print("\nOptions:")
    print("  1. Each database = separate environment")
    print("  2. Group databases by environment (recommended)")
    
    choice = input("\nYour choice (1 or 2): ").strip()
    
    if choice == "1":
        # Each database is its own environment
        return [
            {"environment_name": db["name"], "databases": [db["name"]]}
            for db in databases
        ]
    
    # Manual grouping
    num_envs = int(input(f"\nHow many environments? (1-{len(databases)}): "))
    num_envs = max(1, min(num_envs, len(databases)))
    
    environment_groups = []
    
    for i in range(num_envs):
        print(f"\n--- Environment {i + 1} ---")
        env_name = input(f"Environment name (e.g., production, staging): ").strip()
        
        print("\nSelect databases for this environment:")
        for j, db in enumerate(databases):
            print(f"  {j + 1}. {db['name']} ({db['num_containers']} containers)")
        
        selections = input("Enter numbers separated by commas (e.g., 1,3,5): ").strip()
        selected_indices = [int(x.strip()) - 1 for x in selections.split(",") if x.strip()]
        
        selected_dbs = [databases[idx]["name"] for idx in selected_indices if 0 <= idx < len(databases)]
        
        environment_groups.append({
            "environment_name": env_name,
            "databases": selected_dbs
        })
    
    return environment_groups


def main():
    """Main execution function."""
    
    if len(sys.argv) < 2:
        print("Usage: python extract_cosmosdb_metadata.py <mongodb_connection_string>")
        print("\nExample:")
        print('  python extract_cosmosdb_metadata.py "mongodb://account:key@account.mongo.cosmos.azure.com:10255/..."')
        print("\nGet MongoDB connection string from:")
        print("  Azure Portal → Your CosmosDB Account → Connection String → PRIMARY CONNECTION STRING (MongoDB format)")
        sys.exit(1)
    
    connection_string = sys.argv[1]
    
    print("=" * 70)
    print("☁️  CosmosDB (MongoDB API) Metadata Extractor for Migration Estimation")
    print("=" * 70)
    
    extractor = CosmosDBExtractor(connection_string)
    
    if not extractor.connect():
        sys.exit(1)
    
    try:
        # Step 1: Discover all databases
        databases = extractor.discover_all_databases()
        
        if not databases:
            print("\n❌ No databases found in account")
            sys.exit(1)
        
        # Step 2: Interactive grouping
        environment_groups = interactive_grouping(databases)
        
        # Step 3: Extract detailed metadata
        print("\n" + "=" * 70)
        print("📊 EXTRACTING DETAILED METADATA")
        print("=" * 70)
        
        all_metadata = {}
        questionnaire_envs = []
        
        for group in environment_groups:
            env_name = group["environment_name"]
            db_names = group["databases"]
            
            print(f"\n📁 Environment: {env_name}")
            print(f"   Databases: {', '.join(db_names)}")
            
            # Aggregate metadata for this environment
            total_containers = 0
            total_docs = 0
            has_partitioned = False
            has_nested = False
            
            for db_name in db_names:
                metadata = extractor.extract_database_metadata(db_name)
                total_containers += metadata["num_containers"]
                total_docs += metadata["total_documents"]
                has_partitioned = has_partitioned or metadata["has_partitioned_collections"]
                has_nested = has_nested or metadata["has_nested_documents"]
                
                all_metadata[db_name] = metadata
            
            questionnaire_envs.append({
                "environment_name": env_name,
                "answers": {
                    "total_data_gb": None,  # Must get from Azure Portal
                    "number_of_collections": total_containers,
                    "number_of_databases": len(db_names),
                    "reverse_sync": False,
                    "hard_deletes": False,
                    "has_partitioned_collections": has_partitioned,
                    "change_stream_required": True,  # CosmosDB has change feed
                    "app_refactoring_required": has_nested,
                }
            })
            
            print(f"   ✓ Total containers: {total_containers}")
            print(f"   ✓ Total documents: {total_docs:,}")
            print(f"   ✓ Has partitioned collections: {has_partitioned}")
        
        # Build questionnaire
        questionnaire = {
            "migration_type": "cosmosdb_to_mongodb",
            "questionnaire_version": "v1",
            "number_of_environments": len(questionnaire_envs),
            "global_answers": {
                "source_api": "mongo",
                "target_cloud": "aws",
            },
            "environments": questionnaire_envs
        }
        
        # Save results
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = f"cosmosdb_extraction_{timestamp}.json"
        
        output_data = {
            "extraction_timestamp": datetime.utcnow().isoformat(),
            "databases": all_metadata,
            "environment_groups": environment_groups,
            "questionnaire": questionnaire
        }
        
        with open(output_file, 'w') as f:
            json.dump(output_data, f, indent=2)
        
        # Print summary
        print("\n" + "=" * 70)
        print("✅ EXTRACTION COMPLETE")
        print("=" * 70)
        print(f"\nExtracted {len(environment_groups)} environment(s)")
        print(f"Saved to: {output_file}")
        
        print("\n📝 Questionnaire Summary:")
        print(json.dumps(questionnaire, indent=2))
        
        print("\n⚠️  NOTE: Data size may not be fully accurate via MongoDB API.")
        print("   For precise size: Azure Portal → Metrics → Data Usage")
        
    except KeyboardInterrupt:
        print("\n\n❌ Cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
