"use client";

import React, { useState, useEffect } from "react";
import { getArchivedEstimationsAdmin, updateLeadStatus, unarchiveEstimation, updateColdStatus } from "@/lib/api";
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

export default function ArchivedEstimationsView() {
  const [estimations, setEstimations] = useState<Estimation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterEstimationType, setFilterEstimationType] = useState<string>("all");
  const [filterEnquiryStatus, setFilterEnquiryStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);
  const [estimationToUnarchive, setEstimationToUnarchive] = useState<Estimation | null>(null);

  useEffect(() => {
    loadEstimations();
  }, []);

  const loadEstimations = async () => {
    console.log("loadArchivedEstimations called");
    setIsLoading(true);
    setError(null);

    try {
      // First, update cold status for estimations with 90+ days of inactivity
      try {
        const coldStatusResult = await updateColdStatus();
        console.log("Cold status update:", coldStatusResult);
      } catch (coldErr) {
        console.log("Cold status update failed (non-critical):", coldErr);
        // Non-critical error, continue loading
      }

      // Then fetch archived estimations
      const data = await getArchivedEstimationsAdmin();
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

  const handleUnarchiveClick = (estimation: Estimation) => {
    setEstimationToUnarchive(estimation);
    setShowUnarchiveModal(true);
  };

  const handleUnarchiveConfirm = async () => {
    if (!estimationToUnarchive) return;

    try {
      await unarchiveEstimation(estimationToUnarchive._id);
      // Remove from local state
      setEstimations((prev) => prev.filter((est) => est._id !== estimationToUnarchive._id));
      setShowUnarchiveModal(false);
      setEstimationToUnarchive(null);
    } catch (error) {
      console.error("Failed to unarchive estimation:", error);
      alert("Failed to unarchive estimation. Please try again.");
    }
  };

  const handleUnarchiveCancel = () => {
    setShowUnarchiveModal(false);
    setEstimationToUnarchive(null);
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

  const toggleCardExpansion = (cardId: string) => {
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const isCardExpanded = (cardId: string) => expandedCards.has(cardId);

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
          <h2 className={styles.title}>Archived Estimations</h2>
          <p className={styles.subtitle}>
            View and manage archived migration estimations
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
          showColdColumn={true}
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
                        {estimation.user_name || "Unknown User"}
                      </div>
                      <div className={styles.estimationType}>
                        {estimation.estimation_type === "quick" ? "Quick Estimate" : "Detailed Estimate"}
                      </div>
                    </div>
                    <div className={styles.statusBadges} onClick={(e) => e.stopPropagation()}>
                      {estimation.has_enquiry ? (
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
                          <option value="cold">Cold Lead</option>
                        </select>
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

                      {/* Unarchive Button */}
                      <div className={styles.cardActions}>
                        <button
                          className={styles.unarchiveButton}
                          onClick={() => handleUnarchiveClick(estimation)}
                        >
                          <span className={styles.unarchiveIcon}>📤</span>
                          Unarchive
                        </button>
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

      {/* Unarchive Confirmation Modal */}
      {showUnarchiveModal && estimationToUnarchive && (
        <div className={styles.modalOverlay} onClick={handleUnarchiveCancel}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Restore Estimation</h3>
            <p className={styles.modalMessage}>
              Are you sure you want to restore this estimation from archive?
            </p>
            <p className={styles.modalSubtext}>
              "{estimationToUnarchive.name || estimationToUnarchive.user_name || "Unnamed Estimation"}"
            </p>
            <div className={styles.modalActions}>
              <button className={styles.modalCancelButton} onClick={handleUnarchiveCancel}>
                Cancel
              </button>
              <button className={styles.modalConfirmButton} onClick={handleUnarchiveConfirm}>
                Yes, Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
