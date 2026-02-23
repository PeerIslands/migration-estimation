"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { getRules, updateRules, getWeights, getAssumptions, updateAssumptions, getTierEstimatesRaw, updateTierEstimatesRaw, getAllEstimationsAdmin, getInactivityReminders } from "@/lib/api";
import AllEstimationsView from "@/components/admin/AllEstimationsView";
import EnquiriesView from "@/components/admin/EnquiriesView";
import RemindersView from "@/components/admin/RemindersView";
import styles from "./AdminDashboard.module.css";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"rules" | "weights" | "assumptions" | "tiers" | "estimations">("estimations");
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  const [showEnquiries, setShowEnquiries] = useState(false);
  const [reminderCount, setReminderCount] = useState(0);
  const [showReminders, setShowReminders] = useState(false);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  // Check for explicit navigation - redirect if accessed via back button
  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") return;

    // Check if this is a history navigation (back button) vs explicit navigation
    const navigationType = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type;
    const hasExplicitAccess = sessionStorage.getItem("admin_access_allowed") === "true";
    
    console.log("Admin access check:", { navigationType, hasExplicitAccess });
    
    // If accessed via back_forward and no explicit access flag, redirect to home
    if (navigationType === "back_forward" && !hasExplicitAccess) {
      console.log("Back button detected - redirecting to home");
      sessionStorage.removeItem("admin_access_allowed");
      router.replace("/");
      return;
    }
    
    // If this is a normal navigation (reload or explicit), allow it
    if (navigationType === "reload" || navigationType === "navigate") {
      // Keep the access flag active for refreshes
      sessionStorage.setItem("admin_access_allowed", "true");
    }
  }, [isAuthenticated, user, router]);

  // Load new leads count
  useEffect(() => {
    const loadNewLeadsCount = async () => {
      try {
        const estimations = await getAllEstimationsAdmin();
        const newLeads = estimations.filter(e => e.has_enquiry && e.lead_status === "new");
        setNewLeadsCount(newLeads.length);
      } catch (error) {
        // Silently fail - user might not be logged in or session expired
        // Don't spam console with errors
      }
    };

    loadNewLeadsCount();
    // Poll every 30 seconds
    const interval = setInterval(loadNewLeadsCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load inactivity reminders count
  useEffect(() => {
    const loadRemindersCount = async () => {
      try {
        const reminders = await getInactivityReminders();
        setReminderCount(reminders.length);
      } catch (error) {
        // Silently fail
      }
    };

    loadRemindersCount();
    // Poll every 5 minutes (reminders don't change as frequently)
    const interval = setInterval(loadRemindersCount, 300000);
    return () => clearInterval(interval);
  }, []);

  // Load content when tab changes (only for YAML tabs)
  useEffect(() => {
    if (activeTab !== "estimations") {
      loadContent();
    }
  }, [activeTab]);

  // Check if user is admin (with delay to allow zustand persist rehydration)
  useEffect(() => {
    // Give zustand persist time to rehydrate from localStorage
    const timer = setTimeout(() => {
      setIsAuthChecked(true);
      if (!isAuthenticated || user?.role !== "admin") {
        sessionStorage.removeItem("admin_access_allowed");
        router.push("/");
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isAuthenticated, user, router]);

  const loadContent = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      let response;
      if (activeTab === "rules") {
        response = await getRules();
      } else if (activeTab === "weights") {
        response = await getWeights();
      } else if (activeTab === "tiers") {
        response = await getTierEstimatesRaw();
      } else if (activeTab === "assumptions") {
        response = await getAssumptions();
      } else {
        // For estimations tab, no need to load content
        setIsLoading(false);
        return;
      }
      
      setContent(response.content);
      setOriginalContent(response.content);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load content");
    } finally {
      setIsLoading(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(newContent !== originalContent);
    setSuccessMessage(null);
  };

  const handleSave = async () => {
    if (activeTab !== "rules" && activeTab !== "tiers" && activeTab !== "assumptions") {
      setError("Only rules.yaml, tier_estimates.yaml, and assumptions.yaml can be edited");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      let response;
      if (activeTab === "rules") {
        response = await updateRules(content);
        setSuccessMessage(response.message);
      } else if (activeTab === "tiers") {
        response = await updateTierEstimatesRaw(content);
        setSuccessMessage(response.message);
      } else if (activeTab === "assumptions") {
        response = await updateAssumptions(content);
        setSuccessMessage(response.message);
      }
      setOriginalContent(content);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setContent(originalContent);
    setHasChanges(false);
    setSuccessMessage(null);
    setError(null);
  };

  // Show loading while checking auth on initial mount
  if (!isAuthChecked) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return null;
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Admin Dashboard</h1>
          <p className={styles.subtitle}>Manage migration rules and configuration</p>
        </div>
        <div className={styles.headerActions}>
          <button 
            className={styles.notificationButton}
            onClick={() => {
              setShowReminders(!showReminders);
              setShowEnquiries(false);
            }}
            title={`${reminderCount} inactivity reminder${reminderCount === 1 ? '' : 's'}`}
          >
            <span className={styles.inboxIcon}>📥</span>
            {reminderCount > 0 && (
              <span className={styles.notificationDot}>{reminderCount}</span>
            )}
          </button>
          <button 
            className={styles.notificationButton}
            onClick={() => {
              setShowEnquiries(!showEnquiries);
              setShowReminders(false);
            }}
            title={`${newLeadsCount} new lead${newLeadsCount === 1 ? '' : 's'}`}
          >
            <span className={styles.bellIcon}>🔔</span>
            {newLeadsCount > 0 && (
              <span className={styles.notificationDot}>{newLeadsCount}</span>
            )}
          </button>
          <button
            className={styles.archiveButton}
            onClick={() => router.push("/admin/archived")}
            title="View Archived Estimations"
          >
            <span className={styles.archiveIcon}>📦</span>
            <span>Archived</span>
          </button>
          <button
            onClick={() => {
              sessionStorage.removeItem("admin_access_allowed");
              router.replace("/");
            }}
            className={styles.backButton}
          >
            ← Back to Home
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "estimations" ? styles.tabActive : ""}`}
          onClick={() => { setActiveTab("estimations"); setShowEnquiries(false); }}
        >
          All Estimations
        </button>
        <button
          className={`${styles.tab} ${activeTab === "rules" ? styles.tabActive : ""}`}
          onClick={() => { setActiveTab("rules"); setShowEnquiries(false); }}
        >
          Rules (Editable)
        </button>
        <button
          className={`${styles.tab} ${activeTab === "tiers" ? styles.tabActive : ""}`}
          onClick={() => { setActiveTab("tiers"); setShowEnquiries(false); }}
        >
          Tier Estimates (Editable)
        </button>
        <button
          className={`${styles.tab} ${activeTab === "assumptions" ? styles.tabActive : ""}`}
          onClick={() => { setActiveTab("assumptions"); setShowEnquiries(false); }}
        >
          Assumptions (Editable)
        </button>
        <button
          className={`${styles.tab} ${activeTab === "weights" ? styles.tabActive : ""}`}
          onClick={() => { setActiveTab("weights"); setShowEnquiries(false); }}
        >
          Weights (View Only)
        </button>
      </div>

      {/* Content Area */}
      {showReminders ? (
        <RemindersView onClose={() => {
          setShowReminders(false);
          // Reload reminders count
          getInactivityReminders().then(reminders => {
            setReminderCount(reminders.length);
          }).catch(() => {
            // Silently fail
          });
        }} />
      ) : showEnquiries ? (
        <EnquiriesView onEnquiryRead={() => {
          // Reload new leads count when status changes
          getAllEstimationsAdmin().then(estimations => {
            const newLeads = estimations.filter(e => e.has_enquiry && e.lead_status === "new");
            setNewLeadsCount(newLeads.length);
          }).catch(() => {
            // Silently fail
          });
        }} />
      ) : activeTab === "estimations" ? (
        <AllEstimationsView />
      ) : (
        <div className={styles.content}>
          {/* Toolbar */}
          <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <span className={styles.fileName}>
              {activeTab}.yaml
            </span>
            {hasChanges && (
              <span className={styles.changesIndicator}>● Unsaved changes</span>
            )}
          </div>
          <div className={styles.toolbarRight}>
            {(activeTab === "rules" || activeTab === "tiers" || activeTab === "assumptions") && (
              <>
                <button
                  onClick={handleReset}
                  className={styles.resetButton}
                  disabled={!hasChanges || isSaving}
                >
                  Reset
                </button>
                <button
                  onClick={handleSave}
                  className={styles.saveButton}
                  disabled={!hasChanges || isSaving}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className={styles.errorMessage} role="alert">
            {error}
          </div>
        )}
        {successMessage && (
          <div className={styles.successMessage} role="alert">
            {successMessage}
          </div>
        )}

        {/* Editor */}
        {isLoading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <div className={styles.editorWrapper}>
            <textarea
              className={styles.editor}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              readOnly={activeTab === "weights"}
              spellCheck={false}
              placeholder="YAML content..."
            />
            {activeTab === "weights" && (
              <div className={styles.readOnlyBadge}>
                Read Only
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className={styles.info}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Lines:</span>
            <span className={styles.infoValue}>{content.split('\n').length}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Characters:</span>
            <span className={styles.infoValue}>{content.length}</span>
          </div>
          {(activeTab === "rules" || activeTab === "tiers" || activeTab === "assumptions") && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>💡 Tip:</span>
              <span className={styles.infoValue}>
                {activeTab === "rules" 
                  ? "A backup is automatically created when you save changes"
                  : activeTab === "tiers"
                  ? "Changes affect the quick ballpark estimates shown to users"
                  : "Changes affect the default assumptions used in detailed estimates"
                }
              </span>
            </div>
          )}
        </div>
        </div>
      )}
    </div>
  );
}
