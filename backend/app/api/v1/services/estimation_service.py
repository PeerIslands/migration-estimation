"""
Estimation calculator service that loads migration rules and calculates estimates.
"""

import math
from pathlib import Path
from typing import Any

import yaml

from app.api.v1.schemas.estimation import (
    EstimationRequest,
    EstimationResponse,
    PerEnvironmentEstimate,
    EnvironmentActivityBreakdown,
    SharedActivityBreakdown,
    Environment,
)


class EstimationCalculator:
    """Calculator for migration estimation based on YAML rules."""
    
    def __init__(self, migration_type: str):
        self.migration_type = migration_type
        self.rules: dict[str, Any] = {}
        self.weights: dict[str, Any] = {}
        self.assumptions: dict[str, Any] = {}
        self._load_rules()
    
    def _get_rules_path(self) -> Path:
        """Get the path to the rules folder for the migration type."""
        # Navigate from api/v1/services to app/migration
        base_path = Path(__file__).parent.parent.parent.parent / "migration" / self.migration_type
        return base_path
    
    def _load_rules(self) -> None:
        """Load all YAML configuration files for the migration type."""
        rules_path = self._get_rules_path()
        
        if not rules_path.exists():
            raise ValueError(f"Migration type '{self.migration_type}' not found")
        
        # Load rules.yaml
        rules_file = rules_path / "rules.yaml"
        if rules_file.exists():
            with open(rules_file, "r") as f:
                self.rules = yaml.safe_load(f)
        
        # Load weights.yaml
        weights_file = rules_path / "weights.yaml"
        if weights_file.exists():
            with open(weights_file, "r") as f:
                self.weights = yaml.safe_load(f)
        
        # Load assumptions.yaml
        assumptions_file = rules_path / "assumptions.yaml"
        if assumptions_file.exists():
            with open(assumptions_file, "r") as f:
                self.assumptions = yaml.safe_load(f)
    
    def _find_data_tier(self, data_gb: float) -> dict[str, Any]:
        """Find the appropriate data tier for the given data size."""
        estimation_matrix = self.rules.get("estimation_matrix", [])
        
        for tier in estimation_matrix:
            range_gb = tier.get("range_gb", [0, None])
            lower_bound = range_gb[0]
            upper_bound = range_gb[1]
            
            if upper_bound is None:
                # Last tier with no upper limit
                if data_gb >= lower_bound:
                    return tier
            elif lower_bound <= data_gb <= upper_bound:
                return tier
        
        # Default to first tier if nothing matches
        return estimation_matrix[0] if estimation_matrix else {}
    
    def _get_base_days_and_increment(
        self, tier: dict[str, Any], hard_delete: bool, reverse_sync: bool
    ) -> tuple[float, float]:
        """Get base days and increment from the tier based on flags."""
        hard_delete_config = tier.get("hard_delete", {})
        hard_delete_section = hard_delete_config.get(hard_delete, hard_delete_config.get(False, {}))
        
        reverse_sync_config = hard_delete_section.get("reverse_sync", {})
        sync_section = reverse_sync_config.get(reverse_sync, reverse_sync_config.get(False, {}))
        
        base_days = sync_section.get("base_days", 0)
        increment_per_50 = sync_section.get("increment_per_50_collections", 0)
        
        return base_days, increment_per_50
    
    def _calculate_collection_adjustment(
        self, num_collections: int, increment_per_50: float
    ) -> float:
        """Calculate additional days for collections beyond the base."""
        collection_config = self.weights.get("collection_config", {})
        base_collections = collection_config.get("base_collections", 50)
        increment_step = collection_config.get("increment_step", 50)
        
        if num_collections <= base_collections:
            return 0.0
        
        # Ceiling calculation: round up to next step
        extra_collections = num_collections - base_collections
        steps = math.ceil(extra_collections / increment_step)
        
        return steps * increment_per_50
    
    def _calculate_per_environment_activities(
        self, env: Environment
    ) -> list[EnvironmentActivityBreakdown]:
        """Determine activities specific to a single environment."""
        activities: list[EnvironmentActivityBreakdown] = []
        activity_config = self.assumptions.get("activities", {})
        
        # Environment validation (per environment)
        env_validation = activity_config.get("environment_validation", {})
        if env_validation:
            activities.append(
                EnvironmentActivityBreakdown(
                    activity="Environment Validation",
                    description=env_validation.get("description", "Access validation"),
                )
            )
        
        # Discovery for this environment (based on its data size)
        discovery = activity_config.get("discovery", {})
        if discovery:
            activities.append(
                EnvironmentActivityBreakdown(
                    activity="Discovery & Analysis",
                    description=f"Analyze {env.answers.total_data_gb}GB data, {env.answers.number_of_collections} collections",
                )
            )
        
        # Index preparation for this environment
        index_prep = activity_config.get("index_preparation", {})
        if index_prep:
            activities.append(
                EnvironmentActivityBreakdown(
                    activity="Index Preparation",
                    description=f"Prepare index scripts for {env.answers.number_of_collections} collections",
                )
            )
        
        # Reverse sync for this environment (if enabled)
        reverse_sync_config = activity_config.get("reverse_sync", {})
        if reverse_sync_config and env.answers.reverse_sync:
            activities.append(
                EnvironmentActivityBreakdown(
                    activity="Reverse Sync Setup",
                    description=reverse_sync_config.get("description", "Reverse sync configuration"),
                )
            )
        
        # Hard delete for this environment (if enabled)
        hard_delete_config = activity_config.get("hard_delete", {})
        if hard_delete_config and env.answers.hard_deletes:
            activities.append(
                EnvironmentActivityBreakdown(
                    activity="Hard Delete Testing",
                    description=hard_delete_config.get("description", "Hard delete configuration"),
                )
            )
        
        return activities
    
    def _calculate_per_environment_estimate(
        self, env: Environment, variance_percent: float
    ) -> PerEnvironmentEstimate:
        """Calculate complete estimation for a single environment."""
        answers = env.answers
        hours_per_day = self.weights.get("conversions", {}).get("hours_per_day", 8)
        notes: list[str] = []
        
        # Find the appropriate data tier
        tier = self._find_data_tier(answers.total_data_gb)
        tier_name = tier.get("tier", "Unknown")
        notes.append(f"Using tier {tier_name} for {answers.total_data_gb}GB data")
        
        # Get base days and increment
        base_days, increment_per_50 = self._get_base_days_and_increment(
            tier, answers.hard_deletes, answers.reverse_sync
        )
        
        # Calculate collection adjustment
        collection_adjustment = self._calculate_collection_adjustment(
            answers.number_of_collections, increment_per_50
        )
        
        if collection_adjustment > 0:
            notes.append(
                f"Added {collection_adjustment} days for {answers.number_of_collections} collections "
                f"(base: 50, increment: {increment_per_50} per 50)"
            )
        
        # Add notes for flags
        if answers.hard_deletes:
            notes.append("Hard deletes enabled - additional effort included")
        if answers.reverse_sync:
            notes.append("Reverse sync enabled - additional effort included")
        
        migration_days = base_days + collection_adjustment
        migration_hours = migration_days * hours_per_day
        
        # Determine per-environment activities (no effort calculation)
        activities = self._calculate_per_environment_activities(env)
        
        # Environment totals (based on migration only)
        total_days = migration_days
        total_hours = total_days * hours_per_day
        
        # Calculate variance for this environment
        variance_factor = variance_percent / 100
        total_days_low = total_days * (1 - variance_factor)
        total_days_high = total_days * (1 + variance_factor)
        
        return PerEnvironmentEstimate(
            environment_name=env.environment_name,
            data_tier=tier_name,
            base_days=base_days,
            collection_adjustment_days=collection_adjustment,
            migration_days=round(migration_days, 2),
            migration_hours=round(migration_hours, 2),
            activities=activities,
            total_days=round(total_days, 2),
            total_hours=round(total_hours, 2),
            total_days_low=round(total_days_low, 2),
            total_days_high=round(total_days_high, 2),
            notes=notes,
        )
    
    def _calculate_shared_activities(
        self,
    ) -> list[SharedActivityBreakdown]:
        """Determine activities shared across all environments (one-time costs)."""
        activities: list[SharedActivityBreakdown] = []
        activity_config = self.assumptions.get("activities", {})
        
        # Base setup (per customer - one time)
        base_setup = activity_config.get("base_setup", {})
        if base_setup:
            activities.append(
                SharedActivityBreakdown(
                    activity="Base Setup",
                    description=base_setup.get("description", "Initial setup"),
                    note="One-time per customer, not per environment",
                )
            )
        
        return activities
    
    def _get_key_assumptions(self) -> list[str]:
        """Get key assumptions to include in the response."""
        assumptions_list = self.assumptions.get("assumptions", [])
        return [a.get("description", "") for a in assumptions_list[:5]]  # Top 5
    
    def calculate(self, request: EstimationRequest) -> EstimationResponse:
        """Calculate the full migration estimation."""
        hours_per_day = self.weights.get("conversions", {}).get("hours_per_day", 8)
        variance_percent = self.weights.get("estimation_variance_percent", 20)
        
        # Calculate per-environment estimates (including per-env activities)
        per_environment_estimates = [
            self._calculate_per_environment_estimate(env, variance_percent)
            for env in request.environments
        ]
        
        # Determine shared activities (one-time costs, no effort calculation)
        shared_activities = self._calculate_shared_activities()
        
        # Calculate grand totals (based on migration only)
        total_days = sum(e.total_days for e in per_environment_estimates)
        total_hours = total_days * hours_per_day
        
        # Calculate variance bounds
        variance_factor = variance_percent / 100
        total_days_low = total_days * (1 - variance_factor)
        total_days_high = total_days * (1 + variance_factor)
        
        return EstimationResponse(
            migration_type=request.migration_type.value,
            questionnaire_version=request.questionnaire_version,
            per_environment_estimates=per_environment_estimates,
            shared_activities=shared_activities,
            total_migration_days=round(total_days, 2),
            total_migration_hours=round(total_hours, 2),
            estimation_variance_percent=variance_percent,
            total_days_low=round(total_days_low, 2),
            total_days_high=round(total_days_high, 2),
            assumptions=self._get_key_assumptions(),
        )


def calculate_estimation(
    request: EstimationRequest,
) -> EstimationResponse:
    """Main function to calculate migration estimation."""
    calculator = EstimationCalculator(request.migration_type.value)
    return calculator.calculate(request)
