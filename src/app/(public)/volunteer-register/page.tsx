"use client";

import { useState } from "react";
import { Button, Toast } from "@/components/ui";
import { AuthShell } from "@/components/auth/AuthShell";

const DISTRICTS = ["Colombo", "Gampaha", "Kalutara", "Kandy", "Galle", "Matara", "Ratnapura", "Kurunegala", "Jaffna", "Batticaloa"];

export default function PublicVolunteerRegisterPage() {
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [skills, setSkills] = useState("");
  const [district, setDistrict] = useState("Colombo");
  const [availability, setAvailability] = useState("Immediate");
  const [nic, setNic] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ops/volunteers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          skills: skills.trim(),
          district,
          availability,
          nic: nic.trim() || null,
          latitude: 6.9271,
          longitude: 79.8612,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || "Registration failed.");
      else {
        setDone(`Thank you, ${data.fullName}. Your volunteer profile is queued for staff verification.`);
        setFullName("");
        setPhoneNumber("");
        setSkills("");
        setNic("");
      }
    } catch {
      setError("Network error while registering volunteer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      theme="citizen"
      badge="VOLUNTEER SIGN-UP"
      asideTitle="Join the field response network."
      asideLead="Register your skills and availability. A Volunteer Coordinator verifies your profile before field assignments."
      trustItems={[
        { icon: "shield", title: "Optional NIC protection", detail: "If provided, your NIC is encrypted at rest and displayed masked." },
        { icon: "people", title: "Skill-based matching", detail: "Matched to nearby cases needing your medical, driving, or language skills." },
      ]}
    >
      <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700 }}>Volunteer registration</h1>
      <p className="muted" style={{ margin: "0 0 18px", fontSize: 13.5 }}>
        Short sign-up for Sri Lanka disaster relief volunteers.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 13 }}>
        <div>
          <label className="bento-label">Full name</label>
          <input className="bento-input" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="auth-two-col">
          <div>
            <label className="bento-label">Mobile</label>
            <input className="bento-input mono" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="07XXXXXXXX" />
          </div>
          <div>
            <label className="bento-label">District</label>
            <select className="bento-select" value={district} onChange={(e) => setDistrict(e.target.value)}>
              {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="bento-label">Skills (comma-separated)</label>
          <input className="bento-input" required value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="e.g. FirstAid, Driving, Sinhala, Tamil" />
        </div>
        <div className="auth-two-col">
          <div>
            <label className="bento-label">Availability</label>
            <select className="bento-select" value={availability} onChange={(e) => setAvailability(e.target.value)}>
              <option value="Immediate">Immediate</option>
              <option value="Weekends">Weekends</option>
              <option value="Nights">Nights</option>
            </select>
          </div>
          <div>
            <label className="bento-label">NIC (optional, encrypted)</label>
            <input className="bento-input mono" value={nic} onChange={(e) => setNic(e.target.value)} placeholder="Optional" />
          </div>
        </div>

        {error && <Toast tone="critical">{error}</Toast>}
        {done && <Toast tone="success">{done}</Toast>}

        <Button type="submit" fullWidth pill disabled={loading}>
          {loading ? "Submitting…" : "Register as volunteer →"}
        </Button>
      </form>
    </AuthShell>
  );
}
