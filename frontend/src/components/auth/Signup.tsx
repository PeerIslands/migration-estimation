"use client";

import React, { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import styles from "./Auth.module.css";

type SignupProps = {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
};

export default function Signup({ onSuccess, onSwitchToLogin }: SignupProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");
  const { register, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError("");

    // Validation
    if (username.length < 3) {
      setValidationError("Username must be at least 3 characters");
      return;
    }

    if (password.length < 6) {
      setValidationError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setValidationError("Passwords do not match");
      return;
    }

    try {
      await register({ username, password });
      onSuccess?.();
    } catch (error) {
      // Error is handled by the store
      console.error("Registration failed:", error);
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <h2 className={styles.authTitle}>Sign Up</h2>
        <p className={styles.authSubtitle}>Create a new account to get started.</p>

        <form onSubmit={handleSubmit} className={styles.authForm}>
          <div className={styles.formGroup}>
            <label htmlFor="username" className={styles.label}>
              Username
            </label>
            <input
              id="username"
              type="text"
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username (min 3 characters)"
              required
              autoComplete="username"
              minLength={3}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a password (min 6 characters)"
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              className={styles.input}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              autoComplete="new-password"
            />
          </div>

          {(error || validationError) && (
            <div className={styles.errorMessage} role="alert">
              {validationError || error}
            </div>
          )}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isLoading}
          >
            {isLoading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        {onSwitchToLogin && (
          <div className={styles.authSwitch}>
            Already have an account?{" "}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className={styles.switchButton}
            >
              Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
