"use client";

import React, { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import FormRenderer from "@/components/main/index";
import AuthModal from "@/components/auth/AuthModal";
import UserMenu from "@/components/auth/UserMenu";
import type { FormConfig } from "@/components/utils/types";
import formConfig from "@/components/metadata/form.json" assert { type: "json" };
import styles from "./HomeClient.module.css";

export default function HomeClient() {
  const { isAuthenticated } = useAuthStore();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const config = formConfig as FormConfig;

  // Show auth modal if not authenticated
  if (!isAuthenticated && !showAuthModal) {
    return (
      <div className={styles.getStartedContainer}>
        <div className={styles.getStartedCard}>
          <h1 className={styles.getStartedTitle}>
            Migration Estimation Tool
          </h1>
          <p className={styles.getStartedDescription}>
            Please sign in to access the migration estimation questionnaire and save your results.
          </p>
          <div className={styles.getStartedButtonGroup}>
            <button
              onClick={() => setShowAuthModal(true)}
              className={styles.getStartedButton}
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showAuthModal && !isAuthenticated) {
    return <AuthModal onClose={() => setShowAuthModal(false)} />;
  }

  return (
    <div>
      {/* Header with User Menu */}
      <div className={styles.headerContainer}>
        <UserMenu />
      </div>

      {/* Main Content */}
      <div className={styles.mainContainer}>
        <FormRenderer config={config} />
      </div>
    </div>
  );
}
