"use client";

import React, { useState, useEffect } from "react";
import { getInactivityReminders } from "@/lib/api";
import { useRouter } from "next/navigation";
import styles from "./RemindersView.module.css";

interface Reminder {
  _id: string;
  name?: string;
  client_name?: string;
  user_name?: string;
  user_email?: string;
  user_company?: string;
  lead_status?: string;
  days_inactive: number;
  last_updated?: string;
}

export default function RemindersView({ onClose }: { onClose: () => void }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadReminders();
  }, []);

  const loadReminders = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getInactivityReminders();
      setReminders(data);
    } catch (err) {
      console.error("Error loading reminders:", err);
      setError(err instanceof Error ? err.message : "Failed to load reminders");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
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
      default:
        return status || "Unknown";
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
      default:
        return "";
    }
  };

  const handleViewEstimation = (reminderId: string) => {
    onClose();
    router.push(`/admin?highlight=${reminderId}`);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Inactivity Reminders</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Loading reminders...</p>
            </div>
          ) : error ? (
            <div className={styles.error}>
              <p>{error}</p>
            </div>
          ) : reminders.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>✓</div>
              <h3 className={styles.emptyTitle}>All Caught Up!</h3>
              <p className={styles.emptyMessage}>
                No estimations require attention at this time.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.summary}>
                <p className={styles.summaryText}>
                  {reminders.length} estimation{reminders.length !== 1 ? 's' : ''} with 15+ days of inactivity
                </p>
              </div>

              <div className={styles.remindersList}>
                {reminders.map((reminder) => (
                  <div key={reminder._id} className={styles.reminderCard}>
                    <div className={styles.reminderHeader}>
                      <div className={styles.reminderInfo}>
                        <h4 className={styles.reminderTitle}>
                          {reminder.client_name || reminder.user_name || "Unknown User"}
                        </h4>
                        {reminder.user_company && (
                          <span className={styles.companyName}>{reminder.user_company}</span>
                        )}
                      </div>
                      <div className={styles.inactivityBadge}>
                        {reminder.days_inactive} days
                      </div>
                    </div>

                    <div className={styles.reminderDetails}>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Status:</span>
                        <span className={`${styles.statusBadge} ${getStatusClass(reminder.lead_status)}`}>
                          {getStatusLabel(reminder.lead_status)}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Last Update:</span>
                        <span className={styles.detailValue}>{formatDate(reminder.last_updated)}</span>
                      </div>
                      {reminder.user_email && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Email:</span>
                          <span className={styles.detailValue}>{reminder.user_email}</span>
                        </div>
                      )}
                    </div>

                    <button
                      className={styles.viewButton}
                      onClick={() => handleViewEstimation(reminder._id)}
                    >
                      View Estimation →
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
