"use client";

import React, { useState, useEffect } from "react";
import { getTierEstimates } from "@/lib/api";
import styles from "./EstimationModeSelector.module.css";

export type DataSize = "simple" | "medium" | "complex";

interface TierSelectorProps {
  onTierSelected: (dataSize: DataSize) => void;
  onCancel: () => void;
}

const tierMeta: Record<DataSize, { icon: string; accentClass: string; dataRange: string; complexity: number }> = {
  simple: {
    icon: "📦",
    accentClass: styles.tierCardSimple,
    dataRange: "Up to 250 GB",
    complexity: 1,
  },
  medium: {
    icon: "🗄️",
    accentClass: styles.tierCardMedium,
    dataRange: "Up to 2 TB",
    complexity: 2,
  },
  complex: {
    icon: "🏗️",
    accentClass: styles.tierCardComplex,
    dataRange: "2 TB+",
    complexity: 3,
  },
};

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
        title: size.charAt(0).toUpperCase() + size.slice(1),
        description: tier.description,
      }));
    }

    return [
      {
        size: "simple" as DataSize,
        title: "Simple",
        description: "Straight-forward migration with up to 250GB data",
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
          {dataSizeTiers.map((tier) => {
            const meta = tierMeta[tier.size];
            return (
              <button
                key={tier.size}
                onClick={() => onTierSelected(tier.size)}
                className={`${styles.tierCard} ${meta.accentClass}`}
              >
                <div className={styles.tierIconWrapper}>
                  <span className={styles.tierIcon}>{meta.icon}</span>
                </div>
                <div className={styles.tierHeader}>
                  <h3 className={styles.tierTitle}>{tier.title}</h3>
                  <span className={styles.tierDataRange}>{meta.dataRange}</span>
                  <p className={styles.tierDescription}>{tier.description}</p>
                </div>
                <div className={styles.tierComplexity}>
                  <span className={styles.complexityLabel}>Complexity</span>
                  <div className={styles.complexityDots}>
                    {[1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={`${styles.complexityDot} ${i <= meta.complexity ? styles.complexityDotActive : ""}`}
                      />
                    ))}
                  </div>
                </div>
                <ul className={styles.tierBullets}>
                  <li>Supports up to 50 collections across up to 10 databases</li>
                  <li>Estimate is for up to 3 environments</li>
                </ul>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
