#!/usr/bin/env python3
"""
CosmosDB Metadata Extraction Script

This script connects to an Azure CosmosDB account and extracts all relevant
information needed for migration estimation.

Usage:
    python extract_cosmosdb_metadata.py <connection_string>
    
Example:
    python extract_cosmosdb_metadata.py "AccountEndpoint=https://myaccount.documents.azure.com:443/;AccountKey=..."
"""

import sys
import json
import re
from datetime import datetime
from typing import Dict, Any, List
from azure.cosmos import CosmosClient, exceptions


class CosmosDBExtractor:
    """Extract comprehensive metadata from Azure CosmosDB for migration estimation."""
    
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.endpoint, self.key = self._parse_connection_string(connection_string)
        self.client = None
    
    def _parse_connection_string(self, connection_string: str) -> tuple[str, str]:
        """Parse CosmosDB connection string."""
        endpoint_match = re.search(r'AccountEndpoint=([^;]+)', connection_string)
        key_match = re.search(r'AccountKey=([^;]+)', connection_string)
        
        if not endpoint_match or not key_match:
            raise ValueError("Invalid connection string format")
        
        return endpoint_match.group(1).strip(), key_match.group(1).strip()
    
    def connect(self) -> bool:
        """Connect to CosmosDB and verify connection."""
        try:
            self.client = CosmosClient(self.endpoint, self.key)
            # Test connection by listing databases
            list(self.client.list_databases())
            print(f"✅ Connected to CosmosDB account")
            return True
        except Exception as e:
            print(f"❌ Failed to connect: {str(e)}")
            return False
    
    def discover_all_databases(self) -> List[Dict[str, Any]]:
        """Discover all databases in the account."""
        print("\n📊 Discovering databases...\n")
        
        databases = []
        for db_props in self.client.list_databases():
            db_name = db_props['id']
            print(f"  → Found database: {db_name}")
            
            try:
                db_client = self.client.get_database_client(db_name)
                containers = list(db_client.list_containers())
                
                databases.append({
                    "name": db_name,
                    "num_containers": len(containers),
                    "containers": [c['id'] for c in containers]
                })
                print(f"    ✓ {len(containers)} containers")
                
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
        
        db_client = self.client.get_database_client(db_name)
        containers = list(db_client.list_containers())
        
        container_details = []
        total_docs = 0
        has_nested_docs = False
        has_partitioned = False
        
        for container_props in containers:
            container_name = container_props['id']
            
            try:
                container = db_client.get_container_client(container_name)
                properties = container.read()
                
                # Check for partition key
                has_partition = 'partitionKey' in properties
                if has_partition:
                    has_partitioned = True
                
                # Try to count documents
                try:
                    query_result = list(container.query_items(
                        query="SELECT VALUE COUNT(1) FROM c",
                        enable_cross_partition_query=True
                    ))
                    doc_count = query_result[0] if query_result else 0
                    total_docs += doc_count
                except:
                    doc_count = 0
                
                # Sample document for schema analysis
                if not has_nested_docs:
                    try:
                        samples = list(container.query_items(
                            query="SELECT TOP 1 * FROM c",
                            enable_cross_partition_query=True
                        ))
                        if samples:
                            for value in samples[0].values():
                                if isinstance(value, (dict, list)):
                                    has_nested_docs = True
                                    break
                    except:
                        pass
                
                container_details.append({
                    "name": container_name,
                    "document_count": doc_count,
                    "has_partition_key": has_partition,
                    "partition_key": properties.get('partitionKey', {}).get('paths', [])[0] if 'partitionKey' in properties else None
                })
                
                print(f"    ✓ {container_name}: {doc_count} documents")
                
            except Exception as e:
                print(f"    ⚠️  Error with {container_name}: {str(e)}")
        
        return {
            "database_name": db_name,
            "num_containers": len(containers),
            "total_documents": total_docs,
            "has_nested_documents": has_nested_docs,
            "has_partitioned_collections": has_partitioned,
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
        print("Usage: python extract_cosmosdb_metadata.py <connection_string>")
        print("\nExample:")
        print('  python extract_cosmosdb_metadata.py "AccountEndpoint=https://...;AccountKey=..."')
        print("\nGet connection string from:")
        print("  Azure Portal → Your CosmosDB Account → Keys → PRIMARY CONNECTION STRING")
        sys.exit(1)
    
    connection_string = sys.argv[1]
    
    print("=" * 70)
    print("☁️  CosmosDB Metadata Extractor for Migration Estimation")
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
        
        print("\n⚠️  NOTE: CosmosDB does not expose total data size via SDK.")
        print("   Get data size from: Azure Portal → Metrics → Data Usage")
        
    except KeyboardInterrupt:
        print("\n\n❌ Cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
