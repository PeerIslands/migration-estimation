"use client";

import React, { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import ArchivedEstimationsView from "@/components/admin/ArchivedEstimationsView";
import styles from "../AdminDashboard.module.css";

export default function ArchivedPage() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  // Check if user is admin (with delay to allow zustand persist rehydration)
  useEffect(() => {
    // Give zustand persist time to rehydrate from localStorage
    const timer = setTimeout(() => {
      setIsAuthChecked(true);
      if (!isAuthenticated || user?.role !== "admin") {
        router.push("/");
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isAuthenticated, user, router]);

  // Check for explicit navigation - allow since archived is a sub-page of admin
  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") return;

    const navigationType = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type;
    const hasExplicitAccess = sessionStorage.getItem("admin_access_allowed") === "true";
    
    // Archived page is allowed if admin access is allowed
    // This page is accessed from within admin dashboard
    if (navigationType === "back_forward" && !hasExplicitAccess) {
      console.log("Back button detected on archived page - redirecting to home");
      router.replace("/");
    }
  }, [isAuthenticated, user, router]);

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
          <h1 className={styles.title}>Archived Estimations</h1>
          <p className={styles.subtitle}>View and manage archived migration estimations</p>
        </div>
        <div className={styles.headerActions}>
          <button
            onClick={() => router.push("/admin")}
            className={styles.backButton}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      {/* Content */}
      <ArchivedEstimationsView />
    </div>
  );
}
