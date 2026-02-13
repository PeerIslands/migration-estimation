"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { getSavedEstimations } from "@/lib/api";
import styles from "./MyEstimations.module.css";

type SavedEstimationSummary = {
  _id: string;
  name?: string;
  migration_type: string;
  number_of_environments: number;
  total_migration_days: number;
  created_at: string;
};

export default function MyEstimations() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [estimations, setEstimations] = useState<SavedEstimationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  // Load estimations
  useEffect(() => {
    if (isAuthenticated) {
      loadEstimations();
    }
  }, [isAuthenticated]);

  const loadEstimations = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getSavedEstimations();
      setEstimations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load estimations");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Estimations</h1>
          <p className={styles.subtitle}>
            View and manage your saved migration estimations
          </p>
        </div>
        <button onClick={() => router.push("/")} className={styles.backButton}>
          ← Back to Home
        </button>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Loading your estimations...</p>
          </div>
        ) : error ? (
          <div className={styles.error}>
            <p>❌ {error}</p>
            <button onClick={loadEstimations} className={styles.retryButton}>
              Try Again
            </button>
          </div>
        ) : estimations.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📊</div>
            <h2 className={styles.emptyTitle}>No Estimations Yet</h2>
            <p className={styles.emptyText}>
              You haven't created any estimations yet. Fill out the questionnaire
              to create your first estimation!
            </p>
            <button
              onClick={() => router.push("/")}
              className={styles.createButton}
            >
              Create Estimation
            </button>
          </div>
        ) : (
          <>
            <div className={styles.stats}>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{estimations.length}</span>
                <span className={styles.statLabel}>Total Estimations</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>
                  {Math.round(
                    estimations.reduce((sum, est) => sum + est.total_migration_days, 0)
                  )}
                </span>
                <span className={styles.statLabel}>Total Days Estimated</span>
              </div>
            </div>

            <div className={styles.list}>
              {estimations.map((estimation) => (
                <div key={estimation._id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitle}>
                      {estimation.name || "Unnamed Estimation"}
                    </div>
                    <div className={styles.cardDate}>
                      {formatDate(estimation.created_at)}
                    </div>
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.cardInfo}>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Environments:</span>
                        <span className={styles.infoValue}>
                          {estimation.number_of_environments}
                        </span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Total Days:</span>
                        <span className={styles.infoValue}>
                          {estimation.total_migration_days.toFixed(1)}
                        </span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Type:</span>
                        <span className={styles.infoValue}>
                          {estimation.migration_type.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    <button
                      className={styles.viewButton}
                      onClick={() => {
                        // TODO: View detailed estimation
                        alert("View details coming soon!");
                      }}
                    >
                      View Details
                    </button>
                    <button
                      className={styles.deleteButton}
                      onClick={() => {
                        // TODO: Delete estimation
                        if (
                          confirm("Are you sure you want to delete this estimation?")
                        ) {
                          alert("Delete coming soon!");
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
