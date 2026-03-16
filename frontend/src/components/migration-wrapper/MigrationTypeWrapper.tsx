"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./MigrationTypeWrapper.module.css";

const COSMOS_MONGO_VALUE = "cosmos-mongodb-api";

export const MIGRATION_OPTIONS = [
  { value: "cosmos-mongodb-api", label: "Cosmos-MongoDB API" },
  { value: "cosmos-sql-api", label: "Cosmos-SQL API" },
  { value: "cosmos-nosql-api", label: "Cosmos-NoSQL API" },
  { value: "documentdb", label: "DocumentDB" },
  { value: "cassandra", label: "Cassandra" },
  { value: "big-query", label: "Big Query" },
  { value: "oracle", label: "Oracle" },
  { value: "sql-server", label: "SQL Server" },
  { value: "azure-sql", label: "Azure SQL" },
  { value: "sybase", label: "Sybase" },
  { value: "ibm-db2", label: "IBM DB2" },
  { value: "marklogic", label: "MarkLogic" },
  { value: "in-memory", label: "In memory Databases" },
];

export default function MigrationTypeWrapper() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const router = useRouter();

  const handleSelect = (value: string) => {
    setSelectedType(value);
    if (value === COSMOS_MONGO_VALUE) {
      router.push("/estimate");
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.hero}>
          <div className={styles.heroIcons}>
            <span className={styles.heroIconLeft}>🗄️</span>
            <span className={styles.heroArrow}>→</span>
            <span className={styles.heroIconRight}>🍃</span>
          </div>
          <h1 className={styles.title}>Migration Estimation</h1>
          <p className={styles.description}>
            Select the type of migration you need. We&apos;ll guide you to the right estimator.
          </p>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="migration-type" className={styles.label}>
            Migration type
          </label>
          <select
            id="migration-type"
            className={styles.select}
            value={selectedType ?? ""}
            onChange={(e) => handleSelect(e.target.value)}
            aria-label="Select migration type"
          >
            <option value="">Choose a technology...</option>
            {MIGRATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {selectedType && selectedType !== COSMOS_MONGO_VALUE && (
          <div className={styles.unavailableMessage} role="alert">
            <span className={styles.unavailableIcon}>ℹ️</span>
            <p>We do not offer that service right now.</p>
            <p className={styles.unavailableSub}>
              Please select <strong>Cosmos-MongoDB API</strong> to get a migration estimate.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
