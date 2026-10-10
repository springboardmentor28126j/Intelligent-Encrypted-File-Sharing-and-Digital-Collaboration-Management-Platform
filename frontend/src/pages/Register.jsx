import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "./Register.css";

function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [errors, setErrors] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const navigate = useNavigate();

  // ------------------------------------------------------------
  // PASSWORD RULES
  // ------------------------------------------------------------

  const passwordRules = useMemo(
    () => ({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    }),
    [password]
  );

  const passwordScore = Object.values(passwordRules).filter(Boolean).length;

  const passwordStrength =
    password.length === 0
      ? ""
      : passwordScore <= 1
      ? "Weak"
      : passwordScore === 2
      ? "Fair"
      : passwordScore === 3
      ? "Good"
      : "Strong";

  // ------------------------------------------------------------
  // VALIDATION
  // ------------------------------------------------------------

  const validateUsername = (value) => {
    if (!value.trim()) {
      return "Username is required";
    }

    if (value.trim().length < 3) {
      return "Username must contain at least 3 characters";
    }

    if (!/^[a-zA-Z0-9_]+$/.test(value.trim())) {
      return "Use only letters, numbers, and underscores";
    }

    return "";
  };

  const validateEmail = (value) => {
    if (!value.trim()) {
      return "Email address is required";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      return "Enter a valid email address";
    }

    return "";
  };

  const validatePassword = (value) => {
    if (!value) {
      return "Password is required";
    }

    if (value.length < 8) {
      return "Password must contain at least 8 characters";
    }

    return "";
  };

  const validateConfirmPassword = (value) => {
    if (!value) {
      return "Please confirm your password";
    }

    if (value !== password) {
      return "Passwords do not match";
    }

    return "";
  };

  // ------------------------------------------------------------
  // LIVE VALIDATION
  // ------------------------------------------------------------

  useEffect(() => {
    if (username) {
      setErrors((prev) => ({
        ...prev,
        username: validateUsername(username),
      }));
    }
  }, [username]);

  useEffect(() => {
    if (email) {
      setErrors((prev) => ({
        ...prev,
        email: validateEmail(email),
      }));
    }
  }, [email]);

  useEffect(() => {
    if (password) {
      setErrors((prev) => ({
        ...prev,
        password: validatePassword(password),
      }));
    }

    if (confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: validateConfirmPassword(confirmPassword),
      }));
    }
  }, [password]);

  useEffect(() => {
    if (confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: validateConfirmPassword(confirmPassword),
      }));
    }
  }, [confirmPassword]);

  // ------------------------------------------------------------
  // REGISTER
  // ------------------------------------------------------------

  const handleRegister = async (e) => {
    e.preventDefault();

    const usernameError = validateUsername(username);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const confirmError = validateConfirmPassword(confirmPassword);

    setErrors({
      username: usernameError,
      email: emailError,
      password: passwordError,
      confirmPassword: confirmError,
    });

    if (
      usernameError ||
      emailError ||
      passwordError ||
      confirmError
    ) {
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/auth/register`,
        {
          username,
          email,
          password,
        }
      );

      console.log("REGISTER SUCCESS:", response.data);

      setSuccess(true);

      setTimeout(() => {
        navigate("/login");
      }, 1800);
    } catch (error) {
      console.log("REGISTER ERROR:", error);
      console.log("SERVER RESPONSE:", error.response?.data);

      const serverMessage =
        error.response?.data?.detail ||
        "Registration failed. Please try again.";

      setErrors((prev) => ({
        ...prev,
        email: serverMessage,
      }));
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // SUCCESS SCREEN
  // ------------------------------------------------------------

  if (success) {
    return (
      <div className="register-page">
        <div className="register-success">
          <div className="success-circle">
            <svg
              viewBox="0 0 52 52"
              className="success-check"
            >
              <path
                d="M14 27l8 8 17-18"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h1>Account created</h1>

          <p>
            Your TrustShare workspace is ready.
            <br />
            Redirecting you to sign in...
          </p>

          <div className="success-loader">
            <span></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="register-page">
      <div className="register-orb register-orb-one"></div>
      <div className="register-orb register-orb-two"></div>

      <div className="register-shell">

        {/* ------------------------------------------------ */}
        {/* LEFT INFORMATION PANEL */}
        {/* ------------------------------------------------ */}

        <section className="register-intro">

          <Link to="/login" className="register-brand">
            <span className="brand-mark">
              <svg viewBox="0 0 32 32">
                <path
                  d="M16 3L27 7v8c0 7-4.5 11.5-11 14C9.5 26.5 5 22 5 15V7l11-4z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />

                <path
                  d="M11 16l3 3 7-8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>

            <span>TrustShare</span>
          </Link>

          <div className="intro-content">

            <div className="intro-badge">
              <span className="badge-dot"></span>
              Secure workspace
            </div>

            <h1>
              Your files.
              <br />
              Your control.
            </h1>

            <p>
              Create a secure workspace where your files
              stay protected and collaboration stays simple.
            </p>

            <div className="benefit-list">

              <div className="benefit-item">
                <div className="benefit-icon">
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M12 3l7 3v5c0 4.5-2.8 7.4-7 9-4.2-1.6-7-4.5-7-9V6l7-3z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M9 12l2 2 4-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div>
                  <strong>Built for security</strong>
                  <span>
                    Encryption-focused file protection
                  </span>
                </div>
              </div>

              <div className="benefit-item">
                <div className="benefit-icon">
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M4 7h16M4 12h16M4 17h10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div>
                  <strong>Simple collaboration</strong>
                  <span>
                    Share files without unnecessary complexity
                  </span>
                </div>
              </div>

              <div className="benefit-item">
                <div className="benefit-icon">
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M12 4v16M5 9l7-5 7 5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6 20h12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div>
                  <strong>Controlled access</strong>
                  <span>
                    Keep ownership over who can access files
                  </span>
                </div>
              </div>

            </div>
          </div>

          <div className="intro-footer">
            <span>TrustShare</span>
            <span>•</span>
            <span>Secure collaboration platform</span>
          </div>

        </section>

        {/* ------------------------------------------------ */}
        {/* FORM PANEL */}
        {/* ------------------------------------------------ */}

        <section className="register-form-panel">

          <div className="form-header">
            <span className="form-eyebrow">
              GET STARTED
            </span>

            <h2>Create your account</h2>

            <p>
              Set up your secure TrustShare workspace in
              less than a minute.
            </p>
          </div>

          <form
            onSubmit={handleRegister}
            className="register-form"
            noValidate
          >

            {/* USERNAME */}

            <div className="field-group">
              <label htmlFor="username">
                Username
              </label>

              <div
                className={`input-wrapper ${
                  errors.username ? "input-error" : ""
                } ${
                  username && !errors.username
                    ? "input-success"
                    : ""
                }`}
              >
                <svg viewBox="0 0 24 24">
                  <circle
                    cx="12"
                    cy="8"
                    r="3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />

                  <path
                    d="M5 20c.7-3.5 3-5.2 7-5.2s6.3 1.7 7 5.2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>

                <input
                  id="username"
                  type="text"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value)
                  }
                  autoComplete="username"
                />

                {username && !errors.username && (
                  <span className="valid-icon">✓</span>
                )}
              </div>

              {errors.username && (
                <span className="field-error">
                  {errors.username}
                </span>
              )}

              {username && !errors.username && (
                <span className="field-hint success-hint">
                  Username format looks good
                </span>
              )}
            </div>

            {/* EMAIL */}

            <div className="field-group">
              <label htmlFor="email">
                Email address
              </label>

              <div
                className={`input-wrapper ${
                  errors.email ? "input-error" : ""
                } ${
                  email && !errors.email
                    ? "input-success"
                    : ""
                }`}
              >
                <svg viewBox="0 0 24 24">
                  <rect
                    x="3"
                    y="5"
                    width="18"
                    height="14"
                    rx="2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />

                  <path
                    d="M4 7l8 6 8-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                </svg>

                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  autoComplete="email"
                />

                {email && !errors.email && (
                  <span className="valid-icon">✓</span>
                )}
              </div>

              {errors.email && (
                <span className="field-error">
                  {errors.email}
                </span>
              )}
            </div>

            {/* PASSWORD */}

            <div className="field-group">
              <div className="label-row">
                <label htmlFor="password">
                  Password
                </label>

                {password && (
                  <span
                    className={`strength-label strength-${passwordStrength.toLowerCase()}`}
                  >
                    {passwordStrength}
                  </span>
                )}
              </div>

              <div
                className={`input-wrapper ${
                  errors.password ? "input-error" : ""
                } ${
                  password &&
                  !errors.password &&
                  passwordScore === 4
                    ? "input-success"
                    : ""
                }`}
              >
                <svg viewBox="0 0 24 24">
                  <rect
                    x="5"
                    y="10"
                    width="14"
                    height="10"
                    rx="2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />

                  <path
                    d="M8 10V7a4 4 0 018 0v3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>

                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {password && (
                <div className="strength-section">

                  <div className="strength-bars">
                    {[1, 2, 3, 4].map((level) => (
                      <span
                        key={level}
                        className={
                          level <= passwordScore
                            ? `strength-fill strength-${passwordStrength.toLowerCase()}`
                            : ""
                        }
                      ></span>
                    ))}
                  </div>

                  <div className="password-rules">

                    <span
                      className={
                        passwordRules.length
                          ? "rule-valid"
                          : ""
                      }
                    >
                      {passwordRules.length ? "✓" : "○"}
                      8+ characters
                    </span>

                    <span
                      className={
                        passwordRules.uppercase
                          ? "rule-valid"
                          : ""
                      }
                    >
                      {passwordRules.uppercase
                        ? "✓"
                        : "○"}
                      Uppercase
                    </span>

                    <span
                      className={
                        passwordRules.number
                          ? "rule-valid"
                          : ""
                      }
                    >
                      {passwordRules.number
                        ? "✓"
                        : "○"}
                      Number
                    </span>

                    <span
                      className={
                        passwordRules.special
                          ? "rule-valid"
                          : ""
                      }
                    >
                      {passwordRules.special
                        ? "✓"
                        : "○"}
                      Special character
                    </span>

                  </div>
                </div>
              )}

              {errors.password && (
                <span className="field-error">
                  {errors.password}
                </span>
              )}
            </div>

            {/* CONFIRM PASSWORD */}

            <div className="field-group">
              <label htmlFor="confirmPassword">
                Confirm password
              </label>

              <div
                className={`input-wrapper ${
                  errors.confirmPassword
                    ? "input-error"
                    : ""
                } ${
                  confirmPassword &&
                  !errors.confirmPassword
                    ? "input-success"
                    : ""
                }`}
              >
                <svg viewBox="0 0 24 24">
                  <rect
                    x="5"
                    y="10"
                    width="14"
                    height="10"
                    rx="2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />

                  <path
                    d="M8 10V7a4 4 0 018 0v3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>

                <input
                  id="confirmPassword"
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                  aria-label={
                    showConfirmPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showConfirmPassword
                    ? "Hide"
                    : "Show"}
                </button>
              </div>

              {confirmPassword &&
                !errors.confirmPassword && (
                  <span className="field-hint success-hint">
                    ✓ Passwords match
                  </span>
                )}

              {errors.confirmPassword && (
                <span className="field-error">
                  {errors.confirmPassword}
                </span>
              )}
            </div>

            {/* SUBMIT */}

            <button
              type="submit"
              className="register-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="button-spinner"></span>
                  Creating account...
                </>
              ) : (
                <>
                  Create secure account
                  <span className="button-arrow">→</span>
                </>
              )}
            </button>

          </form>

          <div className="login-prompt">
            Already have a TrustShare account?
            <Link to="/login">
              Sign in
            </Link>
          </div>

          <div className="security-note">
            <svg viewBox="0 0 24 24">
              <path
                d="M12 3l7 3v5c0 4.5-2.8 7.4-7 9-4.2-1.6-7-4.5-7-9V6l7-3z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              />

              <path
                d="M9 12l2 2 4-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>

            Your account information is securely
            transmitted to TrustShare.
          </div>

        </section>

      </div>
    </div>
  );
}

export default Register;