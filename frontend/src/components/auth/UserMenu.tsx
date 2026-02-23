"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import styles from "./Auth.module.css";

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuthStore();
  const router = useRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const handleLogout = () => {
    sessionStorage.removeItem("admin_access_allowed");
    logout();
    setIsOpen(false);
  };

  const handleAdminDashboard = () => {
    setIsOpen(false);
    sessionStorage.setItem("admin_access_allowed", "true");
    router.push("/admin");
  };

  // Get first letter of username for avatar
  const avatarLetter = user.username.charAt(0).toUpperCase();

  return (
    <div className={styles.userMenu} ref={menuRef}>
      <button
        className={styles.userButton}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={`${user.username} (${user.role})`}
      >
        <div className={styles.userAvatar}>{avatarLetter}</div>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {user.role === "admin" && (
            <button className={styles.dropdownItem} onClick={handleAdminDashboard}>
              ⚙️ Admin Dashboard
            </button>
          )}
          <button
            className={`${styles.dropdownItem} ${styles.danger}`}
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
