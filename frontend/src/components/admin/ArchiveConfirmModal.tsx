"use client";

import React from "react";
import styles from "./ArchiveConfirmModal.module.css";

interface ArchiveConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  estimationName?: string;
}

export default function ArchiveConfirmModal({
  onConfirm,
  onCancel,
  estimationName,
}: ArchiveConfirmModalProps) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Archive Estimation</h2>
        </div>

        <div className={styles.content}>
          <p className={styles.message}>
            Are you sure you want to archive this estimate?
          </p>
          {estimationName && (
            <p className={styles.estimationName}>"{estimationName}"</p>
          )}
          <p className={styles.subMessage}>
            Archived estimations can be accessed from the Archived List and restored later.
          </p>
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={onCancel}>
            Cancel
          </button>
          <button className={styles.confirmButton} onClick={onConfirm}>
            Yes, Archive
          </button>
        </div>
      </div>
    </div>
  );
}
