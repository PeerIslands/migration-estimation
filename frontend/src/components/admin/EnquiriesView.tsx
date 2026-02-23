"use client";

import React, { useState, useEffect } from "react";
import { getAllEstimationsAdmin, markEnquiryRead, updateLeadStatus } from "@/lib/api";
import styles from "./EnquiriesView.module.css";

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

interface EnquiriesViewProps {
  onEnquiryRead?: () => void;
}

export default function EnquiriesView({ onEnquiryRead }: EnquiriesViewProps) {
  const [estimations, setEstimations] = useState<Estimation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("new");
  const [filterLeadStatus, setFilterLeadStatus] = useState<string>("all");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadEnquiries();
  }, []);

  const loadEnquiries = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getAllEstimationsAdmin();
      // Filter only estimations with enquiries
      const withEnquiries = data.filter((est) => est.has_enquiry);
      setEstimations(withEnquiries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load enquiries");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (estimationId: string) => {
    try {
      await markEnquiryRead(estimationId);
      // Update local state
      setEstimations((prev) =>
        prev.map((est) =>
          est._id === estimationId ? { ...est, enquiry_read: true } : est
        )
      );
      // Notify parent to refresh unread count
      if (onEnquiryRead) {
        onEnquiryRead();
      }
    } catch (error) {
      console.error("Failed to mark enquiry as read:", error);
    }
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
    }
  };

  const handleCardToggle = async (estimationId: string, isCurrentlyExpanded: boolean) => {
    const newExpandedCards = new Set(expandedCards);
    
    if (isCurrentlyExpanded) {
      // Collapse the card
      newExpandedCards.delete(estimationId);
    } else {
      // Expand the card
      newExpandedCards.add(estimationId);
      
      // Automatically mark as read when expanded
      const estimation = estimations.find((est) => est._id === estimationId);
      if (estimation && !estimation.enquiry_read) {
        handleMarkAsRead(estimationId);
      }
    }
    
    setExpandedCards(newExpandedCards);
  };

  const filteredEnquiries = estimations.filter((est) => {
    // Filter by read/unread
    let matchesReadStatus = true;
    if (filterStatus === "unread") {
      matchesReadStatus = !est.enquiry_read;
    } else if (filterStatus === "read") {
      matchesReadStatus = est.enquiry_read;
    } else if (filterStatus === "new") {
      matchesReadStatus = est.lead_status === "new";
    }

    // Filter by lead status
    let matchesLeadStatus = true;
    if (filterLeadStatus !== "all") {
      matchesLeadStatus = est.lead_status === filterLeadStatus;
    }

    return matchesReadStatus && matchesLeadStatus;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const unreadCount = estimations.filter((e) => !e.enquiry_read).length;
  const newLeadsCount = estimations.filter((e) => e.lead_status === "new").length;

  const getStatusBadgeClass = (status?: string) => {
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

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case "new":
        return "New";
      case "under_review":
        return "Under Review";
      case "quote_sent":
        return "Quote Sent";
      case "converted":
        return "Converted";
      case "rejected":
        return "Rejected";
      case "cold":
        return "Cold";
      default:
        return "New";
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading enquiries...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={loadEnquiries} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2 className={styles.title}>User Enquiries</h2>
          <p className={styles.subtitle}>
            Manage enquiries submitted by users after completing estimations
          </p>
        </div>
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{newLeadsCount}</div>
            <div className={styles.statLabel}>New Leads</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{unreadCount}</div>
            <div className={styles.statLabel}>Unread</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{estimations.length}</div>
            <div className={styles.statLabel}>Total Enquiries</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="new">New Leads</option>
          <option value="unread">Unread Only</option>
          <option value="read">Read Only</option>
          <option value="all">All Enquiries</option>
        </select>
        <select
          value={filterLeadStatus}
          onChange={(e) => setFilterLeadStatus(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="under_review">Under Review</option>
          <option value="quote_sent">Quote Sent</option>
          <option value="converted">Converted</option>
          <option value="rejected">Rejected</option>
          <option value="cold">Cold</option>
        </select>
      </div>

      {/* Enquiries List */}
      {filteredEnquiries.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📬</div>
          <h3 className={styles.emptyTitle}>No Enquiries Found</h3>
          <p className={styles.emptyText}>
            {filterStatus === "unread"
              ? "All enquiries have been read"
              : filterStatus === "read"
              ? "No read enquiries yet"
              : "No enquiries have been submitted yet"}
          </p>
        </div>
      ) : (
        <div className={styles.list}>
          {filteredEnquiries.map((estimation) => {
            const isExpanded = expandedCards.has(estimation._id);
            
            return (
              <div
                key={estimation._id}
                className={`${styles.card} ${
                  !estimation.enquiry_read ? styles.cardUnread : ""
                }`}
              >
                <div 
                  className={styles.cardHeader}
                  onClick={() => handleCardToggle(estimation._id, isExpanded)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.cardHeaderLeft}>
                    <span className={styles.expandIcon}>
                      {isExpanded ? "▼" : "▶"}
                    </span>
                    <h3 className={styles.cardTitle}>
                      {estimation.client_name || estimation.user_name || estimation.name || "Untitled Estimation"}
                    </h3>
                    <span className={`${styles.leadStatusBadge} ${getStatusBadgeClass(estimation.lead_status)}`}>
                      {getStatusLabel(estimation.lead_status || "new")}
                    </span>
                    {!estimation.enquiry_read && (
                      <span className={styles.unreadBadge}>Unread</span>
                    )}
                  </div>
                  <div className={styles.cardDate}>
                    {formatDate(estimation.created_at)}
                  </div>
                </div>

                {isExpanded && (
                  <>
                    {/* Lead Status Management */}
                    <div className={styles.statusSection}>
                <div className={styles.statusRow}>
                  <label className={styles.statusLabel}>Lead Status:</label>
                  {estimation.lead_status === "cold" ? (
                    <span className={`${styles.statusBadge} ${styles.statusCold}`}>
                      Cold Lead (Auto)
                    </span>
                  ) : (
                    <select
                      value={estimation.lead_status || "new"}
                      onChange={(e) => handleLeadStatusChange(estimation._id, e.target.value)}
                      className={styles.statusSelect}
                    >
                      <option value="new">New</option>
                      <option value="under_review">Under Review</option>
                      <option value="quote_sent">Quote Sent</option>
                      <option value="converted">Converted</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  )}
                </div>
                {estimation.lead_status_updated_at && (
                  <div className={styles.statusTimestamp}>
                    Last updated: {formatDate(estimation.lead_status_updated_at)}
                  </div>
                )}
              </div>

              {/* Enquiry Content */}
              <div className={styles.enquirySection}>
                <h4 className={styles.sectionTitle}>Enquiry</h4>
                <div className={styles.enquiryText}>{estimation.enquiry}</div>
              </div>

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
                <div className={styles.userGrid}>
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

              {/* Estimation Summary */}
              <div className={styles.estimationSection}>
                <h4 className={styles.sectionTitle}>Estimation Summary</h4>
                <div className={styles.estimationGrid}>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Type</span>
                    <span className={styles.summaryValue}>
                      {estimation.estimation_type === "quick" ? "Quick Estimate" : "Detailed"}
                    </span>
                  </div>
                  {estimation.estimation_type === "quick" ? (
                    <>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Data Size</span>
                        <span className={styles.summaryValue}>
                          {estimation.data_size?.toUpperCase()}
                        </span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Est. Weeks</span>
                        <span className={styles.summaryValue}>
                          {estimation.estimated_weeks_min}-{estimation.estimated_weeks_max}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Migration Type</span>
                        <span className={styles.summaryValue}>
                          {estimation.migration_type}
                        </span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Environments</span>
                        <span className={styles.summaryValue}>
                          {estimation.number_of_environments}
                        </span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Total Days</span>
                        <span className={styles.summaryValue}>
                          {Math.round(estimation.total_migration_days || 0)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

                    {/* Actions */}
                    {!estimation.enquiry_read && (
                      <div className={styles.cardActions}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(estimation._id);
                          }}
                          className={styles.markReadButton}
                        >
                          Mark as Read
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
