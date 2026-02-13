"use client";

import React, { useState } from "react";
import Login from "./Login";
import Signup from "./Signup";

type AuthModalProps = {
  onClose: () => void;
  initialMode?: "login" | "signup";
};

export default function AuthModal({ onClose, initialMode = "login" }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);

  const handleSuccess = () => {
    onClose();
  };

  return (
    <>
      {mode === "login" ? (
        <Login
          onSuccess={handleSuccess}
          onSwitchToSignup={() => setMode("signup")}
        />
      ) : (
        <Signup
          onSuccess={handleSuccess}
          onSwitchToLogin={() => setMode("login")}
        />
      )}
    </>
  );
}
