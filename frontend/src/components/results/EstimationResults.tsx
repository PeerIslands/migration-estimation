"use client";

import React from "react";
import type { MigrationEstimateResponse } from "@/components/utils/types";
import { useAuthStore } from "@/store/authStore";
import styles from "./EstimationResults.module.css";

type EstimationResultsProps = {
  estimation: MigrationEstimateResponse;
  onReset: () => void;
};

export default function EstimationResults({
  estimation,
  onReset,
}: EstimationResultsProps) {
  const { isAuthenticated } = useAuthStore();
  const {
    per_environment_estimates,
    shared_activities,
    total_migration_days,
    total_migration_hours,
    total_days_low,
    total_days_high,
    estimation_variance_percent,
    assumptions,
  } = estimation;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Migration Estimation Results</h1>
        <p className={styles.subtitle}>
          Based on your questionnaire responses
        </p>
        {isAuthenticated && (
          <div className={styles.savedIndicator}>
            ✓ Saved to your account
          </div>
        )}
      </div>

      {/* Summary Card */}
      <div className={styles.summaryCard}>
        <h2 className={styles.summaryTitle}>Total Estimation</h2>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Total Days</span>
            <span className={styles.summaryValue}>
              {total_migration_days.toFixed(1)}
            </span>
            <span className={styles.summarySubtext}>
              ({total_migration_hours.toFixed(0)} hours)
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Range</span>
            <span className={styles.summaryValue}>
              {total_days_low.toFixed(1)} - {total_days_high.toFixed(1)}
            </span>
            <span className={styles.summarySubtext}>
              (±{estimation_variance_percent}% variance)
            </span>
          </div>
        </div>
      </div>

      {/* Per-Environment Estimates */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Per-Environment Breakdown</h2>
        {per_environment_estimates.map((env, idx) => (
          <div key={idx} className={styles.envCard}>
            <h3 className={styles.envTitle}>{env.environment_name}</h3>
            <div className={styles.envSummary}>
              <div className={styles.envStat}>
                <span className={styles.statLabel}>Total Effort</span>
                <span className={styles.statValue}>
                  {env.total_days.toFixed(1)} days
                </span>
                <span className={styles.statSubtext}>
                  ({env.total_hours.toFixed(0)} hours)
                </span>
              </div>
              <div className={styles.envStat}>
                <span className={styles.statLabel}>Data Tier</span>
                <span className={styles.statValue}>{env.data_tier}</span>
              </div>
              <div className={styles.envStat}>
                <span className={styles.statLabel}>Migration Days</span>
                <span className={styles.statValue}>
                  {env.migration_days.toFixed(1)}
                </span>
              </div>
              <div className={styles.envStat}>
                <span className={styles.statLabel}>Activities Days</span>
                <span className={styles.statValue}>
                  {env.activities_days?.toFixed(1) ?? '0.0'}
                </span>
              </div>
            </div>

            {/* Activities for this environment */}
            {env.activities && env.activities.length > 0 && (
              <div className={styles.activitiesSection}>
                <h4 className={styles.activitiesTitle}>Activities</h4>
                <div className={styles.activitiesList}>
                  {env.activities.map((activity, actIdx) => (
                    <div key={actIdx} className={styles.activityItem}>
                      <div className={styles.activityHeader}>
                        <span className={styles.activityName}>
                          {activity.activity}
                        </span>
                        {activity.effort_days !== undefined && (
                          <span className={styles.activityEffort}>
                            {activity.effort_days.toFixed(1)} days
                          </span>
                        )}
                      </div>
                      {activity.description && (
                        <p className={styles.activityDescription}>
                          {activity.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes for this environment */}
            {env.notes && env.notes.length > 0 && (
              <div className={styles.notesSection}>
                <h4 className={styles.notesTitle}>Notes</h4>
                <ul className={styles.notesList}>
                  {env.notes.map((note, noteIdx) => (
                    <li key={noteIdx} className={styles.noteItem}>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Shared Activities */}
      {shared_activities && shared_activities.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Shared Activities (One-Time Costs)
          </h2>
          <div className={styles.sharedCard}>
            {(estimation.shared_activities_days !== undefined || 
              estimation.shared_activities_hours !== undefined) && (
              <div className={styles.sharedSummary}>
                <span className={styles.sharedLabel}>Total Shared Effort</span>
                <span className={styles.sharedValue}>
                  {estimation.shared_activities_days?.toFixed(1) ?? '0.0'} days
                </span>
                <span className={styles.sharedSubtext}>
                  ({estimation.shared_activities_hours?.toFixed(0) ?? '0'} hours)
                </span>
              </div>
            )}
            <div className={styles.activitiesList}>
              {shared_activities.map((activity, idx) => (
                <div key={idx} className={styles.activityItem}>
                  <div className={styles.activityHeader}>
                    <span className={styles.activityName}>
                      {activity.activity}
                    </span>
                    {activity.effort_days !== undefined && (
                      <span className={styles.activityEffort}>
                        {activity.effort_days.toFixed(1)} days
                      </span>
                    )}
                  </div>
                  {activity.description && (
                    <p className={styles.activityDescription}>
                      {activity.description}
                    </p>
                  )}
                  {activity.note && (
                    <p className={styles.activityNote}>{activity.note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Assumptions */}
      {assumptions && assumptions.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Assumptions</h2>
          <div className={styles.assumptionsCard}>
            <ul className={styles.assumptionsList}>
              {assumptions.map((assumption, idx) => (
                <li key={idx} className={styles.assumptionItem}>
                  {assumption}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.resetButton}
          onClick={onReset}
        >
          Create New Estimation
        </button>
      </div>
    </div>
  );
}
