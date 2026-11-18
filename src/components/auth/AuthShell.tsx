"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons/Icon";

export interface AuthTrustItem {
  icon: IconName;
  title: string;
  detail: string;
}

export function AuthShell({
  theme,
  asideTitle,
  activeTab,
  formTitle,
  formSubtitle,
  children,
}: {
  theme: "citizen" | "staff";
  badge?: string;
  asideTitle: string;
  asideLead?: string;
  trustItems?: AuthTrustItem[];
  activeTab?: "login" | "register" | "staff";
  footerNote?: ReactNode;
  formTitle?: ReactNode;
  formSubtitle?: string;
  children: ReactNode;
}) {
  const isStaff = theme === "staff";

  const topCallout = isStaff
    ? { label: "Colombo HQ", title: "Command Dispatch" }
    : { label: "Central Grid", title: "Ratnapura Shelter" };

  const midCallout = isStaff
    ? { title: "25 Districts", subtitle: "active on live relief chain" }
    : { title: "1.2 km", subtitle: "left to nearest relief depot" };

  const trailLabel = isStaff ? "Ops Corridor" : "Aegis Relief Trail";

  return (
    <div className="voy-stage">
      <div className="voy-card">
        {/* Left White Centered Form Column */}
        <div className="voy-left">
          <div className="voy-left-inner">
            <div className="voy-brand">
              <span>aegis</span>
              {isStaff && <span className="voy-brand-tag mono">staff</span>}
            </div>

            <h1 className="voy-title">{formTitle ?? asideTitle}</h1>
            {formSubtitle && <p className="voy-subtitle">{formSubtitle}</p>}

            {activeTab && (
              <>
                <div className="voy-orbs-box">
                  <nav className="voy-orbs" aria-label="Portal switcher">
                    {/* Connected 3-orb metaball silhouette */}
                    <svg className="voy-orbs-bg" viewBox="0 0 176 52" aria-hidden="true">
                      <path
                        d="M28,4 C39,4 47,12 52,14 C57,15 62,15 67,14 C72,12 78,4 88,4 C98,4 104,12 109,14 C114,15 119,15 124,14 C129,12 137,4 148,4 C161,4 172,14 172,26 C172,38 161,48 148,48 C137,48 129,40 124,38 C119,37 114,37 109,38 C104,40 98,48 88,48 C78,48 72,40 67,38 C62,37 57,37 52,38 C47,40 39,48 28,48 C15,48 4,38 4,26 C4,14 15,4 28,4 Z"
                        fill="#F3F5F6"
                      />
                    </svg>

                    <Link
                      href="/login"
                      className={`voy-orb ${activeTab === "login" ? "on" : ""}`}
                      title="Citizen sign in"
                      aria-label="Citizen sign in"
                    >
                      <Icon name="user" size={17} />
                    </Link>

                    <Link
                      href="/register"
                      className={`voy-orb ${activeTab === "register" ? "on" : ""}`}
                      title="Create citizen account"
                      aria-label="Create citizen account"
                    >
                      <Icon name="plus" size={17} />
                    </Link>

                    <Link
                      href="/staff/login"
                      className={`voy-orb ${activeTab === "staff" ? "on" : ""}`}
                      title="Staff & coordinator portal"
                      aria-label="Staff & coordinator portal"
                    >
                      <Icon name="shield" size={17} />
                    </Link>
                  </nav>

                  <div className="voy-orb-labels">
                    <span className={activeTab === "login" ? "on" : ""}>Sign in</span>
                    <span className={activeTab === "register" ? "on" : ""}>Register</span>
                    <span className={activeTab === "staff" ? "on" : ""}>Staff</span>
                  </div>
                </div>

                <div className="voy-or">or</div>
              </>
            )}

            {children}
          </div>
        </div>

        {/* Right Emerald Highland Ridge & Relief Trail Scene with Callout Pins */}
        <aside className="voy-right" aria-label="Sri Lanka highland relief corridor">
          <svg
            className="voy-right-svg"
            viewBox="0 0 600 720"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="voySkyMist" x1="0%" y1="0%" x2="80%" y2="55%">
                <stop offset="0%" stopColor={isStaff ? "#7E94A0" : "#B6C8CE"} />
                <stop offset="55%" stopColor={isStaff ? "#4A665F" : "#6F8A82"} />
                <stop offset="100%" stopColor={isStaff ? "#1E3630" : "#304C40"} />
              </linearGradient>
              <linearGradient id="voyRidgeLeft" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={isStaff ? "#1C352E" : "#274738"} />
                <stop offset="55%" stopColor={isStaff ? "#142722" : "#1B3529"} />
                <stop offset="100%" stopColor="#0C1B15" />
              </linearGradient>
              <linearGradient id="voyRidgeSun" x1="15%" y1="15%" x2="85%" y2="100%">
                <stop offset="0%" stopColor={isStaff ? "#4C7A52" : "#7AA84F"} />
                <stop offset="45%" stopColor={isStaff ? "#2F583D" : "#4E7F3E"} />
                <stop offset="100%" stopColor={isStaff ? "#183024" : "#25452B"} />
              </linearGradient>
              <linearGradient id="voyTrailRoad" x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="#C9BFA9" stopOpacity="0.88" />
                <stop offset="60%" stopColor="#DFD7C4" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#B8AC96" stopOpacity="0.92" />
              </linearGradient>
              <radialGradient id="voyFogPatch" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#D6E4E8" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#D6E4E8" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Misty highland sky */}
            <rect width="600" height="720" fill="url(#voySkyMist)" />

            {/* Distant misty mountain ridges */}
            <path
              d="M0 155 Q 110 110 230 140 T 460 118 L 600 96 L 600 340 L 0 340 Z"
              fill={isStaff ? "#304C45" : "#436355"}
              opacity="0.72"
            />
            <path
              d="M0 205 Q 140 165 290 210 T 600 165 L 600 420 L 0 420 Z"
              fill={isStaff ? "#223C34" : "#2F4E3F"}
              opacity="0.86"
            />

            {/* Soft mist banks across upper valley */}
            <ellipse className="voy-mist-a" cx="140" cy="145" rx="220" ry="70" fill="url(#voyFogPatch)" />
            <ellipse className="voy-mist-b" cx="420" cy="122" rx="190" ry="52" fill="url(#voyFogPatch)" opacity="0.72" />

            {/* Subtle terraced village/depot rooftops nestled upper left */}
            <g className="voy-depot-glow" fill="#E5ECE9" opacity="0.88">
              <polygon points="72,62 88,52 104,62 104,74 72,74" />
              <polygon points="112,72 126,64 140,72 140,82 112,82" />
              <rect x="44" y="80" width="22" height="10" rx="2" fill="#CDD9D6" />
            </g>

            {/* Deep emerald left valley slope */}
            <path
              d="M0 190 C 120 220, 240 285, 315 390 C 350 440, 310 560, 295 720 L 0 720 Z"
              fill="url(#voyRidgeLeft)"
            />

            {/* Bright moss-emerald right mountain crest */}
            <path
              d="M275 180 C 350 188, 460 220, 600 280 L 600 720 L 290 720 C 295 570, 360 445, 325 360 C 295 290, 240 230, 275 180 Z"
              fill="url(#voyRidgeSun)"
            />

            {/* Textured dark foliage shadows along ridge crests */}
            <path
              d="M410 310 C 485 370, 540 460, 600 560 L 600 720 L 420 720 C 390 610, 385 450, 410 310 Z"
              fill="#193323"
              opacity="0.72"
            />
            <path
              d="M0 360 C 110 410, 210 500, 265 620 L 250 720 L 0 720 Z"
              fill="#0D1F17"
              opacity="0.75"
            />

            {/* Winding Highland Relief Trail up the spine of the ridge */}
            <path
              d="M256 172 C 266 205, 304 235, 342 275 C 390 326, 396 365, 346 420 C 294 478, 308 565, 336 720 L 368 720 C 340 572, 326 485, 376 424 C 424 366, 414 316, 360 264 C 318 224, 278 198, 266 172 Z"
              fill="url(#voyTrailRoad)"
            />
            {/* Crisp sunlit inner trail track */}
            <path
              d="M261 174 C 272 204, 310 234, 348 272 C 395 322, 402 365, 355 422 C 306 480, 318 570, 348 720"
              fill="none"
              stroke="rgba(255, 250, 240, 0.55)"
              strokeWidth="4"
            />
            {/* Animated relief dispatch pulse traveling up the winding trail */}
            <path
              className="voy-trail-pulse"
              d="M348 720 C 318 570, 306 480, 355 422 C 402 365, 395 322, 348 272 C 310 234, 272 204, 261 174"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="4.5"
              strokeLinecap="round"
            />

            {/* Subtle pine & highland bush clusters */}
            <g className="voy-trees" fill="#12271D" opacity="0.68">
              <circle cx="95" cy="435" r="32" />
              <circle cx="145" cy="480" r="40" />
              <circle cx="520" cy="485" r="38" />
              <circle cx="475" cy="545" r="44" />
              <circle cx="180" cy="610" r="46" />
              <circle cx="490" cy="645" r="48" />
            </g>
          </svg>

          {/* Pin Callout 1: Top-left Frosted Shelter / HQ Badge */}
          <div className="voy-callout-top">
            <div className="voy-pin-dot" />
            <div className="voy-pin-line" style={{ height: 48 }} />
            <div className="voy-glass-pill">
              <div className="voy-glass-ico">
                <Icon name="home" size={14} />
              </div>
              <div className="voy-glass-pill-text">
                <span>{topCallout.label}</span>
                <b>{topCallout.title}</b>
              </div>
            </div>
          </div>

          {/* Pin Callout 2: Mid-right Distance / Readiness Glass Box */}
          <div className="voy-callout-mid">
            <div className="voy-glass-box">
              <b>{midCallout.title}</b>
              <span>{midCallout.subtitle}</span>
            </div>
            <div className="voy-pin-line" style={{ height: 58 }} />
            <div className="voy-pin-dot" />
          </div>

          {/* Pin Callout 3: Bottom-center Crisp White Trail Pill */}
          <div className="voy-callout-bot">
            <div className="voy-white-pill">{trailLabel}</div>
            <div className="voy-pin-line" style={{ height: 22 }} />
            <div className="voy-pin-dot" />
          </div>
        </aside>
      </div>
    </div>
  );
}

