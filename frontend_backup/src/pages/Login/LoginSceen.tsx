import React, { useState } from "react";
import styles from "./AuthSystem.module.css";
import {
  loginApi,
  verifyCodeApi,
  requestCodeApi,
  LoginFormData,
  CodeFormData,
} from "./authApi";

const AuthSystem: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<"login" | "code">("login");
  const [loginForm, setLoginForm] = useState<LoginFormData>({
    email: "esteban_schiller@gmail.com",
    password: "",
    rememberMe: false,
  });
  const [codeForm, setCodeForm] = useState<CodeFormData>({ code: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isLoginValid =
    loginForm.email.trim() !== "" &&
    loginForm.password.trim() !== "" &&
    loginForm.email.includes("@");

  const isCodeValid = codeForm.code.length === 6 && /^\d{6}$/.test(codeForm.code);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoginValid) return;

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await loginApi(loginForm);
      setCurrentStep("code");
      setSuccess("인증 코드가 이메일로 전송되었습니다.");
    } catch (err) {
      setError("이메일 또는 비밀번호가 잘못되었습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCodeValid) return;

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await verifyCodeApi(codeForm);
      alert("로그인 성공! 대시보드로 이동합니다.");
    } catch (err) {
      setError("코드가 유효하지 않습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCode = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await requestCodeApi();
      setSuccess("새로운 인증 코드가 전송되었습니다.");
      setCodeForm({ code: "" });
    } catch (err) {
      setError("코드 전송에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const renderLoginForm = () => (
    <div className={styles.authContainer}>
      <div className={styles.authPanel}>
        <h2 className={styles.authTitle}>Login</h2>
        <p className={styles.authSubtitle}>Please enter your email and password to continue</p>

        <form onSubmit={handleLoginSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Email address:</label>
            <input
              type="email"
              className={`${styles.formInput} ${loginForm.email ? styles.filled : ""}`}
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              placeholder="Enter your email"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Password
              <a href="#" className={styles.forgotPassword}>Forget Password?</a>
            </label>
            <input
              type="password"
              className={`${styles.formInput} ${loginForm.password ? styles.filled : ""}`}
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              placeholder="••••••••"
            />
          </div>

          <div className={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="rememberMe"
              className={styles.checkbox}
              checked={loginForm.rememberMe}
              onChange={(e) => setLoginForm({ ...loginForm, rememberMe: e.target.checked })}
            />
            <label htmlFor="rememberMe" className={styles.checkboxLabel}>Remember Password</label>
          </div>

          {error && <div className={styles.errorMessage}>{error}</div>}
          {success && <div className={styles.successMessage}>{success}</div>}

          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={!isLoginValid || loading}>
            {loading ? "Loading..." : "Login"}
          </button>
        </form>

        <div className={styles.createAccount}>
          Don't have an account? <a href="#">Create Account</a>
        </div>
      </div>

      <div className={styles.sidePanel}></div>
    </div>
  );

  const renderCodeForm = () => (
    <div className={styles.authContainer}>
      <div className={styles.sidePanel}></div>

      <div className={styles.authPanel}>
        <h2 className={styles.authTitle}>ENTER THE CODE</h2>
        <p className={styles.authSubtitle}>Please input the authentication code to continue</p>

        <form onSubmit={handleCodeSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Code</label>
            <input
              type="text"
              className={`${styles.formInput} ${styles.codeInput} ${codeForm.code ? styles.filled : ""}`}
              value={codeForm.code}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCodeForm({ code: value });
              }}
              placeholder="000000"
              maxLength={6}
            />
          </div>

          {error && <div className={styles.errorMessage}>{error}</div>}
          {success && <div className={styles.successMessage}>{success}</div>}

          <button type="submit" className={`${styles.btn} ${styles.btnSecondary}`} disabled={!isCodeValid || loading}>
            {loading ? "Verifying..." : "Verification"}
          </button>
        </form>

        <div className={styles.requestCode}>
          Don't have a code? <a href="#" onClick={handleRequestCode}>Request Code</a>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`${styles.container} ${loading ? styles.loading : ""}`}>
      {/* 배경 패턴 */}
      <div className={styles.backgroundPattern} aria-hidden="true">
        <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="geometric" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M20,20 L80,20 L50,80 Z" fill="none" stroke="#f39c12" strokeWidth="1" opacity="0.1"/>
              <circle cx="80" cy="80" r="15" fill="none" stroke="#3498db" strokeWidth="1" opacity="0.1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#geometric)"/>
          <path d="M100,500 Q300,300 500,500 T900,500" stroke="#f39c12" strokeWidth="2" fill="none" opacity="0.2"/>
          <path d="M200,200 L400,300 L600,200 L800,300" stroke="#e67e22" strokeWidth="1" fill="none" opacity="0.3"/>
        </svg>
      </div>

      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoText}>AWS²</span>
          <div className={styles.logoGiot}>
            GIOT
            <div className={styles.wifiIcon}></div>
          </div>
        </div>
        <div className={styles.subtitle}>Air Watch System</div>
      </header>

      {currentStep === "login" ? renderLoginForm() : renderCodeForm()}

      <footer className={styles.footer}>2025 GBSA AWS</footer>
    </div>
  );
};

export default AuthSystem;
