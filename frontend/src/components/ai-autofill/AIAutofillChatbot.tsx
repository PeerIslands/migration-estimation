"use client";

import React, { useState } from "react";
import styles from "./AIAutofillChatbot.module.css";
import CosmosDBExtractor from "./CosmosDBExtractor";

type AutofillOption = "document" | "cosmosdb" | "script" | "manual" | null;

interface AIAutofillChatbotProps {
  onDataExtracted: (data: any) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function AIAutofillChatbot({ onDataExtracted, isCollapsed, onToggleCollapse }: AIAutofillChatbotProps) {
  const [selectedOption, setSelectedOption] = useState<AutofillOption>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Document upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Script output upload state
  const [scriptOutputFile, setScriptOutputFile] = useState<File | null>(null);

  // Manual prompt state
  const [manualPrompt, setManualPrompt] = useState("");

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleDocumentUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file first");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}${process.env.NEXT_PUBLIC_API_V1_PREFIX}/ai-autofill/upload-document`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to process document");
      }

      const result = await response.json();
      setSuccess(result.message);
      
      // Wait a moment to show success message
      setTimeout(() => {
        onDataExtracted(result.data);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process document");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualPrompt = async () => {
    if (!manualPrompt || manualPrompt.trim().length < 20) {
      setError("Please provide at least 20 characters describing your migration");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}${process.env.NEXT_PUBLIC_API_V1_PREFIX}/ai-autofill/manual-prompt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description: manualPrompt,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to generate questionnaire");
      }

      const result = await response.json();
      setSuccess(result.message);
      
      setTimeout(() => {
        onDataExtracted(result.data);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate questionnaire");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadScript = () => {
    // Download the Python script
    const scriptUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL}${process.env.NEXT_PUBLIC_API_V1_PREFIX}/ai-autofill/download-script`;
    const link = document.createElement('a');
    link.href = scriptUrl;
    link.download = 'extract_cosmosdb_metadata.py';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSuccess("Script downloaded! Run it with your CosmosDB connection string and upload the output JSON file.");
  };

  const handleScriptOutputSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.json')) {
        setError("Please upload a JSON file");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }
      setScriptOutputFile(file);
      setError(null);
    }
  };

  const handleScriptOutputUpload = async () => {
    if (!scriptOutputFile) {
      setError("Please select the JSON output file from the script");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", scriptOutputFile);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}${process.env.NEXT_PUBLIC_API_V1_PREFIX}/ai-autofill/upload-script-output`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to process script output");
      }

      const result = await response.json();
      setSuccess(result.message);
      
      setTimeout(() => {
        onDataExtracted(result.data);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process script output");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.chatbot}>
        <div className={styles.header}>
          <h2>AI Assistant</h2>
          <button onClick={onToggleCollapse} className={styles.toggleButton} title={isCollapsed ? "Expand" : "Collapse"}>
            {isCollapsed ? '→' : '←'}
          </button>
        </div>

        {!isCollapsed && (
          <>
            {!selectedOption ? (
              <div className={styles.options}>
                <div className={styles.welcomeMessage}>
                  <p>Hi! I can help you fill the questionnaire automatically. What would you like to do?</p>
                </div>

                <div className={styles.tryAsking}>
                  <p>Try one of these:</p>
                </div>

                <button
                  className={styles.optionButton}
                  onClick={() => setSelectedOption("document")}
                >
                  Upload a document (PDF or TXT)
                </button>

                <button
                  className={styles.optionButton}
                  onClick={() => setSelectedOption("cosmosdb")}
                >
                  Connect to CosmosDB
                </button>

                <button
                  className={styles.optionButton}
                  onClick={() => setSelectedOption("script")}
                >
                  Download & Run Script (No Connection String)
                </button>

                <button
                  className={styles.optionButton}
                  onClick={() => setSelectedOption("manual")}
                >
                  Describe your migration manually
                </button>
              </div>
            ) : (
              <div className={styles.form}>
                <button
                  className={styles.backButton}
                  onClick={() => {
                    setSelectedOption(null);
                    setError(null);
                    setSuccess(null);
                  }}
                >
                  ← Back
                </button>

                {selectedOption === "document" && (
                  <div className={styles.formSection}>
                    <h3>Upload Document</h3>
                    <p>Upload PDF or TXT with migration details.</p>

                <div className={styles.fileUpload}>
                  <input
                    type="file"
                    accept=".pdf,.txt"
                    onChange={handleFileSelect}
                    id="file-upload"
                    className={styles.fileInput}
                  />
                  <label htmlFor="file-upload" className={styles.fileLabel}>
                    {selectedFile ? selectedFile.name : "Choose file (PDF or TXT)"}
                  </label>
                </div>

                {selectedFile && (
                  <div className={styles.fileInfo}>
                    <p>
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                    </p>
                  </div>
                )}

                    <button
                      onClick={handleDocumentUpload}
                      disabled={!selectedFile || isProcessing}
                      className={styles.submitButton}
                    >
                      {isProcessing ? "Processing..." : "Process"}
                    </button>
                  </div>
                )}

                {selectedOption === "cosmosdb" && (
                  <CosmosDBExtractor
                    onDataExtracted={onDataExtracted}
                    onBack={() => {
                      setSelectedOption(null);
                      setError(null);
                      setSuccess(null);
                    }}
                  />
                )}

                {selectedOption === "script" && (
                  <div className={styles.formSection}>
                    <h3>Download & Run Script</h3>
                    <p>Download our data collection script, run it locally, then upload the results.</p>

                    <div className={styles.scriptSteps}>
                      <div className={styles.scriptStep}>
                        <div className={styles.stepNumber}>1</div>
                        <div className={styles.stepContent}>
                          <h4>Download Script</h4>
                          <p>Download the Python script that will collect metadata from your CosmosDB</p>
                          <button
                            onClick={handleDownloadScript}
                            className={styles.downloadButton}
                          >
                            📥 Download Script
                          </button>
                        </div>
                      </div>

                      <div className={styles.scriptStep}>
                        <div className={styles.stepNumber}>2</div>
                        <div className={styles.stepContent}>
                          <h4>Run Script Locally</h4>
                          <p>Run the script with your CosmosDB connection string:</p>
                          <code className={styles.codeBlock}>
                            python extract_cosmosdb_metadata.py "your-connection-string"
                          </code>
                          <p className={styles.note}>This will generate a JSON file with your database metadata</p>
                        </div>
                      </div>

                      <div className={styles.scriptStep}>
                        <div className={styles.stepNumber}>3</div>
                        <div className={styles.stepContent}>
                          <h4>Upload Results</h4>
                          <p>Upload the generated JSON file</p>
                          
                          <div className={styles.fileUpload}>
                            <input
                              type="file"
                              accept=".json"
                              onChange={handleScriptOutputSelect}
                              id="script-output-upload"
                              className={styles.fileInput}
                            />
                            <label htmlFor="script-output-upload" className={styles.fileLabel}>
                              {scriptOutputFile ? scriptOutputFile.name : "Choose JSON file"}
                            </label>
                          </div>

                          {scriptOutputFile && (
                            <div className={styles.fileInfo}>
                              <p>
                                {scriptOutputFile.name} ({(scriptOutputFile.size / 1024).toFixed(2)} KB)
                              </p>
                            </div>
                          )}

                          <button
                            onClick={handleScriptOutputUpload}
                            disabled={!scriptOutputFile || isProcessing}
                            className={styles.submitButton}
                          >
                            {isProcessing ? "Processing..." : "Upload & Process"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedOption === "manual" && (
                  <div className={styles.formSection}>
                    <h3>Manual Description</h3>
                    <p>Describe your migration</p>

                    <div className={styles.inputGroup}>
                      <label className={styles.boldLabel}>Description</label>
                      <textarea
                        placeholder="Example: We need to migrate 3 environments from CosmosDB to MongoDB on AWS. Production has 500GB across 120 collections..."
                        value={manualPrompt}
                        onChange={(e) => setManualPrompt(e.target.value)}
                        className={styles.textarea}
                        rows={6}
                      />
                      <span className={styles.charCount}>
                        {manualPrompt.length} / 20 min
                      </span>
                    </div>

                    <button
                      onClick={handleManualPrompt}
                      disabled={manualPrompt.length < 20 || isProcessing}
                      className={styles.submitButton}
                    >
                      {isProcessing ? "Generating..." : "Generate"}
                    </button>
                  </div>
                )}

                {error && (
                  <div className={styles.error}>
                    {error}
                  </div>
                )}

                {success && (
                  <div className={styles.success}>
                    {success}
                  </div>
                )}

                {isProcessing && (
                  <div className={styles.processing}>
                    <div className={styles.spinner}></div>
                    <p>Processing...</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
