"use client";

import React from "react";
import styles from "./EstimationModeSelector.module.css";

export type DataSize = "simple" | "medium" | "complex";

interface EstimationModeSelectorProps {
  onModeSelected: (mode: "quick" | "detailed") => void;
  clientName: string;
  onClientNameChange: (name: string) => void;
  showError?: boolean;
}

export default function EstimationModeSelector({ onModeSelected, clientName, onClientNameChange, showError }: EstimationModeSelectorProps) {

  const handleModeClick = (mode: "quick" | "detailed") => {
    if (!clientName.trim()) {
      // Don't proceed if client name is empty
      return;
    }
    onModeSelected(mode);
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Migration Estimation Tool</h1>
        <p className={styles.subtitle}>
          Choose how you'd like to get your migration estimate
        </p>

        {/* Client Name Input */}
        <div className={styles.clientNameBox}>
          <label htmlFor="client-name" className={styles.clientNameLabel}>
            Client / Project Name <span className={styles.required}>*</span>
          </label>
          <input
            id="client-name"
            type="text"
            value={clientName}
            onChange={(e) => onClientNameChange(e.target.value)}
            placeholder="Enter client or project name"
            className={`${styles.clientNameInput} ${showError ? styles.inputError : ''}`}
            required
          />
          {showError && (
            <p className={styles.errorMessage}>Client name is required</p>
          )}
        </div>

        <div className={styles.modeOptions}>
          <button
            className={`${styles.modeCard} ${!clientName.trim() ? styles.modeCardDisabled : ''}`}
            onClick={() => handleModeClick("quick")}
            type="button"
          >
            <div className={styles.modeIcon}>⚡</div>
            <h2 className={styles.modeTitle}>Quick Estimate</h2>
            <p className={styles.modeDescription}>
              Get a rapid estimate based on data size tiers. Perfect if you don't have detailed information yet.
            </p>
            <div className={styles.modeFeatures}>
              <span className={styles.feature}>✓ Takes 30 seconds</span>
              <span className={styles.feature}>✓ No technical details needed</span>
              <span className={styles.feature}>✓ Approximate timeline & cost</span>
            </div>
          </button>

          <button
            className={`${styles.modeCard} ${!clientName.trim() ? styles.modeCardDisabled : ''}`}
            onClick={() => handleModeClick("detailed")}
            type="button"
          >
            <div className={styles.modeIcon}>📋</div>
            <h2 className={styles.modeTitle}>Detailed Estimation</h2>
            <p className={styles.modeDescription}>
              Fill out a comprehensive form for an accurate, tailored estimate of your migration.
            </p>
            <div className={styles.modeFeatures}>
              <span className={styles.feature}>✓ Accurate pricing</span>
              <span className={styles.feature}>✓ Detailed timeline</span>
              <span className={styles.feature}>✓ Custom recommendations</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
