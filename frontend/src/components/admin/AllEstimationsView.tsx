"use client";

import React, { useState, useEffect } from "react";
import { getAllEstimationsAdmin, updateLeadStatus, archiveEstimation, getFullEstimationAdmin } from "@/lib/api";
import KanbanView from "./KanbanView";
import ArchiveConfirmModal from "./ArchiveConfirmModal";
import styles from "./AllEstimationsView.module.css";

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

export default function AllEstimationsView() {
  const [estimations, setEstimations] = useState<Estimation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterEstimationType, setFilterEstimationType] = useState<string>("all");
  const [filterEnquiryStatus, setFilterEnquiryStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [fullEstimations, setFullEstimations] = useState<Map<string, any>>(new Map());
  const [loadingFullEstimations, setLoadingFullEstimations] = useState<Set<string>>(new Set());
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [estimationToArchive, setEstimationToArchive] = useState<Estimation | null>(null);
  const [isGeneratingSOW, setIsGeneratingSOW] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadEstimations();
  }, []);

  const loadEstimations = async () => {
    console.log("loadEstimations called");
    setIsLoading(true);
    setError(null);

    try {
      const data = await getAllEstimationsAdmin();
      console.log("Loaded estimations:", data.length);
      
      // Log estimations with enquiries to see their lead_status
      const withEnquiries = data.filter(e => e.has_enquiry);
      console.log("Estimations with enquiries:", withEnquiries.map(e => ({
        id: e._id,
        name: e.name,
        lead_status: e.lead_status,
        has_enquiry: e.has_enquiry
      })));
      
      setEstimations(data);
    } catch (err) {
      console.error("Error loading estimations:", err);
      setError(err instanceof Error ? err.message : "Failed to load estimations");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEstimations = estimations.filter((est) => {
    // Filter by estimation type
    if (filterEstimationType !== "all" && est.estimation_type !== filterEstimationType) {
      return false;
    }

    // Filter by migration type (for detailed estimations)
    if (filterType !== "all" && est.migration_type !== filterType) {
      return false;
    }

    // Filter by enquiry status
    if (filterEnquiryStatus === "with_enquiry" && !est.has_enquiry) {
      return false;
    }
    if (filterEnquiryStatus === "without_enquiry" && est.has_enquiry) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        est.user_name?.toLowerCase().includes(query) ||
        est.user_email?.toLowerCase().includes(query) ||
        est.user_company?.toLowerCase().includes(query) ||
        est.migration_type?.toLowerCase().includes(query) ||
        est.data_size?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const uniqueMigrationTypes = Array.from(
    new Set(estimations.filter(e => e.migration_type).map((est) => est.migration_type!))
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleLeadStatusChange = async (estimationId: string, newStatus: string) => {
    try {
      await updateLeadStatus(estimationId, newStatus);
      // Update local state
      setEstimations((prev) =>
        prev.map((est) =>
          est._id === estimationId
            ? { ...est, lead_status: newStatus, lead_status_updated_at: new Date().toISOString() }
            : est
        )
      );
    } catch (error) {
      console.error("Failed to update lead status:", error);
      alert("Failed to update lead status. Please try again.");
    }
  };

  const handleArchiveClick = (estimation: Estimation) => {
    setEstimationToArchive(estimation);
    setShowArchiveModal(true);
  };

  const handleArchiveConfirm = async () => {
    if (!estimationToArchive) return;

    try {
      await archiveEstimation(estimationToArchive._id);
      // Remove from local state
      setEstimations((prev) => prev.filter((est) => est._id !== estimationToArchive._id));
      setShowArchiveModal(false);
      setEstimationToArchive(null);
    } catch (error) {
      console.error("Failed to archive estimation:", error);
      alert("Failed to archive estimation. Please try again.");
    }
  };

  const handleArchiveCancel = () => {
    setShowArchiveModal(false);
    setEstimationToArchive(null);
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
        return "";
    }
  };

  const getStatusClass = (status?: string) => {
    switch (status) {
      case "new":
        return styles.statusNew;
      case "under_review":
        return styles.statusUnderReview;
      case "quote_sent":
        return styles.statusQuoteSent;
      case "converted":
        return styles.statusConverted;
      case "rejected":
        return styles.statusRejected;
      case "cold":
        return styles.statusCold;
      default:
        return "";
    }
  };

  const toggleCardExpansion = async (cardId: string) => {
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
        // Fetch full details if not already loaded
        if (!fullEstimations.has(cardId)) {
          fetchFullEstimation(cardId);
        }
      }
      return newSet;
    });
  };

  const fetchFullEstimation = async (estimationId: string) => {
    if (loadingFullEstimations.has(estimationId)) return;
    
    setLoadingFullEstimations(prev => new Set(prev).add(estimationId));
    
    try {
      const data = await getFullEstimationAdmin(estimationId);
      setFullEstimations(prev => new Map(prev).set(estimationId, data));
    } catch (error) {
      console.error("Failed to fetch full estimation:", error);
    } finally {
      setLoadingFullEstimations(prev => {
        const newSet = new Set(prev);
        newSet.delete(estimationId);
        return newSet;
      });
    }
  };

  const isCardExpanded = (cardId: string) => expandedCards.has(cardId);

  const handleSOWGeneration = async (estimation: Estimation) => {
    setIsGeneratingSOW(prev => new Set(prev).add(estimation._id));
    
    try {
      const effectiveStatus = estimation.lead_status || "new";
      
      if (effectiveStatus === "new") {
        await updateLeadStatus(estimation._id, "under_review");
        console.log("Lead status updated from 'new' to 'under_review'");
        await loadEstimations();
      }
      
      alert("SOW Template generation will be implemented soon!\n\n" + 
            (effectiveStatus === "new" 
              ? "Lead status has been moved to 'Under Review'." 
              : ""));
    } catch (error) {
      console.error("Error during SOW generation:", error);
      alert("Failed to process request. Please try again.");
    } finally {
      setIsGeneratingSOW(prev => {
        const newSet = new Set(prev);
        newSet.delete(estimation._id);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading estimations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={loadEstimations} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header with Stats */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2 className={styles.title}>All Estimations</h2>
          <p className={styles.subtitle}>
            View all migration estimations submitted by users
          </p>
        </div>
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{estimations.length}</div>
            <div className={styles.statLabel}>Total Estimations</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>
              {new Set(estimations.map((e) => e.user_email || e.user_name)).size}
            </div>
            <div className={styles.statLabel}>Unique Users</div>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className={styles.viewToggleContainer}>
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewButton} ${
              viewMode === "list" ? styles.viewButtonActive : ""
            }`}
            onClick={() => setViewMode("list")}
            title="List View"
          >
            <span className={styles.viewIcon}>☷</span>
            List
          </button>
          <button
            className={`${styles.viewButton} ${
              viewMode === "kanban" ? styles.viewButtonActive : ""
            }`}
            onClick={() => setViewMode("kanban")}
            title="Kanban Board"
          >
            <span className={styles.viewIcon}>⊞</span>
            Board
          </button>
        </div>
      </div>

      {/* Filters - Only show in list view */}
      {viewMode === "list" && (
        <div className={styles.filters}>
          <input
            type="text"
            placeholder="Search by name, email, company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          <select
            value={filterEstimationType}
            onChange={(e) => setFilterEstimationType(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Types</option>
            <option value="quick">Quick Estimates</option>
            <option value="detailed">Detailed Estimates</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Migration Types</option>
            {uniqueMigrationTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            value={filterEnquiryStatus}
            onChange={(e) => setFilterEnquiryStatus(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Enquiry Status</option>
            <option value="with_enquiry">With Enquiry</option>
            <option value="without_enquiry">Without Enquiry</option>
          </select>
        </div>
      )}

      {/* Kanban View */}
      {viewMode === "kanban" ? (
        <KanbanView 
          estimations={estimations} 
          onStatusUpdate={() => {
            console.log("Refreshing estimations after status update");
            loadEstimations();
          }}
          onArchive={handleArchiveClick}
        />
      ) : (
        <>
          {/* Estimations List */}
          {filteredEstimations.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📊</div>
          <h3 className={styles.emptyTitle}>No Estimations Found</h3>
          <p className={styles.emptyText}>
            {searchQuery || filterType !== "all"
              ? "Try adjusting your search or filter criteria"
              : "No estimations have been submitted yet"}
          </p>
        </div>
      ) : (
        <div className={styles.list}>
          {filteredEstimations.map((estimation) => {
            const isExpanded = isCardExpanded(estimation._id);
            
            return (
              <div key={estimation._id} className={styles.card}>
                {/* Collapsed Header - Always Visible */}
                <div 
                  className={styles.cardHeaderCollapsed}
                  onClick={() => toggleCardExpansion(estimation._id)}
                >
                  <div className={styles.collapsedContent}>
                    <div className={styles.customerInfo}>
                      <div className={styles.customerName}>
                        {estimation.client_name || estimation.user_name || "Unknown User"}
                      </div>
                      <div className={styles.estimationType}>
                        {estimation.estimation_type === "quick" ? "Quick Estimate" : "Detailed Estimate"}
                      </div>
                    </div>
                    <div className={styles.statusBadges} onClick={(e) => e.stopPropagation()}>
                      {estimation.has_enquiry ? (
                        estimation.lead_status === "cold" ? (
                          <span className={`${styles.leadStatusBadge} ${styles.statusCold}`}>
                            Cold Lead (Auto)
                          </span>
                        ) : (
                          <select
                            value={estimation.lead_status || "new"}
                            onChange={(e) => handleLeadStatusChange(estimation._id, e.target.value)}
                            className={`${styles.statusSelect} ${getStatusClass(estimation.lead_status || "new")}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="new">New Lead</option>
                            <option value="under_review">Under Review</option>
                            <option value="quote_sent">Quote Sent</option>
                            <option value="converted">Converted</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        )
                      ) : (
                        <span className={styles.noEnquiryBadge}>No Enquiry</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.expandIconContainer}>
                    <span className={styles.expandIcon}>
                      {isExpanded ? "▼" : "▶"}
                    </span>
                  </div>
                </div>

                {/* Expanded Content - Show when expanded */}
                {isExpanded && (
                  <div className={styles.cardExpandedContent}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardHeaderLeft}>
                        <h3 className={styles.cardTitle}>
                          {estimation.name || "Untitled Estimation"}
                        </h3>
                        <span className={`${styles.cardBadge} ${estimation.estimation_type === "quick" ? styles.quickBadge : ""}`}>
                          {estimation.estimation_type === "quick" ? "Quick Estimate" : estimation.migration_type}
                        </span>
                      </div>
                      <div className={styles.cardDate}>
                        {formatDate(estimation.created_at)}
                      </div>
                    </div>

                    <div className={styles.cardBody}>
                      {/* Client Name */}
                      {estimation.client_name && (
                        <div className={styles.clientSection}>
                          <h4 className={styles.sectionTitle}>Client / Project</h4>
                          <div className={styles.clientNameDisplay}>
                            <span className={styles.clientIcon}>🏢</span>
                            <span className={styles.clientNameText}>{estimation.client_name}</span>
                          </div>
                        </div>
                      )}

                      {/* User Details */}
                            <div className={styles.userSection}>
                        <h4 className={styles.sectionTitle}>User Information</h4>
                        <div className={styles.userDetails}>
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>Name:</span>
                            <span className={styles.detailValue}>
                              {estimation.user_name || "N/A"}
                            </span>
                          </div>
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>Email:</span>
                            <span className={styles.detailValue}>
                              {estimation.user_email || "N/A"}
                            </span>
                          </div>
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>Designation:</span>
                            <span className={styles.detailValue}>
                              {estimation.user_designation || "N/A"}
                            </span>
                          </div>
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>Company:</span>
                            <span className={styles.detailValue}>
                              {estimation.user_company || "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Estimation Details */}
                      <div className={styles.estimationSection}>
                        <h4 className={styles.sectionTitle}>Estimation Details</h4>
                        {estimation.estimation_type === "quick" ? (
                          <div className={styles.estimationMetrics}>
                            <div className={styles.metric}>
                              <div className={styles.metricIcon}>💾</div>
                              <div className={styles.metricContent}>
                                <div className={styles.metricLabel}>Data Size</div>
                                <div className={styles.metricValue}>
                                  {estimation.data_size?.toUpperCase()}
                                </div>
                              </div>
                            </div>
                            <div className={styles.metric}>
                              <div className={styles.metricIcon}>⏱️</div>
                              <div className={styles.metricContent}>
                                <div className={styles.metricLabel}>Est. Weeks</div>
                                <div className={styles.metricValue}>
                                  {estimation.estimated_weeks_min}-{estimation.estimated_weeks_max}
                                </div>
                              </div>
                            </div>
                            <div className={styles.metric}>
                              <div className={styles.metricIcon}>⚡</div>
                              <div className={styles.metricContent}>
                                <div className={styles.metricLabel}>Type</div>
                                <div className={styles.metricValue}>
                                  Quick
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className={styles.estimationMetrics}>
                            <div className={styles.metric}>
                              <div className={styles.metricIcon}>🌍</div>
                              <div className={styles.metricContent}>
                                <div className={styles.metricLabel}>Environments</div>
                                <div className={styles.metricValue}>
                                  {estimation.number_of_environments}
                                </div>
                              </div>
                            </div>
                            <div className={styles.metric}>
                              <div className={styles.metricIcon}>📅</div>
                              <div className={styles.metricContent}>
                                <div className={styles.metricLabel}>Total Days</div>
                                <div className={styles.metricValue}>
                                  {Math.round(estimation.total_migration_days || 0)}
                                </div>
                              </div>
                            </div>
                            <div className={styles.metric}>
                              <div className={styles.metricIcon}>⏱️</div>
                              <div className={styles.metricContent}>
                                <div className={styles.metricLabel}>Est. Weeks</div>
                                <div className={styles.metricValue}>
                                  {Math.round((estimation.total_migration_days || 0) / 5)}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Full Estimation Breakdown (for detailed estimations) */}
                      {estimation.estimation_type === "detailed" && (() => {
                        const fullData = fullEstimations.get(estimation._id);
                        const isLoading = loadingFullEstimations.has(estimation._id);
                        
                        if (isLoading) {
                          return (
                            <div className={styles.estimationSection}>
                              <div className={styles.loadingText}>Loading detailed estimation...</div>
                            </div>
                          );
                        }
                        
                        if (fullData?.response_data) {
                          return (
                            <div className={styles.estimationSection}>
                              <h4 className={styles.sectionTitle}>Detailed Estimation Breakdown</h4>
                              
                              {/* Summary */}
                              <div className={styles.estimationSummary}>
                                <div className={styles.summaryItem}>
                                  <span className={styles.summaryLabel}>Total Estimation Range:</span>
                                  <span className={styles.summaryValue}>
                                    {fullData.response_data.total_days_low?.toFixed(1)} - {fullData.response_data.total_days_high?.toFixed(1)} days
                                  </span>
                                </div>
                                <div className={styles.summaryItem}>
                                  <span className={styles.summaryLabel}>Variance:</span>
                                  <span className={styles.summaryValue}>
                                    ±{fullData.response_data.estimation_variance_percent}%
                                  </span>
                                </div>
                              </div>

                              {/* Per-Environment Estimates */}
                              {fullData.response_data.per_environment_estimates?.map((env: any, idx: number) => (
                                <div key={idx} className={styles.envBreakdown}>
                                  <h5 className={styles.envTitle}>{env.environment_name}</h5>
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
                                      <h6 className={styles.subsectionTitle}>Activities</h6>
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
                              {fullData.response_data.shared_activities && fullData.response_data.shared_activities.length > 0 && (
                                <div className={styles.sharedActivities}>
                                  <h5 className={styles.sharedTitle}>Shared Activities (One-Time Costs)</h5>
                                  {fullData.response_data.shared_activities.map((activity: any, idx: number) => (
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
                              {fullData.response_data.assumptions && fullData.response_data.assumptions.length > 0 && (
                                <div className={styles.assumptions}>
                                  <h5 className={styles.assumptionsTitle}>Assumptions</h5>
                                  <ul className={styles.assumptionsList}>
                                    {fullData.response_data.assumptions.map((assumption: string, idx: number) => (
                                      <li key={idx} className={styles.assumptionItem}>{assumption}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Enquiry */}
                      {estimation.enquiry && (
                        <div className={styles.estimationSection}>
                          <h4 className={styles.sectionTitle}>Enquiry</h4>
                          <div className={styles.enquiryBox}>
                            {estimation.enquiry}
                          </div>
                        </div>
                      )}

                      {/* Lead Status */}
                      {estimation.has_enquiry && (
                        <div className={styles.estimationSection}>
                          <h4 className={styles.sectionTitle}>Lead Status</h4>
                          <div className={styles.userDetails}>
                            <div className={styles.detailRow}>
                              <span className={styles.detailLabel}>Status:</span>
                              <span className={styles.detailValue}>
                                {getStatusLabel(estimation.lead_status || "new")}
                              </span>
                            </div>
                            {estimation.lead_status_updated_at && (
                              <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Last Updated:</span>
                                <span className={styles.detailValue}>
                                  {formatDate(estimation.lead_status_updated_at)}
                                </span>
                              </div>
                            )}
                            <div className={styles.detailRow}>
                              <span className={styles.detailLabel}>Enquiry Read:</span>
                              <span className={styles.detailValue}>
                                {estimation.enquiry_read ? "Yes" : "No"}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className={styles.actionButtonsSection}>
                        {/* Archive Button */}
                        <button 
                          className={styles.archiveButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveClick(estimation);
                          }}
                          title="Archive this estimation"
                        >
                          <span className={styles.archiveIcon}>📦</span>
                          <span>Archive</span>
                        </button>

                        {/* SOW Generation Button */}
                        {estimation.has_enquiry && 
                         ((estimation.lead_status || "new") === "new" || estimation.lead_status === "under_review") && (
                          <button
                            className={styles.sowButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSOWGeneration(estimation);
                            }}
                            disabled={isGeneratingSOW.has(estimation._id)}
                            title="Generate Statement of Work template"
                          >
                            {isGeneratingSOW.has(estimation._id) ? (
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
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveModal && estimationToArchive && (
        <ArchiveConfirmModal
          onConfirm={handleArchiveConfirm}
          onCancel={handleArchiveCancel}
          estimationName={estimationToArchive.name || estimationToArchive.user_name || "Unnamed Estimation"}
        />
      )}
    </div>
  );
}
