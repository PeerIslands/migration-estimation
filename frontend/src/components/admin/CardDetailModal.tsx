"use client";

import React, { useState, useEffect } from "react";
import { getFullEstimationAdmin, updateLeadStatus } from "@/lib/api";
import styles from "./CardDetailModal.module.css";

interface Estimation {
  _id: string;
  name?: string;
  estimation_type: string;
  migration_type?: string;
  number_of_environments?: number;
  total_migration_days?: number;
  data_size?: string;
  estimated_weeks_min?: number;
  estimated_weeks_max?: number;
  client_name?: string;
  user_name?: string;
  user_email?: string;
  user_designation?: string;
  user_company?: string;
  enquiry?: string;
  has_enquiry: boolean;
  enquiry_read: boolean;
  lead_status?: string;
  lead_status_updated_at?: string;
  created_at: string;
}

interface CardDetailModalProps {
  estimation: Estimation;
  onClose: () => void;
  onArchive?: (estimation: Estimation) => void;
  onStatusChange?: () => void;
}

export default function CardDetailModal({ estimation, onClose, onArchive, onStatusChange }: CardDetailModalProps) {
  const [fullEstimation, setFullEstimation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingSOW, setIsGeneratingSOW] = useState(false);

  useEffect(() => {
    const fetchFullDetails = async () => {
      try {
        setIsLoading(true);
        const data = await getFullEstimationAdmin(estimation._id);
        setFullEstimation(data);
      } catch (error) {
        console.error("Failed to fetch full estimation details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFullDetails();
  }, [estimation._id]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case "new":
        return "New Lead";
      case "under_review":
        return "Under Review";
      case "quote_sent":
        return "Quote Sent";
      case "converted":
        return "Converted";
      case "rejected":
        return "Rejected";
      case "cold":
        return "Cold Lead";
      default:
        return "No Status";
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>
            {estimation.name || "Untitled Estimation"}
          </h2>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Type Badge and Archive Button */}
          <div className={styles.section}>
            <div className={styles.badgesRow}>
              <div className={styles.badges}>
                <span
                  className={`${styles.badge} ${
                    estimation.estimation_type === "quick" ? styles.badgeQuick : styles.badgeDetailed
                  }`}
                >
                  {estimation.estimation_type === "quick" ? "Quick Estimate" : "Detailed Estimate"}
                </span>
                {estimation.has_enquiry && (
                  <span className={`${styles.badge} ${styles.badgeStatus}`}>
                    {getStatusLabel(estimation.lead_status || "new")}
                  </span>
                )}
              </div>
              {onArchive && (
                <button 
                  className={styles.archiveButtonInline}
                  onClick={() => {
                    onArchive(estimation);
                    onClose();
                  }}
                  title="Archive this estimation"
                >
                  <span className={styles.archiveIcon}>📦</span>
                  <span>Archive</span>
                </button>
              )}
            </div>
          </div>

          {/* Client Name */}
          {estimation.client_name && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Client / Project</h3>
              <div className={styles.infoGrid}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Client Name:</span>
                  <span className={styles.infoValue}>{estimation.client_name}</span>
                </div>
              </div>
            </div>
          )}

          {/* User Information */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>User Information</h3>
            <div className={styles.infoGrid}>
              {estimation.user_name && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Name:</span>
                  <span className={styles.infoValue}>{estimation.user_name}</span>
                </div>
              )}
              {estimation.user_email && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Email:</span>
                  <span className={styles.infoValue}>{estimation.user_email}</span>
                </div>
              )}
              {estimation.user_designation && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Designation:</span>
                  <span className={styles.infoValue}>{estimation.user_designation}</span>
                </div>
              )}
              {estimation.user_company && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Company:</span>
                  <span className={styles.infoValue}>{estimation.user_company}</span>
                </div>
              )}
            </div>
          </div>

          {/* Estimation Details */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Estimation Details</h3>
            <div className={styles.infoGrid}>
              {estimation.estimation_type === "quick" ? (
                <>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Data Size:</span>
                    <span className={styles.infoValue}>{estimation.data_size?.toUpperCase()}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Estimated Weeks:</span>
                    <span className={styles.infoValue}>
                      {estimation.estimated_weeks_min} - {estimation.estimated_weeks_max} weeks
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Migration Type:</span>
                    <span className={styles.infoValue}>{estimation.migration_type}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Environments:</span>
                    <span className={styles.infoValue}>{estimation.number_of_environments}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Total Days:</span>
                    <span className={styles.infoValue}>
                      {Math.round(estimation.total_migration_days || 0)} days
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Estimated Weeks:</span>
                    <span className={styles.infoValue}>
                      ~{Math.round((estimation.total_migration_days || 0) / 5)} weeks
                    </span>
                  </div>
                </>
              )}
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Created:</span>
                <span className={styles.infoValue}>{formatDate(estimation.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Full Estimation Breakdown (for detailed estimations) */}
          {estimation.estimation_type === "detailed" && fullEstimation?.response_data && !isLoading && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Detailed Estimation Breakdown</h3>
              
              {/* Summary */}
              <div className={styles.estimationSummary}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Total Estimation Range:</span>
                  <span className={styles.summaryValue}>
                    {fullEstimation.response_data.total_days_low?.toFixed(1)} - {fullEstimation.response_data.total_days_high?.toFixed(1)} days
                  </span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Variance:</span>
                  <span className={styles.summaryValue}>
                    ±{fullEstimation.response_data.estimation_variance_percent}%
                  </span>
                </div>
              </div>

              {/* Per-Environment Estimates */}
              {fullEstimation.response_data.per_environment_estimates?.map((env: any, idx: number) => (
                <div key={idx} className={styles.envBreakdown}>
                  <h4 className={styles.envTitle}>{env.environment_name}</h4>
                  <div className={styles.envStats}>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Total Effort:</span>
                      <span className={styles.statValue}>{env.total_days?.toFixed(1)} days</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Data Tier:</span>
                      <span className={styles.statValue}>{env.data_tier}</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Migration Days:</span>
                      <span className={styles.statValue}>{env.migration_days?.toFixed(1)}</span>
                    </div>
                  </div>

                  {/* Activities */}
                  {env.activities && env.activities.length > 0 && (
                    <div className={styles.activitiesList}>
                      <h5 className={styles.subsectionTitle}>Activities</h5>
                      {env.activities.map((activity: any, actIdx: number) => (
                        <div key={actIdx} className={styles.activityItem}>
                          <div className={styles.activityHeader}>
                            <span className={styles.activityName}>{activity.activity}</span>
                            {activity.effort_days !== undefined && (
                              <span className={styles.activityEffort}>
                                {activity.effort_days.toFixed(1)} days
                              </span>
                            )}
                          </div>
                          {activity.description && (
                            <p className={styles.activityDescription}>{activity.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Shared Activities */}
              {fullEstimation.response_data.shared_activities && fullEstimation.response_data.shared_activities.length > 0 && (
                <div className={styles.sharedActivities}>
                  <h4 className={styles.sharedTitle}>Shared Activities (One-Time Costs)</h4>
                  {fullEstimation.response_data.shared_activities.map((activity: any, idx: number) => (
                    <div key={idx} className={styles.activityItem}>
                      <div className={styles.activityHeader}>
                        <span className={styles.activityName}>{activity.activity}</span>
                        {activity.effort_days !== undefined && (
                          <span className={styles.activityEffort}>
                            {activity.effort_days.toFixed(1)} days
                          </span>
                        )}
                      </div>
                      {activity.description && (
                        <p className={styles.activityDescription}>{activity.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Assumptions */}
              {fullEstimation.response_data.assumptions && fullEstimation.response_data.assumptions.length > 0 && (
                <div className={styles.assumptions}>
                  <h4 className={styles.assumptionsTitle}>Assumptions</h4>
                  <ul className={styles.assumptionsList}>
                    {fullEstimation.response_data.assumptions.map((assumption: string, idx: number) => (
                      <li key={idx} className={styles.assumptionItem}>{assumption}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {isLoading && estimation.estimation_type === "detailed" && (
            <div className={styles.section}>
              <div className={styles.loadingText}>Loading detailed estimation...</div>
            </div>
          )}

          {/* Enquiry */}
          {estimation.enquiry && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Enquiry</h3>
              <div className={styles.enquiryBox}>
                {estimation.enquiry}
              </div>
            </div>
          )}

          {/* Lead Status */}
          {estimation.has_enquiry && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Lead Status</h3>
              <div className={styles.infoGrid}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Status:</span>
                  <span className={styles.infoValue}>
                    {getStatusLabel(estimation.lead_status || "new")}
                  </span>
                </div>
                {estimation.lead_status_updated_at && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Last Updated:</span>
                    <span className={styles.infoValue}>
                      {formatDate(estimation.lead_status_updated_at)}
                    </span>
                  </div>
                )}
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Enquiry Read:</span>
                  <span className={styles.infoValue}>
                    {estimation.enquiry_read ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* SOW Template Generation - Only for New or Under Review leads */}
          {(() => {
            // Treat null lead_status as "new" for backward compatibility
            const effectiveStatus = estimation.lead_status || (estimation.has_enquiry ? "new" : null);
            console.log("SOW Button Check:", {
              has_enquiry: estimation.has_enquiry,
              lead_status: estimation.lead_status,
              effectiveStatus: effectiveStatus,
              shouldShow: estimation.has_enquiry && 
                         (effectiveStatus === "new" || effectiveStatus === "under_review")
            });
            return null;
          })()}
          {estimation.has_enquiry && 
           ((estimation.lead_status || "new") === "new" || estimation.lead_status === "under_review") && (
            <div className={styles.section}>
              <button
                className={styles.sowButton}
                onClick={async () => {
                  setIsGeneratingSOW(true);
                  try {
                    // Treat null lead_status as "new" for backward compatibility
                    const effectiveStatus = estimation.lead_status || "new";
                    
                    // If status is "new" (or null, which we treat as "new"), move to "under_review"
                    if (effectiveStatus === "new") {
                      await updateLeadStatus(estimation._id, "under_review");
                      console.log("Lead status updated from 'new' to 'under_review'");
                      
                      // Notify parent to refresh
                      if (onStatusChange) {
                        onStatusChange();
                      }
                    }
                    
                    // TODO: Implement SOW generation backend
                    alert("SOW Template generation will be implemented soon!\n\n" + 
                          (effectiveStatus === "new" 
                            ? "Lead status has been moved to 'Under Review'." 
                            : ""));
                    
                    // Close modal after action
                    onClose();
                  } catch (error) {
                    console.error("Error during SOW generation:", error);
                    alert("Failed to process request. Please try again.");
                  } finally {
                    setIsGeneratingSOW(false);
                  }
                }}
                disabled={isGeneratingSOW}
                title="Generate Statement of Work template"
              >
                {isGeneratingSOW ? (
                  <>
                    <span className={styles.sowIcon}>⏳</span>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span className={styles.sowIcon}>📄</span>
                    <span>Generate SOW Template</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
