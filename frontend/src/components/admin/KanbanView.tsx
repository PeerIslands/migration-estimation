"use client";

import React, { useState, useEffect } from "react";
import { updateLeadStatus } from "@/lib/api";
import CardDetailModal from "./CardDetailModal";
import styles from "./KanbanView.module.css";

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

interface KanbanViewProps {
  estimations: Estimation[];
  onStatusUpdate: () => void | Promise<void>;
  onArchive?: (estimation: Estimation) => void;
  showColdColumn?: boolean; // Control whether to show the cold column (default: false)
}

const ALL_KANBAN_COLUMNS = [
  { id: "no_enquiry", title: "Quick Estimate", color: "#9e9e9e" },
  { id: "new", title: "New", color: "#1976d2" },
  { id: "under_review", title: "Under Review", color: "#f57c00" },
  { id: "quote_sent", title: "Quote Sent", color: "#7b1fa2" },
  { id: "converted", title: "Converted", color: "#388e3c" },
  { id: "rejected", title: "Rejected", color: "#d32f2f" },
  { id: "cold", title: "Cold (Auto)", color: "#546e7a" },
];

// Status hierarchy for validation (lower number = earlier in workflow)
// Note: "cold" is auto-assigned after 90 days, not manually selectable
const STATUS_ORDER: Record<string, number> = {
  new: 0,
  under_review: 1,
  quote_sent: 2,
  converted: 3,
  rejected: 3, // Same level as converted - inter-draggable
};

