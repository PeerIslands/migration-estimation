"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useFormStore } from "@/components/store/formStore";
import FormRenderer from "@/components/main/index";
import AuthModal from "@/components/auth/AuthModal";
import UserMenu from "@/components/auth/UserMenu";
import EstimationModeSelector from "@/components/estimation-mode/EstimationModeSelector";
import QuickEstimateResults from "@/components/estimation-mode/QuickEstimateResults";
import UserInfoForm from "@/components/estimation-mode/UserInfoForm";
import TierSelector from "@/components/estimation-mode/TierSelector";
import type { FormConfig } from "@/components/utils/types";
import type { DataSize } from "@/components/estimation-mode/EstimationModeSelector";
import { getTierEstimates, saveEstimation } from "@/lib/api";
import formConfig from "@/components/metadata/form.json" assert { type: "json" };
import styles from "./HomeClient.module.css";

type EstimationMode = "quick" | "detailed" | null;

interface UserInfo {
  name: string;
  email: string;
  designation: string;
  company: string;
}

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

export default function HomeClient() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [estimationMode, setEstimationMode] = useState<EstimationMode>(null);
  const [quickEstimate, setQuickEstimate] = useState<QuickEstimate | null>(null);
  const [quickEstimationId, setQuickEstimationId] = useState<string | null>(null);
  const [tierEstimatesData, setTierEstimatesData] = useState<any>(null);
  const [showUserInfoForm, setShowUserInfoForm] = useState(false);
  const [showTierSelector, setShowTierSelector] = useState(false);
  const [pendingMode, setPendingMode] = useState<"quick" | "detailed" | null>(null);
  const [pendingDataSize, setPendingDataSize] = useState<DataSize | null>(null);
  const [pendingDetailedSubmit, setPendingDetailedSubmit] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [clientName, setClientName] = useState<string>("");
  const [showClientNameError, setShowClientNameError] = useState(false);
  const config = formConfig as FormConfig;
  const prevAuthRef = useRef(isAuthenticated);

  // Load tier estimates from API on mount
  useEffect(() => {
    const loadTierEstimates = async () => {
      try {
        const data = await getTierEstimates();
        setTierEstimatesData(data);
      } catch (error) {
        console.error("Failed to load tier estimates, using defaults:", error);
        // Will fall back to hardcoded estimates
      }
    };
    loadTierEstimates();
  }, []);

  // Clear admin access flag when landing on home page
  useEffect(() => {
    sessionStorage.removeItem("admin_access_allowed");

    // Prevent back button from navigating to admin
    const preventBackToAdmin = () => {
      // If user tries to navigate back from home, push forward to stay on home
      if (window.location.pathname === "/" || window.location.pathname === "") {
        console.log("Back button pressed on home - staying on home");
        window.history.pushState(null, "", "/");
      }
    };

    // Add state entry when landing on home
    window.history.pushState(null, "", "/");
    window.addEventListener("popstate", preventBackToAdmin);

    return () => {
      window.removeEventListener("popstate", preventBackToAdmin);
    };
  }, []);

  // Reset to home when user logs in or logs out (to prevent state persistence)
  useEffect(() => {
    const wasAuthenticated = prevAuthRef.current;
    const isNowAuthenticated = isAuthenticated;
    
    // User just logged in (auth changed from false to true)
    if (!wasAuthenticated && isNowAuthenticated && (estimationMode || showUserInfoForm || showTierSelector)) {
      console.log("User just logged in - resetting estimation state");
      setEstimationMode(null);
      setQuickEstimate(null);
      setQuickEstimationId(null);
      setShowUserInfoForm(false);
      setShowTierSelector(false);
      setPendingMode(null);
      setUserInfo(null);
      setClientName("");
      setShowAuthModal(false);
    }
    
    // User just logged out (auth changed from true to false)
    if (wasAuthenticated && !isNowAuthenticated && (estimationMode || showUserInfoForm || showTierSelector)) {
      console.log("User just logged out - resetting estimation state");
      setEstimationMode(null);
      setQuickEstimate(null);
      setQuickEstimationId(null);
      setShowUserInfoForm(false);
      setShowTierSelector(false);
      setPendingMode(null);
      setUserInfo(null);
      setClientName("");
      setShowAuthModal(false);
    }
    
    // Update ref for next render
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, estimationMode, showUserInfoForm, showTierSelector]);

  // Show auth modal if explicitly requested
  if (showAuthModal && !isAuthenticated) {
    return <AuthModal onClose={() => setShowAuthModal(false)} />;
  }

  const generateQuickEstimate = (dataSize: DataSize): QuickEstimate => {
    // Use API data if available, otherwise fall back to hardcoded estimates
    if (tierEstimatesData?.tiers?.[dataSize]) {
      const tierData = tierEstimatesData.tiers[dataSize];
      return {
        dataSize,
        estimatedWeeks: tierData.estimated_weeks,
        estimatedCost: tierData.estimated_cost,
        breakdown: tierData.breakdown,
        keyConsiderations: tierData.key_considerations,
      };
    }

    // Fallback hardcoded estimates (in case API fails)
    const estimates = {
      simple: {
        estimatedWeeks: { min: 1, max: 2 },
        estimatedCost: { min: 10000, max: 15000 },
        breakdown: {
          planning: "1-2 days",
          migration: "2-5 days",
          testing: "1-2 days",
          deployment: "1 day",
        },
        keyConsiderations: [
          "Single environment migration typically takes 5-10 days",
          "Estimated cost includes planning, migration tooling, and initial support",
          "Timeline assumes straightforward schema with minimal transformations",
          "Additional time may be needed for complex application refactoring",
          "Reverse sync and change streams may extend timeline by 5-10 days",
          "Supports up to 50 collections across up to 10 databases",
          "Estimate is for up to 3 environments",
        ],
      },
      medium: {
        estimatedWeeks: { min: 2, max: 4 },
        estimatedCost: { min: 20000, max: 30000 },
        breakdown: {
          planning: "2-4 days",
          migration: "5-10 days",
          testing: "2-4 days",
          deployment: "1-2 days",
        },
        keyConsiderations: [
          "Multiple environments with moderate data typically take 10-20 days",
          "Cost includes comprehensive planning, migration execution, and extended support",
          "Timeline accounts for moderate schema complexity and data transformations",
          "Performance tuning and optimization may add 5-10 days",
          "Parallel environment migrations can reduce overall timeline",
          "Supports up to 50 collections across up to 10 databases",
          "Estimate is for up to 3 environments",
        ],
      },
      complex: {
        estimatedWeeks: { min: 4, max: 12 },
        estimatedCost: { min: 35000, max: 100000 },
        breakdown: {
          planning: "3-8 days",
          migration: "10-40 days",
          testing: "4-8 days",
          deployment: "3-4 days",
        },
        keyConsiderations: [
          "Large-scale migrations (>2TB) typically require 20-60 days",
          "Cost includes detailed architecture review, phased migration, and ongoing support",
          "Timeline accounts for complex schemas, extensive testing, and gradual rollout",
          "Multiple iterations of performance optimization are typically needed",
          "High availability requirements may extend timeline by 10-20 days",
          "Dedicated migration team recommended for projects of this scale",
          "Supports up to 50 collections across up to 10 databases",
          "Estimate is for up to 3 environments",
        ],
      },
    };

    return {
      dataSize,
      ...estimates[dataSize],
    };
  };

  const handleModeSelected = (mode: "quick" | "detailed") => {
    if (!clientName.trim()) {
      setShowClientNameError(true);
      return;
    }
    setShowClientNameError(false);

    // Proceed directly — UserInfoForm is collected later in the flow for logged-out users
    if (mode === "quick") {
      setShowTierSelector(true);
    } else {
      setEstimationMode("detailed");
    }
  };

  const handleUserInfoSubmit = async (info: UserInfo) => {
    setUserInfo(info);
    setShowUserInfoForm(false);

    if (pendingMode === "quick") {
      // Reveal quick estimate results and save to DB
      setEstimationMode("quick");
      setPendingMode(null);
      const dataSize = pendingDataSize!;
      setPendingDataSize(null);
      const estimate = quickEstimate!;
      try {
        const timestamp = new Date().toLocaleString();
        const savedEstimation = await saveEstimation({
          name: `Quick Estimate - ${dataSize} - ${timestamp}`,
          estimation_type: "quick",
          quick_estimate_data: estimate,
          client_name: clientName || undefined,
          user_name: info.name,
          user_email: info.email,
          user_designation: info.designation,
          user_company: info.company,
        });
        setQuickEstimationId(savedEstimation._id);
      } catch (error) {
        console.error("Failed to save quick estimation:", error);
      }
    } else if (pendingMode === "detailed") {
      // Trigger FormRenderer to auto-submit now that we have user info
      setPendingMode(null);
      setPendingDetailedSubmit(true);
    }
  };

  const handleUserInfoCancel = () => {
    setShowUserInfoForm(false);
    setPendingMode(null);
  };

  const handleTierSelected = async (dataSize: DataSize) => {
    const estimate = generateQuickEstimate(dataSize);
    setQuickEstimate(estimate);
    setShowTierSelector(false);

    if (!isAuthenticated && !userInfo) {
      // Collect user info before revealing results
      setPendingDataSize(dataSize);
      setPendingMode("quick");
      setShowUserInfoForm(true);
    } else {
      // Authenticated or already has info — show results and save immediately
      setEstimationMode("quick");
      try {
        const timestamp = new Date().toLocaleString();
        const savedEstimation = await saveEstimation({
          name: `Quick Estimate - ${dataSize} - ${timestamp}`,
          estimation_type: "quick",
          quick_estimate_data: estimate,
          client_name: clientName || undefined,
          user_name: userInfo?.name,
          user_email: userInfo?.email,
          user_designation: userInfo?.designation,
          user_company: userInfo?.company,
        });
        setQuickEstimationId(savedEstimation._id);
        console.log("Quick estimation saved to database with ID:", savedEstimation._id);
      } catch (error) {
        console.error("Failed to save quick estimation:", error);
      }
    }
  };

  const handleTierCancel = () => {
    setShowTierSelector(false);
    setPendingMode(null);
    setPendingDataSize(null);
    setUserInfo(null);
    setQuickEstimationId(null);
  };

  const handleResetEstimation = () => {
    setEstimationMode(null);
    setQuickEstimate(null);
    setQuickEstimationId(null);
    setUserInfo(null);
    setPendingMode(null);
    setPendingDataSize(null);
    setPendingDetailedSubmit(false);
    setShowTierSelector(false);
    setClientName("");
  };

  // Export userInfo for use in FormRenderer
  const getUserInfoForSaving = () => {
    if (isAuthenticated) {
      return {}; // Authenticated users don't need to provide user info
    }
    return userInfo || {};
  };

  // Show user info form if needed
  if (showUserInfoForm && pendingMode) {
    return (
      <>
        <div className={styles.headerContainer}>
          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className={styles.loginLink}
            >
              Login / Sign Up
            </button>
          )}
        </div>
        <UserInfoForm
          onSubmit={handleUserInfoSubmit}
          onCancel={handleUserInfoCancel}
          mode={pendingMode}
        />
      </>
    );
  }

  // Show tier selector for quick estimate (after user info)
  if (showTierSelector) {
    return (
      <>
        <div className={styles.headerContainer}>
          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className={styles.loginLink}
            >
              Login / Sign Up
            </button>
          )}
        </div>
        <TierSelector
          onTierSelected={handleTierSelected}
          onCancel={handleTierCancel}
        />
      </>
    );
  }

  // Show mode selector if no mode is selected yet
  if (!estimationMode) {
    return (
      <div>
        <div className={styles.headerContainer}>
          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className={styles.loginLink}
            >
              Login / Sign Up
            </button>
          )}
        </div>
        
        <EstimationModeSelector 
          onModeSelected={handleModeSelected}
          clientName={clientName}
          onClientNameChange={(name) => {
            setClientName(name);
            if (showClientNameError && name.trim()) {
              setShowClientNameError(false);
            }
          }}
          showError={showClientNameError}
        />
      </div>
    );
  }

  // Show quick estimate results
  if (estimationMode === "quick" && quickEstimate) {
    return (
      <div>
        <div className={styles.headerContainer}>
          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className={styles.loginLink}
            >
              Login / Sign Up
            </button>
          )}
        </div>
        <QuickEstimateResults
          estimate={quickEstimate}
          onStartDetailedEstimate={() => {
            // If not authenticated and no user info, show form
            if (!isAuthenticated && !userInfo) {
              setPendingMode({ mode: "detailed" });
              setShowUserInfoForm(true);
            } else {
              setEstimationMode("detailed");
            }
          }}
          onReset={() => {
            handleResetEstimation();
            router.push("/");
          }}
          userInfo={getUserInfoForSaving()}
        />
      </div>
    );
  }

  // Show detailed form
  return (
    <div>
      {/* Header with User Menu - show login option if not authenticated */}
      <div className={styles.headerContainer}>
        <button
          onClick={() => {
            const hasAnswers = Object.keys(useFormStore.getState().answers).length > 0;
            const isFormInProgress = !useFormStore.getState().submitted && hasAnswers;

            if (isFormInProgress) {
              const confirmed = window.confirm(
                "You have unsaved progress. All your answers will be lost if you go back. Are you sure you want to continue?"
              );
              if (!confirmed) {
                return;
              }
            }
            handleResetEstimation();
            router.push("/");
          }}
          className={styles.backToHomeButton}
        >
          ← Back to Home
        </button>
        {isAuthenticated ? (
          <UserMenu />
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            className={styles.loginLink}
          >
            Login / Sign Up
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className={styles.mainContainer}>
        <FormRenderer
          config={config}
          userInfo={getUserInfoForSaving()}
          clientName={clientName}
          quickEstimationId={quickEstimationId}
          requireUserInfo={!isAuthenticated && !userInfo}
          onNeedUserInfo={() => {
            setPendingMode("detailed");
            setShowUserInfoForm(true);
          }}
          triggerSubmit={pendingDetailedSubmit}
        />
      </div>
    </div>
  );
}
