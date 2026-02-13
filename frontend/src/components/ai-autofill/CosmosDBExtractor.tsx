"use client";

import React, { useState } from "react";
import styles from "./CosmosDBExtractor.module.css";

type Step = "connect" | "group" | "define";
type GroupingMode = "each" | "manual";

interface Database {
  name: string;
  num_containers: number;
  estimated_size_gb?: number;
  note?: string;
}

interface EnvironmentGroup {
  environment_name: string;
  databases: string[];
}

interface CosmosDBExtractorProps {
  onDataExtracted: (data: any) => void;
  onBack: () => void;
}

export default function CosmosDBExtractor({ onDataExtracted, onBack }: CosmosDBExtractorProps) {
  const [step, setStep] = useState<Step>("connect");
  const [connectionString, setConnectionString] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Discovery results
  const [databases, setDatabases] = useState<Database[]>([]);
  
  // Grouping
  const [groupingMode, setGroupingMode] = useState<GroupingMode>("manual");
  const [numEnvironments, setNumEnvironments] = useState(1);
  const [environments, setEnvironments] = useState<EnvironmentGroup[]>([
    { environment_name: "production", databases: [] }
  ]);

  const handleDiscover = async () => {
    if (!connectionString) {
      setError("Please provide a connection string");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}${process.env.NEXT_PUBLIC_API_V1_PREFIX}/ai-autofill/cosmosdb/discover`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connection_string: connectionString }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to discover databases");
      }

      const result = await response.json();
      setDatabases(result.databases);
      setSuccess(result.message);
      setStep("group");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to discover databases");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGroupingChoice = (mode: GroupingMode) => {
    setGroupingMode(mode);
    
    if (mode === "each") {
      // Each database = separate environment
      setNumEnvironments(databases.length);
      setEnvironments(
        databases.map(db => ({
          environment_name: db.name,
          databases: [db.name]
        }))
      );
      // Skip to extraction
      handleExtract(databases.map(db => ({
        environment_name: db.name,
        databases: [db.name]
      })));
    } else {
      // Manual grouping
      setStep("define");
    }
  };

  const updateEnvironmentCount = (count: number) => {
    const newCount = Math.max(1, Math.min(count, databases.length));
    setNumEnvironments(newCount);
    
    const newEnvs = [...environments];
    while (newEnvs.length < newCount) {
      newEnvs.push({
        environment_name: `environment-${newEnvs.length + 1}`,
        databases: []
      });
    }
    while (newEnvs.length > newCount) {
      newEnvs.pop();
    }
    setEnvironments(newEnvs);
  };

  const updateEnvironmentName = (index: number, name: string) => {
    const newEnvs = [...environments];
    newEnvs[index].environment_name = name;
    setEnvironments(newEnvs);
  };

  const toggleDatabase = (envIndex: number, dbName: string) => {
    const newEnvs = [...environments];
    const databases = newEnvs[envIndex].databases;
    
    if (databases.includes(dbName)) {
      newEnvs[envIndex].databases = databases.filter(d => d !== dbName);
    } else {
      newEnvs[envIndex].databases = [...databases, dbName];
    }
    
    setEnvironments(newEnvs);
  };

  const getEnvTotals = (envIndex: number) => {
    const selectedDbs = environments[envIndex].databases;
    const dbData = databases.filter(db => selectedDbs.includes(db.name));
    
    const totalContainers = dbData.reduce((sum, db) => sum + db.num_containers, 0);
    const totalDbs = dbData.length;
    
    return { totalContainers, totalDbs };
  };

  const handleExtract = async (groupsToExtract?: EnvironmentGroup[]) => {
    const groups = groupsToExtract || environments;
    
    // Validate
    const hasEmptyEnv = groups.some(env => env.databases.length === 0);
    if (hasEmptyEnv) {
      setError("Each environment must have at least one database selected");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}${process.env.NEXT_PUBLIC_API_V1_PREFIX}/ai-autofill/cosmosdb/extract`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connection_string: connectionString,
            environment_groups: groups
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to extract data");
      }

      const result = await response.json();
      setSuccess(result.message);
      
      setTimeout(() => {
        onDataExtracted(result.data);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract data");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {step === "connect" && (
        <div className={styles.step}>
          <h3>Connect to CosmosDB</h3>
          <p>Enter your CosmosDB connection string to discover all databases.</p>

          <div className={styles.inputGroup}>
            <label>Connection String</label>
            <textarea
              placeholder="AccountEndpoint=https://myaccount.documents.azure.com:443/;AccountKey=..."
              value={connectionString}
              onChange={(e) => setConnectionString(e.target.value)}
              className={styles.textarea}
              rows={3}
            />
            <span className={styles.helpText}>
              Get from: Azure Portal → CosmosDB Account → Keys → PRIMARY CONNECTION STRING
            </span>
          </div>

          <button
            onClick={handleDiscover}
            disabled={!connectionString || isLoading}
            className={styles.primaryButton}
          >
            {isLoading ? "Discovering..." : "Discover Databases"}
          </button>
        </div>
      )}

      {step === "group" && (
        <div className={styles.step}>
          <h3>Found {databases.length} Database{databases.length !== 1 ? 's' : ''}</h3>
          
          <div className={styles.databaseList}>
            {databases.map(db => (
              <div key={db.name} className={styles.databaseCard}>
                <span className={styles.dbName}>{db.name}</span>
                <span className={styles.dbInfo}>{db.num_containers} collections</span>
              </div>
            ))}
          </div>

          <div className={styles.groupingChoice}>
            <p>How should we group these for migration?</p>
            
            <label className={styles.radioLabel}>
              <input
                type="radio"
                checked={groupingMode === "each"}
                onChange={() => setGroupingMode("each")}
              />
              <span>Each database = separate environment ({databases.length} environments)</span>
            </label>
            
            <label className={styles.radioLabel}>
              <input
                type="radio"
                checked={groupingMode === "manual"}
                onChange={() => setGroupingMode("manual")}
              />
              <span>Group databases by environment (recommended)</span>
            </label>
          </div>

          <button
            onClick={() => handleGroupingChoice(groupingMode)}
            className={styles.primaryButton}
          >
            Continue
          </button>
        </div>
      )}

      {step === "define" && (
        <div className={styles.step}>
          <h3>Define Environments</h3>
          
          <div className={styles.envCountControl}>
            <label>How many environments?</label>
            <div className={styles.counter}>
              <button onClick={() => updateEnvironmentCount(numEnvironments - 1)}>-</button>
              <span>{numEnvironments}</span>
              <button onClick={() => updateEnvironmentCount(numEnvironments + 1)}>+</button>
            </div>
          </div>

          <div className={styles.environmentsList}>
            {environments.map((env, idx) => {
              const totals = getEnvTotals(idx);
              return (
                <div key={idx} className={styles.envCard}>
                  <h4>Environment {idx + 1}</h4>
                  
                  <div className={styles.inputGroup}>
                    <label>Name</label>
                    <input
                      type="text"
                      value={env.environment_name}
                      onChange={(e) => updateEnvironmentName(idx, e.target.value)}
                      placeholder="e.g., production, staging"
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.databaseSelection}>
                    <label>Select databases:</label>
                    {databases.map(db => (
                      <label key={db.name} className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={env.databases.includes(db.name)}
                          onChange={() => toggleDatabase(idx, db.name)}
                        />
                        <span>{db.name} ({db.num_containers} collections)</span>
                      </label>
                    ))}
                  </div>

                  <div className={styles.envTotals}>
                    Totals: {totals.totalContainers} collections, {totals.totalDbs} database{totals.totalDbs !== 1 ? 's' : ''}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => handleExtract()}
            disabled={isLoading}
            className={styles.primaryButton}
          >
            {isLoading ? "Extracting..." : "Extract & Populate Form"}
          </button>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}
      
      {isLoading && (
        <div className={styles.processing}>
          <div className={styles.spinner}></div>
          <p>Processing...</p>
        </div>
      )}
    </div>
  );
}