export default function KanbanView({ estimations, onStatusUpdate, onArchive, showColdColumn = false }: KanbanViewProps) {
  const [draggedItem, setDraggedItem] = useState<Estimation | null>(null);
  const [selectedCard, setSelectedCard] = useState<Estimation | null>(null);

  // Filter columns based on showColdColumn prop
  const KANBAN_COLUMNS = showColdColumn 
    ? ALL_KANBAN_COLUMNS 
    : ALL_KANBAN_COLUMNS.filter(col => col.id !== "cold");

  useEffect(() => {
    console.log("KanbanView received estimations:", estimations.length);
  }, [estimations]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getEstimationsForColumn = (columnId: string) => {
    if (columnId === "no_enquiry") {
      return estimations.filter((est) => !est.has_enquiry);
    }
    const filtered = estimations.filter(
      (est) => est.has_enquiry && (est.lead_status || "new") === columnId
    );
    console.log(`Column ${columnId} has ${filtered.length} cards`);
    return filtered;
  };

  const handleDragStart = (e: React.DragEvent, estimation: Estimation) => {
    console.log("Drag started for:", estimation.name);
    setDraggedItem(estimation);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", estimation._id);
  };

  const handleCardClick = (e: React.MouseEvent, estimation: Estimation) => {
    // Don't open modal if dragging
    if (draggedItem) return;
    
    e.stopPropagation();
    setSelectedCard(estimation);
  };

  const handleDragOver = (e: React.DragEvent, columnId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if drop is allowed and set appropriate cursor
    if (draggedItem && columnId) {
      const currentColumn = draggedItem.has_enquiry
        ? draggedItem.lead_status || "new"
        : "no_enquiry";
      
      // Check if drop is valid
      let isValidDrop = true;
      
      // Cannot set status on estimations without enquiry
      if (columnId !== "no_enquiry" && !draggedItem.has_enquiry) {
        isValidDrop = false;
      }
      
      // Cannot move enquiries to "no enquiry" column
      if (columnId === "no_enquiry" && draggedItem.has_enquiry) {
        isValidDrop = false;
      }
      
      // Cannot manually drop into "cold" column - it's auto-assigned
      if (columnId === "cold") {
        isValidDrop = false;
      }
      
      // Validate status transition
      if (currentColumn !== "no_enquiry" && columnId !== "no_enquiry" && columnId !== "cold" && currentColumn !== columnId) {
        const currentOrder = STATUS_ORDER[currentColumn];
        const targetOrder = STATUS_ORDER[columnId];
        
        if (targetOrder < currentOrder) {
          const isConvertedRejectedSwap = 
            (currentColumn === "converted" && columnId === "rejected") ||
            (currentColumn === "rejected" && columnId === "converted");
          
          if (!isConvertedRejectedSwap) {
            isValidDrop = false;
          }
        }
      }
      
      e.dataTransfer.dropEffect = isValidDrop ? "move" : "none";
    } else {
      e.dataTransfer.dropEffect = "move";
    }
  };

  const handleDragEnd = () => {
    console.log("Drag ended");
    setDraggedItem(null);
  };

  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log("=== DROP EVENT TRIGGERED ===");
    console.log("Target column:", columnId);
    
    if (!draggedItem) {
      console.log("❌ No dragged item found");
      return;
    }

    console.log("✓ Dragged item ID:", draggedItem._id);
    console.log("✓ Has enquiry:", draggedItem.has_enquiry);
    console.log("✓ Current lead_status:", draggedItem.lead_status);

    // Cannot set status on estimations without enquiry
    if (columnId !== "no_enquiry" && !draggedItem.has_enquiry) {
      console.log("❌ Cannot set status - no enquiry");
      alert("Cannot set lead status on estimation without enquiry");
      setDraggedItem(null);
      return;
    }

    // Cannot move enquiries to "no enquiry" column
    if (columnId === "no_enquiry" && draggedItem.has_enquiry) {
      console.log("❌ Cannot move enquiry to no_enquiry column");
      alert("Cannot move enquiry to 'No Enquiry' column");
      setDraggedItem(null);
      return;
    }

    // Cannot manually move to "cold" column - it's auto-assigned
    if (columnId === "cold") {
      console.log("❌ Cannot manually move to cold column");
      alert("Cold status is automatically assigned after 90 days of inactivity. It cannot be set manually.");
      setDraggedItem(null);
      return;
    }

    // If already in the correct column, do nothing
    const currentColumn = draggedItem.has_enquiry
      ? draggedItem.lead_status || "new"
      : "no_enquiry";
    
    console.log("Current column:", currentColumn);
    console.log("Target column:", columnId);
    
    if (currentColumn === columnId) {
      console.log("⚠️ Already in correct column, skipping");
      setDraggedItem(null);
      return;
    }

    // Validate status transition - prevent backward movement
    if (currentColumn !== "no_enquiry" && columnId !== "no_enquiry") {
      const currentOrder = STATUS_ORDER[currentColumn];
      const targetOrder = STATUS_ORDER[columnId];
      
      // Check if trying to move backward (lower order)
      if (targetOrder < currentOrder) {
        // Exception: converted and rejected are at same level and inter-draggable
        const isConvertedRejectedSwap = 
          (currentColumn === "converted" && columnId === "rejected") ||
          (currentColumn === "rejected" && columnId === "converted");
        
        if (!isConvertedRejectedSwap) {
          console.log("❌ Cannot move backward in workflow");
          alert(`Cannot move backward from "${currentColumn.replace('_', ' ')}" to "${columnId.replace('_', ' ')}". Only forward progression is allowed.`);
          setDraggedItem(null);
          return;
        }
      }
    }

    // Update lead status via API
    console.log("🚀 Starting API update...");
    try {
      const result = await updateLeadStatus(draggedItem._id, columnId);
      console.log("✅ API Update successful:", result);
      console.log("📡 Calling onStatusUpdate to refresh board...");
      
      // Trigger refresh immediately
      const refreshResult = await onStatusUpdate();
      console.log("✅ Board refresh complete:", refreshResult);
    } catch (error) {
      console.error("❌ Failed to update lead status:", error);
      alert(`Failed to update lead status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log("=== DROP COMPLETE ===");
    setDraggedItem(null);
  };

  return (
    <div className={styles.kanbanContainer}>
      <div className={styles.kanbanBoard} key={`board-${estimations.length}`}>
        {KANBAN_COLUMNS.map((column) => {
          const columnEstimations = getEstimationsForColumn(column.id);
          
          return (
            <div
              key={column.id}
              className={styles.kanbanColumn}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div
                className={styles.columnHeader}
                style={{ borderTopColor: column.color }}
              >
                <h3 className={styles.columnTitle}>{column.title}</h3>
                <span className={styles.columnCount}>{columnEstimations.length}</span>
              </div>

              <div className={styles.columnContent}>
                {columnEstimations.length === 0 ? (
                  <div className={styles.emptyColumn}>
                    <p>No estimations</p>
                  </div>
                ) : (
                  columnEstimations.map((estimation) => (
                    <div
                      key={estimation._id}
                      className={styles.kanbanCard}
                      draggable={column.id === "no_enquiry" ? false : true}
                      onDragStart={(e) => handleDragStart(e, estimation)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => handleCardClick(e, estimation)}
                    >
                      <div className={styles.cardHeader}>
                        <h4 className={styles.cardTitle}>
                          {estimation.name || "Untitled Estimation"}
                        </h4>
                        <span
                          className={`${styles.cardBadge} ${
                            estimation.estimation_type === "quick"
                              ? styles.quickBadge
                              : ""
                          }`}
                        >
                          {estimation.estimation_type === "quick"
                            ? "Quick"
                            : "Detailed"}
                        </span>
                      </div>

                      {/* Client Name */}
                      {estimation.client_name && (
                        <div className={styles.clientInfo}>
                          <div className={styles.clientIcon}>🏢</div>
                          <div className={styles.clientText}>
                            {estimation.client_name}
                          </div>
                        </div>
                      )}

                      {/* User Info */}
                      {estimation.user_name && (
                        <div className={styles.cardInfo}>
                          <div className={styles.infoIcon}>👤</div>
                          <div className={styles.infoText}>
                            <div className={styles.infoLabel}>
                              {estimation.user_name}
                            </div>
                            <div className={styles.infoValue}>
                              {estimation.user_email}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Estimation Details */}
                      <div className={styles.cardDetails}>
                        {estimation.estimation_type === "quick" ? (
                          <>
                            <div className={styles.detailItem}>
                              <span className={styles.detailLabel}>Size:</span>
                              <span className={styles.detailValue}>
                                {estimation.data_size?.toUpperCase()}
                              </span>
                            </div>
                            <div className={styles.detailItem}>
                              <span className={styles.detailLabel}>Weeks:</span>
                              <span className={styles.detailValue}>
                                {estimation.estimated_weeks_min}-
                                {estimation.estimated_weeks_max}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className={styles.detailItem}>
                              <span className={styles.detailLabel}>Type:</span>
                              <span className={styles.detailValue}>
                                {estimation.migration_type}
                              </span>
                            </div>
                            <div className={styles.detailItem}>
                              <span className={styles.detailLabel}>Days:</span>
                              <span className={styles.detailValue}>
                                {Math.round(estimation.total_migration_days || 0)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Footer */}
                      <div className={styles.cardFooter}>
                        <span className={styles.cardDate}>
                          {formatDate(estimation.created_at)}
                        </span>
                        <div className={styles.cardFooterRight}>
                          {estimation.has_enquiry && !estimation.enquiry_read && (
                            <span className={styles.unreadIndicator}>●</span>
                          )}
                          <span className={styles.viewIcon}>👁️</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {selectedCard && (
        <CardDetailModal
          estimation={selectedCard}
          onClose={() => setSelectedCard(null)}
          onArchive={onArchive}
          onStatusChange={() => {
            setSelectedCard(null);
            onStatusUpdate();
          }}
        />
      )}
    </div>
  );
}
