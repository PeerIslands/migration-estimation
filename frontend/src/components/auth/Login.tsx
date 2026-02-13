"use client";

import React, { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import styles from "./Auth.module.css";

type LoginProps = {
  onSuccess?: () => void;
  onSwitchToSignup?: () => void;
};

export default function Login({ onSuccess, onSwitchToSignup }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await login({ username, password });
      onSuccess?.();
    } catch (error) {
      // Error is handled by the store
      console.error("Login failed:", error);
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <h2 className={styles.authTitle}>Login</h2>
        <p className={styles.authSubtitle}>Welcome back! Please login to your account.</p>

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
              placeholder="Enter your username"
              required
              autoComplete="username"
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
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className={styles.errorMessage} role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isLoading}
          >
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>

        {onSwitchToSignup && (
          <div className={styles.authSwitch}>
            Don't have an account?{" "}
            <button
              type="button"
              onClick={onSwitchToSignup}
              className={styles.switchButton}
            >
              Sign up
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
