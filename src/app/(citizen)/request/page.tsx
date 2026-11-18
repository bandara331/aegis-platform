"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons/Icon";
import { EmptyState, Skeleton } from "@/components/ui";
import { LocationPicker, type LocationValue } from "@/components/location/LocationPicker";
import type { DuplicateWarning, RequestDetail } from "@/lib/api";

interface CategoryItem {
  code: string;
  name: string;
}

interface DistrictItem {
  provinceCode: string;
  name: string;
}

const VULNERABLE_FLAGS = [
  { id: "MedicalUrgent", label: "Medical emergency / Life-critical" },
  { id: "Elderly", label: "Elderly (65+)" },
  { id: "Infants", label: "Infants / Young children" },
  { id: "Pregnant", label: "Pregnant" },
  { id: "Disabled", label: "Mobility / Disability support" },
];

const URGENCY_LEVELS = [
  { level: 2, label: "Standard", tint: "var(--surface)", border: "var(--border-card)" },
  { level: 3, label: "High need", tint: "var(--teal-tint)", border: "var(--teal)" },
  { level: 4, label: "Urgent", tint: "var(--sun-tint)", border: "var(--sun)" },
  { level: 5, label: "Life-critical", tint: "#FFE7E4", border: "#FF5A4F" },
];

async function verifyClientMagicBytes(file: File): Promise<string | null> {
  if (file.size > 5 * 1024 * 1024) {
    return "File exceeds the 5 MB maximum size limit.";
  }
  const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    return "Only JPEG, PNG, or PDF files are allowed.";
  }

  const buffer = await file.slice(0, 8).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const isPdf =
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d;

  if (!isJpeg && !isPng && !isPdf) {
    return "File signature check failed: binary header does not match JPEG, PNG, or PDF.";
  }

  return null;
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function CitizenRequestAidPage() {
  const router = useRouter();

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [districts, setDistricts] = useState<DistrictItem[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [peopleCount, setPeopleCount] = useState<number>(1);
  const [selfUrgency, setSelfUrgency] = useState<number>(3);
  const [vulnerableFlags, setVulnerableFlags] = useState<string[]>([]);

  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  const [location, setLocation] = useState<LocationValue>({
    area: "",
    latitude: 6.9271,
    longitude: 79.8612,
    gpsAcquired: false,
  });

  const [contactMobile, setContactMobile] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [language, setLanguage] = useState("en");
  const [consentGiven, setConsentGiven] = useState(true);

  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [createdRequest, setCreatedRequest] = useState<RequestDetail | null>(null);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

    Promise.all([
      fetch(`${apiBase}/reference/metadata`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/requests?me=1").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([meta, me]) => {
      if (meta && Array.isArray(meta.categories)) {
        setCategories(meta.categories);
        if (meta.categories.length > 0) {
          setSelectedCategories([meta.categories[0].name]);
        }
      }
      if (meta && Array.isArray(meta.districts)) {
        setDistricts(meta.districts);
        if (meta.districts.length > 0) {
          setLocation((prev) => ({ ...prev, area: prev.area || meta.districts[0].name }));
        }
      }
      if (me) {
        if (me.mobile) setContactMobile(me.mobile);
        if (me.email) setContactEmail(me.email);
        if (me.language) setLanguage(me.language);
      }
      setLoadingMeta(false);
    });
  }, []);

  function toggleCategory(name: string) {
    setSelectedCategories((prev) =>
      prev.includes(name) ? (prev.length > 1 ? prev.filter((c) => c !== name) : prev) : [...prev, name]
    );
    setIdempotencyKey(generateIdempotencyKey());
  }

  function toggleFlag(flagId: string) {
    setVulnerableFlags((prev) =>
      prev.includes(flagId) ? prev.filter((f) => f !== flagId) : [...prev, flagId]
    );
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setEvidenceError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setEvidenceFile(null);
      return;
    }
    const validationErr = await verifyClientMagicBytes(file);
    if (validationErr) {
      setEvidenceError(validationErr);
      setEvidenceFile(null);
      e.target.value = "";
      return;
    }
    setEvidenceFile(file);
  }

  async function submitRequest(confirmDuplicate: boolean) {
    setError(null);
    if (selectedCategories.length === 0) {
      setError("Please select at least one assistance category.");
      return;
    }
    if (description.trim().length < 5) {
      setError("Please describe what is needed (at least 5 characters).");
      return;
    }
    if (!location.area.trim()) {
      setError("Please select or enter your district / location.");
      return;
    }
    if (!consentGiven) {
      setError("Please confirm consent to share your request details with relief coordinators.");
      return;
    }

    setSubmitting(true);
    try {
      const effectiveUrgency = vulnerableFlags.includes("MedicalUrgent")
        ? 5
        : vulnerableFlags.length > 0
          ? Math.max(4, selfUrgency)
          : selfUrgency;

      const res = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": confirmDuplicate ? generateIdempotencyKey() : idempotencyKey,
        },
        body: JSON.stringify({
          crisisId: null,
          category: selectedCategories.join(", "),
          description: description.trim(),
          language,
          area: location.area.trim(),
          latitude: location.latitude,
          longitude: location.longitude,
          selfReportedUrgency: effectiveUrgency,
          peopleCount: Math.max(1, peopleCount),
          consentGiven,
          vulnerableFlags: vulnerableFlags.join(","),
          contactMobile: contactMobile.trim(),
          contactEmail: contactEmail.trim(),
          confirmDuplicate,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409 && data.code === "POSSIBLE_DUPLICATE" && data.duplicateWarning) {
        setDuplicateWarning(data.duplicateWarning as DuplicateWarning);
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || "Unable to submit assistance request.");
        setSubmitting(false);
        return;
      }

      const created = data as RequestDetail;

      if (evidenceFile && created.id) {
        const fd = new FormData();
        fd.append("file", evidenceFile);
        await fetch(`/api/requests/${created.id}/evidence`, {
          method: "POST",
          body: fd,
        }).catch(() => {
          // Evidence failure does not block created request
        });
      }

      setDuplicateWarning(null);
      setCreatedRequest(created);
      setSubmitting(false);

      setTimeout(() => {
        router.push(`/my-requests/${created.id}`);
        router.refresh();
      }, 1500);
    } catch {
      setError("Network error while submitting request.");
      setSubmitting(false);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    void submitRequest(false);
  }

  if (createdRequest) {
    return (
      <div
        className="card"
        style={{
          maxWidth: 640,
          margin: "24px auto",
          borderRadius: "32px",
          padding: "36px 28px",
          textAlign: "center",
          border: "2px solid var(--mint)",
        }}
      >
        <span className="tag tag-mint" style={{ marginBottom: "12px" }}>
          <Icon name="check" size={14} /> REQUEST RECEIVED
        </span>
        <div className="mono" style={{ fontSize: "28px", fontWeight: 800, color: "var(--ink)" }}>
          {createdRequest.trackingNumber}
        </div>
        <p style={{ fontSize: "14px", color: "var(--muted)", margin: "10px 0 22px" }}>
          A confirmation email with your reference number <b>{createdRequest.trackingNumber}</b> has been queued to{" "}
          <b>{createdRequest.contactEmail || contactEmail || "your email"}</b>. Redirecting to your live status timeline…
        </p>
        <Link
          href={`/my-requests/${createdRequest.id}`}
          className="btn btn-teal btn-lg btn-block"
        >
          Open request #{createdRequest.trackingNumber} →
        </Link>
      </div>
    );
  }

  const urgencyLabel = URGENCY_LEVELS.find((u) => u.level === selfUrgency)?.label ?? "Standard";

  return (
    <form onSubmit={handleFormSubmit} className="cit-split-grid">
      {/* Left Studio Card: Needs, Description, People & Urgency */}
      <div className="card" style={{ borderRadius: "28px", padding: "26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", gap: 8, flexWrap: "wrap" }}>
          <span className="tag tag-teal">
            <span className="live-dot" style={{ width: 6, height: 6 }} /> EMERGENCY REQUEST
          </span>
          <Link href="/my-requests" className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>
            Submitted cases →
          </Link>
        </div>

        <h1 style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.15, margin: "4px 0 6px" }}>
          What do you need?
        </h1>
        <p style={{ fontSize: "14px", color: "var(--muted)", margin: "0 0 14px" }}>
          Pick all categories that apply. Coordinators review every request in real time.
        </p>

        {/* 1. Category chips from database */}
        {loadingMeta ? (
          <div style={{ margin: "12px 0" }}>
            <Skeleton height="44px" />
          </div>
        ) : categories.length === 0 ? (
          <div style={{ margin: "12px 0" }}>
            <EmptyState
              title="No aid categories loaded"
              description="Ensure the backend API is running and database reference migrations are applied."
            />
          </div>
        ) : (
          <div className="cat-chips" role="group" aria-label="Aid categories from database">
            {categories.map((cat) => {
              const on = selectedCategories.includes(cat.name);
              return (
                <button
                  key={cat.code}
                  type="button"
                  className={`cat-chip ${on ? "on" : ""}`.trim()}
                  onClick={() => toggleCategory(cat.name)}
                  aria-pressed={on}
                >
                  {on && <Icon name="check" size={14} />}
                  {cat.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="stack" style={{ marginTop: "14px", gap: "18px" }}>
          {/* 2. Situation description */}
          <div className="field">
            <label className="label" htmlFor="req-description">
              Tell us about your situation
            </label>
            <textarea
              id="req-description"
              className="textarea"
              placeholder="How many people? Anyone injured, elderly, or with a baby? Describe exact supplies needed…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              style={{ minHeight: "128px" }}
            />
          </div>

          {/* 3. Number of people stepper + Urgency selector */}
          <div style={{ display: "grid", gridTemplateColumns: "170px 1fr", gap: "14px", alignItems: "end" }}>
            <div className="field">
              <label className="label" htmlFor="req-people">
                People affected
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: "1.5px solid var(--border-card)",
                  borderRadius: "14px",
                  height: "46px",
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                <button
                  type="button"
                  onClick={() => setPeopleCount((p) => Math.max(1, p - 1))}
                  style={{
                    width: "44px",
                    height: "100%",
                    border: 0,
                    background: "var(--surface-soft)",
                    fontSize: "18px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  aria-label="Decrease people count"
                >
                  −
                </button>
                <input
                  id="req-people"
                  type="number"
                  min={1}
                  max={500}
                  value={peopleCount}
                  onChange={(e) => setPeopleCount(Math.max(1, Number(e.target.value) || 1))}
                  style={{
                    width: "100%",
                    border: 0,
                    textAlign: "center",
                    fontSize: "16px",
                    fontWeight: 700,
                    outline: "none",
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setPeopleCount((p) => Math.min(500, p + 1))}
                  style={{
                    width: "44px",
                    height: "100%",
                    border: 0,
                    background: "var(--surface-soft)",
                    fontSize: "18px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  aria-label="Increase people count"
                >
                  +
                </button>
              </div>
            </div>

            <div className="field">
              <label className="label">Urgency level</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
                {URGENCY_LEVELS.map((u) => {
                  const active = selfUrgency === u.level;
                  return (
                    <button
                      key={u.level}
                      type="button"
                      onClick={() => setSelfUrgency(u.level)}
                      aria-pressed={active}
                      style={{
                        height: "46px",
                        borderRadius: "12px",
                        border: active ? `2px solid ${u.border}` : "1.5px solid var(--border-card)",
                        background: active ? u.tint : "#fff",
                        fontWeight: active ? 700 : 500,
                        fontSize: "12px",
                        color: "var(--ink)",
                        cursor: "pointer",
                        transition: "all .15s ease",
                      }}
                    >
                      {u.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. Vulnerable / medical flags */}
          <div className="field">
            <label className="label">Vulnerable / medical flags (optional)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {VULNERABLE_FLAGS.map((flag) => {
                const active = vulnerableFlags.includes(flag.id);
                return (
                  <button
                    key={flag.id}
                    type="button"
                    onClick={() => toggleFlag(flag.id)}
                    aria-pressed={active}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "999px",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: active ? "1.5px solid #FF5A4F" : "1.5px solid var(--border-card)",
                      background: active ? "#FFE7E4" : "#fff",
                      color: active ? "#9F1E16" : "var(--ink)",
                      transition: "all .15s ease",
                    }}
                  >
                    {active ? "✓ " : "+ "}
                    {flag.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Right Studio Card: Live Summary + GPS Location + Evidence + Contact & Send */}
      <div style={{ display: "grid", gap: "18px" }}>
        {/* Live Deep-Forest Request Summary Banner */}
        <div className="cit-summary-banner">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", color: "#B9E29A" }}>
              ● LIVE DISPATCH PREVIEW
            </span>
            <span className="mono" style={{ fontSize: 11, color: "#D6E8DF" }}>
              {selectedCategories.length} {selectedCategories.length === 1 ? "category" : "categories"}
            </span>
          </div>
          <div className="cit-summary-stats">
            <div className="cit-summary-cell">
              <span>District</span>
              <b>{location.area || "Select district"}</b>
            </div>
            <div className="cit-summary-cell">
              <span>People</span>
              <b>{peopleCount} {peopleCount === 1 ? "person" : "people"}</b>
            </div>
            <div className="cit-summary-cell">
              <span>Urgency</span>
              <b>{urgencyLabel}</b>
            </div>
          </div>
        </div>

        <div className="card" style={{ borderRadius: "28px", padding: "24px", display: "grid", gap: "18px" }}>
          {/* 5. Location via LocationPicker (GPS by default) */}
          <LocationPicker
            districts={districts}
            value={location}
            onChange={setLocation}
          />

          {/* 6. Optional photo / evidence upload card */}
          <div className="field">
            <label className="label" htmlFor="req-evidence">
              Optional photo / document (JPEG, PNG, PDF · max 5 MB)
            </label>
            <label
              htmlFor="req-evidence"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                padding: "14px 16px",
                borderRadius: "16px",
                border: "1.5px dashed var(--border-strong)",
                background: evidenceFile ? "var(--mint-tint)" : "var(--surface-soft)",
                cursor: "pointer",
              }}
            >
              <div>
                <b style={{ display: "block", fontSize: "13px", color: "var(--ink)" }}>
                  {evidenceFile
                    ? `✓ ${evidenceFile.name} (${Math.round(evidenceFile.size / 1024)} KB)`
                    : "Tap to attach a photo or medical note"}
                </b>
                <span className="muted" style={{ fontSize: "11.5px" }}>
                  {evidenceFile
                    ? "Binary signature verified (JPEG/PNG/PDF)"
                    : "Validated for JPEG, PNG, or PDF up to 5 MB"}
                </span>
              </div>
              <span className="btn btn-ghost btn-sm" style={{ pointerEvents: "none" }}>
                {evidenceFile ? "Change file" : "Choose file"}
              </span>
              <input
                id="req-evidence"
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </label>
            {evidenceError && (
              <span style={{ fontSize: "12px", color: "#9F1E16", fontWeight: 600 }}>
                {evidenceError}
              </span>
            )}
          </div>

          {/* 7. Contact confirmation (mobile and email prefilled) */}
          <div
            style={{
              padding: "16px",
              borderRadius: "20px",
              background: "var(--surface-soft)",
              border: "1px solid var(--border-card)",
              display: "grid",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="label" style={{ margin: 0 }}>
                Contact confirmation (for live email &amp; SMS updates)
              </span>
              <span className="tag tag-mint" style={{ fontSize: "10.5px", padding: "2px 8px" }}>
                Prefilled
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div className="field">
                <label className="label" htmlFor="req-mobile" style={{ fontSize: "11.5px" }}>
                  Mobile number
                </label>
                <input
                  id="req-mobile"
                  type="tel"
                  className="input"
                  placeholder="07XXXXXXXX"
                  value={contactMobile}
                  onChange={(e) => setContactMobile(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="req-email" style={{ fontSize: "11.5px" }}>
                  Email address
                </label>
                <input
                  id="req-email"
                  type="email"
                  className="input"
                  placeholder="you@example.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* 8. Consent checkbox */}
          <label
            className="check-row"
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.preventDefault();
              setConsentGiven((v) => !v);
            }}
          >
            <span className={`check-box ${consentGiven ? "on" : ""}`.trim()}>
              {consentGiven && <Icon name="check" size={12} />}
            </span>
            <span>
              I consent to sharing my location and situation with verified emergency coordinators and field responders.
            </span>
          </label>

          {/* Possible duplicate warning confirmation */}
          {duplicateWarning && (
            <div
              style={{
                padding: "16px",
                borderRadius: "18px",
                background: "var(--sun-tint)",
                border: "1.5px solid var(--sun)",
                display: "grid",
                gap: "10px",
              }}
              role="alert"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="tag tag-sun">Possible duplicate nearby</span>
                <span className="mono" style={{ fontSize: "11.5px", fontWeight: 700 }}>
                  {duplicateWarning.existingTrackingNumber}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--ink)", lineHeight: 1.5 }}>
                {duplicateWarning.message} (Status: <b>{duplicateWarning.status}</b>,{" "}
                {duplicateWarning.distanceMeters}m away). Would you like to view that request or submit this one anyway?
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <Link
                  href={`/my-requests/${duplicateWarning.existingRequestId}`}
                  className="btn btn-ghost btn-sm"
                >
                  View existing ({duplicateWarning.existingTrackingNumber})
                </Link>
                <button
                  type="button"
                  className="btn btn-coral btn-sm"
                  disabled={submitting}
                  onClick={() => void submitRequest(true)}
                >
                  Submit new request anyway
                </button>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              style={{
                padding: "12px 14px",
                borderRadius: "14px",
                background: "#FFE7E4",
                border: "1px solid #FF5A4F",
                color: "#9F1E16",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-coral btn-lg btn-block"
            disabled={submitting || categories.length === 0}
          >
            {submitting ? "Sending request…" : "Send emergency request"}
            <Icon name="arrow" size={16} />
          </button>
        </div>
      </div>
    </form>
  );
}