export function NeoField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  required = true,
  mono = false,
  valid,
  statusText,
  inputMode,
  maxLength,
}: {
  id: string;
  label: string;
  icon?: IconName;
  type?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  mono?: boolean;
  dark?: boolean;
  valid?: boolean;
  statusText?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  maxLength?: number;
}) {
  const hasValue = value.trim().length > 0;
  const stateClass = hasValue ? (valid === true ? "is-valid" : valid === false ? "is-invalid" : "") : "";

  return (
    <label htmlFor={id} className={`voy-input-pill ${stateClass}`.trim()}>
      <input
        id={id}
        type={type}
        required={required}
        aria-label={label}
        inputMode={inputMode}
        maxLength={maxLength}
        className={mono ? "mono" : undefined}
        placeholder={placeholder || label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
      />
      {statusText && (
        <span className={`voy-pill-status mono ${valid === true ? "ok" : valid === false ? "err" : ""}`}>
          {statusText}
        </span>
      )}
    </label>
  );
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  required = true,
  minLength,
  showRules = false,
  rightAction,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  dark?: boolean;
  showRules?: boolean;
  rightAction?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const hasMinLen = value.length >= 8;
  const hasDigit = /\d/.test(value);

  return (
    <div>
      <div className="voy-input-pill">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          aria-label={label}
          placeholder={placeholder || label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="voy-eye-btn"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17.94 17.94A10.9 10.9 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>

      {(showRules || rightAction) && (
        <div style={{ display: "flex", justifyContent: showRules ? "space-between" : "flex-end", alignItems: "center", gap: 8, marginTop: 6, padding: "0 8px", flexWrap: "wrap" }}>
          {showRules && (
            <div style={{ display: "flex", gap: 6, fontSize: 10.5 }}>
              <span style={{ color: hasMinLen ? "#1B7A4B" : "#6B7280", fontWeight: hasMinLen ? 700 : 500 }}>
                {hasMinLen ? "✓" : "○"} 8+ chars
              </span>
              <span style={{ color: hasDigit ? "#1B7A4B" : "#6B7280", fontWeight: hasDigit ? 700 : 500 }}>
                {hasDigit ? "✓" : "○"} 1 number
              </span>
            </div>
          )}
          {rightAction}
        </div>
      )}
    </div>
  );
}
