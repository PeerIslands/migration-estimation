"use client";

import React from "react";
import styles from "./QuickEstimateResults.module.css";
import type { DataSize } from "./EstimationModeSelector";

interface QuickEstimate {
  dataSize: DataSize;
  estimatedWeeks: { min: number; max: number };
  estimatedCost: { min: number; max: number };
  breakdown: {
    planning: string;
    migration: string;
    testing: string;
    deployment: string;
  };
  keyConsiderations: string[];
}

interface QuickEstimateResultsProps {
  estimate: QuickEstimate;
  onStartDetailedEstimate: () => void;
  onReset: () => void;
  userInfo?: {
    name?: string;
    email?: string;
    designation?: string;
    company?: string;
  };
}

export default function QuickEstimateResults({
  estimate,
  onStartDetailedEstimate,
  onReset,
  userInfo,
}: QuickEstimateResultsProps) {
  const dataSizeLabels = {
    simple: "Simple (Up to 250GB)",
    medium: "Medium (Up to 2TB)",
    complex: "Complex (Over 2TB)",
  };

  // Convert weeks to days (1 week = 5 business days)
  const estimatedDays = {
    min: estimate.estimatedWeeks.min * 5,
    max: estimate.estimatedWeeks.max * 5,
  };

  // Note: Quick estimation is saved in the parent component (HomeClient)
  // when the estimate is generated, not when this component mounts

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.badge}>Quick Estimate</div>
          <h1 className={styles.title}>Your Ballpark Estimate</h1>
          <p className={styles.subtitle}>
            Based on {dataSizeLabels[estimate.dataSize]} data size
          </p>
        </div>

        <div className={styles.mainMetrics}>
          <div className={styles.metric}>
            <div className={styles.metricIcon}>📅</div>
            <div className={styles.metricContent}>
              <div className={styles.metricLabel}>Estimated Timeline</div>
              <div className={styles.metricValue}>
                {estimatedDays.min}-{estimatedDays.max} days
              </div>
            </div>
          </div>

          <div className={styles.metric}>
            <div className={styles.metricIcon}>💰</div>
            <div className={styles.metricContent}>
              <div className={styles.metricLabel}>Estimated Cost Range</div>
              <div className={styles.metricValue}>
                ${estimate.estimatedCost.min.toLocaleString()} - $
                {estimate.estimatedCost.max.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.breakdown}>
          <h2 className={styles.sectionTitle}>Project Breakdown</h2>
          <div className={styles.breakdownGrid}>
            <div className={styles.breakdownItem}>
              <div className={styles.breakdownLabel}>
                <span className={styles.breakdownIcon}>📋</span>
                Planning & Analysis
              </div>
              <div className={styles.breakdownValue}>{estimate.breakdown.planning}</div>
            </div>
            <div className={styles.breakdownItem}>
              <div className={styles.breakdownLabel}>
                <span className={styles.breakdownIcon}>🔄</span>
                Data Migration
              </div>
              <div className={styles.breakdownValue}>{estimate.breakdown.migration}</div>
            </div>
            <div className={styles.breakdownItem}>
              <div className={styles.breakdownLabel}>
                <span className={styles.breakdownIcon}>🧪</span>
                Testing & Validation
              </div>
              <div className={styles.breakdownValue}>{estimate.breakdown.testing}</div>
            </div>
            <div className={styles.breakdownItem}>
              <div className={styles.breakdownLabel}>
                <span className={styles.breakdownIcon}>🚀</span>
                Deployment & Support
              </div>
              <div className={styles.breakdownValue}>{estimate.breakdown.deployment}</div>
            </div>
          </div>
        </div>

        <div className={styles.considerations}>
          <h2 className={styles.sectionTitle}>Key Considerations</h2>
          <ul className={styles.considerationsList}>
            {estimate.keyConsiderations.map((consideration, idx) => (
              <li key={idx} className={styles.considerationItem}>
                {consideration}
              </li>
            ))}
            {/* Add common reference info if not already in considerations */}
            {!estimate.keyConsiderations.some(c => c.toLowerCase().includes('collections') && c.toLowerCase().includes('databases')) && (
              <li className={styles.considerationItem}>
                Supports up to 50 collections across up to 10 databases
              </li>
            )}
          </ul>
        </div>

        <div className={styles.disclaimer}>
          <strong>⚠️ Note:</strong> This is a rough estimate based on typical migrations
          of this data size. For a more accurate estimate tailored to your specific
          requirements, we recommend completing the detailed questionnaire.
        </div>

        <div className={styles.actions}>
          <button className={styles.secondaryButton} onClick={onReset}>
            Start Over
          </button>
          <button className={styles.primaryButton} onClick={onStartDetailedEstimate}>
            Get Detailed Estimate
          </button>
        </div>
      </div>
    </div>
  );
}
