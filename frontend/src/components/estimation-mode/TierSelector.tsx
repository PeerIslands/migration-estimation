"use client";

import React, { useState, useEffect } from "react";
import { getTierEstimates } from "@/lib/api";
import styles from "./EstimationModeSelector.module.css";

export type DataSize = "simple" | "medium" | "complex";

interface TierSelectorProps {
  onTierSelected: (dataSize: DataSize) => void;
  onCancel: () => void;
}

export default function TierSelector({ onTierSelected, onCancel }: TierSelectorProps) {
  const [tierData, setTierData] = useState<any>(null);

  useEffect(() => {
    const loadTierData = async () => {
      try {
        const data = await getTierEstimates();
        setTierData(data);
      } catch (error) {
        console.error("Failed to load tier data:", error);
      }
    };
    loadTierData();
  }, []);

  const dataSizeTiers = React.useMemo(() => {
    if (tierData?.tiers) {
      return Object.entries(tierData.tiers).map(([size, tier]: [string, any]) => ({
        size: size as DataSize,
        title: size.charAt(0).toUpperCase() + size.slice(1), // "simple" -> "Simple"
        description: tier.description,
      }));
    }

    // Fallback defaults (should rarely be used as API loads first)
    return [
      {
        size: "simple" as DataSize,
        title: "Simple",
        description: "Straightforward migration with up to 250GB data",
      },
      {
        size: "medium" as DataSize,
        title: "Medium",
        description: "Moderate complexity migration with up to 2TB data",
      },
      {
        size: "complex" as DataSize,
        title: "Complex",
        description: "Advanced migration with over 2TB data",
      },
    ];
  }, [tierData]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Select Your Data Size</h1>
        <p className={styles.subtitle}>
          Choose the tier that best matches your migration scope
        </p>

        <button onClick={onCancel} className={styles.backButton}>
          ← Back
        </button>

        <h2 className={styles.sectionTitle}>Data Size Tiers</h2>
        <p className={styles.sectionDescription}>
          Select the tier that matches your total data size
        </p>

        <div className={styles.tierCards}>
          {dataSizeTiers.map((tier) => (
            <button
              key={tier.size}
              onClick={() => onTierSelected(tier.size)}
              className={styles.tierCard}
            >
              <div className={styles.tierHeader}>
                <h3 className={styles.tierTitle}>{tier.title}</h3>
                <p className={styles.tierDescription}>{tier.description}</p>
              </div>
            </button>
          ))}
        </div>

        <div className={styles.tierDisclaimer}>
          <p>Note: Estimates are for up to 50 collections and 10 databases</p>
        </div>
      </div>
    </div>
  );
}
