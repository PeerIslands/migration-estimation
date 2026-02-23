"use client";

import React, { useState } from "react";
import styles from "./UserInfoForm.module.css";

interface UserInfo {
  name: string;
  email: string;
  designation: string;
  company: string;
}

interface UserInfoFormProps {
  onSubmit: (userInfo: UserInfo) => void;
  onCancel: () => void;
  mode: "quick" | "detailed";
}

export default function UserInfoForm({ onSubmit, onCancel, mode }: UserInfoFormProps) {
  const [formData, setFormData] = useState<UserInfo>({
    name: "",
    email: "",
    designation: "",
    company: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof UserInfo, string>>>({});

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleChange = (field: keyof UserInfo, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const newErrors: Partial<Record<keyof UserInfo, string>> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }
    
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    
    if (!formData.designation.trim()) {
      newErrors.designation = "Designation is required";
    }
    
    if (!formData.company.trim()) {
      newErrors.company = "Company name is required";
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    onSubmit(formData);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Before We Begin</h2>
          <p className={styles.subtitle}>
            Please provide your details to {mode === "quick" ? "get a quick estimate" : "start the detailed estimation"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="name" className={styles.label}>
              Full Name <span className={styles.required}>*</span>
            </label>
            <input
              id="name"
              type="text"
              className={`${styles.input} ${errors.name ? styles.inputError : ""}`}
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="John Doe"
            />
            {errors.name && <span className={styles.errorText}>{errors.name}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              Email Address <span className={styles.required}>*</span>
            </label>
            <input
              id="email"
              type="email"
              className={`${styles.input} ${errors.email ? styles.inputError : ""}`}
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="john.doe@company.com"
            />
            {errors.email && <span className={styles.errorText}>{errors.email}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="designation" className={styles.label}>
              Designation <span className={styles.required}>*</span>
            </label>
            <input
              id="designation"
              type="text"
              className={`${styles.input} ${errors.designation ? styles.inputError : ""}`}
              value={formData.designation}
              onChange={(e) => handleChange("designation", e.target.value)}
              placeholder="Senior Developer, CTO, etc."
            />
            {errors.designation && <span className={styles.errorText}>{errors.designation}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="company" className={styles.label}>
              Company Name <span className={styles.required}>*</span>
            </label>
            <input
              id="company"
              type="text"
              className={`${styles.input} ${errors.company ? styles.inputError : ""}`}
              value={formData.company}
              onChange={(e) => handleChange("company", e.target.value)}
              placeholder="Acme Corporation"
            />
            {errors.company && <span className={styles.errorText}>{errors.company}</span>}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={onCancel}
              className={styles.cancelButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitButton}
            >
              Continue to Estimation
            </button>
          </div>
        </form>

        <p className={styles.privacyNote}>
          🔒 Your information is secure and will only be used for providing you with migration estimation services.
        </p>
      </div>
    </div>
  );
}
