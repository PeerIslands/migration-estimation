"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { getRules, updateRules, getWeights, getAssumptions } from "@/lib/api";
import styles from "./AdminDashboard.module.css";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"rules" | "weights" | "assumptions">("rules");
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Check if user is admin
  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      router.push("/");
    }
  }, [isAuthenticated, user, router]);

  // Load content when tab changes
  useEffect(() => {
    loadContent();
  }, [activeTab]);

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
      } else {
        response = await getAssumptions();
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
    if (activeTab !== "rules") {
      setError("Only rules.yaml can be edited at this time");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await updateRules(content);
      setOriginalContent(content);
      setHasChanges(false);
      setSuccessMessage(response.message);
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
        <button
          onClick={() => router.push("/")}
          className={styles.backButton}
        >
          ← Back to Home
        </button>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "rules" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("rules")}
        >
          Rules (Editable)
        </button>
        <button
          className={`${styles.tab} ${activeTab === "weights" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("weights")}
        >
          Weights (View Only)
        </button>
        <button
          className={`${styles.tab} ${activeTab === "assumptions" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("assumptions")}
        >
          Assumptions (View Only)
        </button>
      </div>

      {/* Content Area */}
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
            {activeTab === "rules" && (
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
              readOnly={activeTab !== "rules"}
              spellCheck={false}
              placeholder="YAML content..."
            />
            {activeTab !== "rules" && (
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
          {activeTab === "rules" && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>💡 Tip:</span>
              <span className={styles.infoValue}>
                A backup is automatically created when you save changes
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
