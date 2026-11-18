import Link from "next/link";
import { cookies } from "next/headers";
import { getPublicStats, getRequests, type RequestDetail } from "@/lib/api";
import { MainDashboardHub } from "./MainDashboardHub";

const STEPS = ["Ask", "Verify", "Decide", "Dispatch", "Record"];
const ROLES = ["Citizens", "Coordinators", "Case managers", "Logistics", "Shelters", "Volunteers", "Donors", "Partners"];

export default async function LandingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("aegis_token")?.value;
  const role = cookieStore.get("aegis_role")?.value;
  const isLoggedIn = Boolean(token);
  const isCitizen = isLoggedIn && (!role || role === "Citizen");
  const isStaff = isLoggedIn && Boolean(role && role !== "Citizen");

  const [{ data: stats }, citizenReqResult] = await Promise.all([
    getPublicStats(),
    isCitizen ? getRequests() : Promise.resolve({ data: [] as RequestDetail[], error: null }),
  ]);
  const citizenRequests = citizenReqResult.data;

  // Only real public aggregates from GET /api/v1/public/stats; hidden when zero.
  const live = stats
    ? [
        { label: "Requests resolved", value: stats.resolvedRequestsCount },
        { label: "Active crises", value: stats.activeCrisesCount },
        { label: "Shelters open", value: stats.openSheltersCount },
        { label: "People sheltered", value: stats.shelteredPeopleCount },
      ].filter((m) => m.value > 0)
    : [];

  return (
    <div className="lp">
      <i className="lp-bb lp-b1" aria-hidden="true" />
      <i className="lp-bb lp-b2" aria-hidden="true" />
      <i className="lp-bb lp-b3" aria-hidden="true" />

      <header className="lp-hero">
        <div className="lp-bdg">
          <i className="lp-dot" />
          Built for Sri Lanka · English · සිංහල · தமிழ்
        </div>
        <h1 className="lp-h1">
          Relief that is{" "}
          <span className="cyc">
            <span>
              <b>seen.</b>
              <b>verified.</b>
              <b>dispatched.</b>
              <b>answered.</b>
              <b>seen.</b>
            </span>
          </span>
        </h1>
        <p className="lp-lead">
          One live map and one chat for families, coordinators and volunteers. AI suggests, a real person decides, and every step is on the record.
        </p>
        <div className="lp-ctas">
          {isCitizen ? (
            <>
              <Link className="lbtn cor" href="/request">Request help now</Link>
              <Link className="lbtn dk" href="/my-requests">My requests</Link>
            </>
          ) : isStaff ? (
            <>
              <Link className="lbtn cor" href="/admin/chat">Staff chat inbox</Link>
              <Link className="lbtn dk" href="/admin">Admin console</Link>
            </>
          ) : (
            <>
              <Link className="lbtn cor" href="/register">Request help now</Link>
              <Link className="lbtn dk" href="/login">Citizen sign in</Link>
              <Link className="lbtn dk" href="/staff/login">Staff sign in</Link>
            </>
          )}
        </div>
      </header>

      <MainDashboardHub
        isLoggedIn={isLoggedIn}
        isCitizen={isCitizen}
        isStaff={isStaff}
        citizenRequests={citizenRequests}
      />

      {live.length > 0 && (
        <section
          aria-label="Live public statistics"
          className="kpis"
          style={{ position: "relative", zIndex: 2, maxWidth: "1208px", margin: "0 auto 16px", padding: "0 16px" }}
        >
          {live.map((m) => (
            <div className="kpi" key={m.label}>
              <span>{m.label}</span>
              <b>{m.value}</b>
            </div>
          ))}
        </section>
      )}

      <section className="lp-bento" aria-label="Product overview">
        {/* Real Sri Lanka OpenStreetMap tile */}
        <div className="lp-t lp-a" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
          <iframe
            title="Sri Lanka operations map"
            src="https://www.openstreetmap.org/export/embed.html?bbox=79.52,5.90,81.90,9.85&layer=mapnik"
            style={{ width: "100%", height: "100%", minHeight: "360px", border: 0, display: "block" }}
            loading="lazy"
          />
          <div
            className="lp-live"
            style={{
              background: "rgba(12, 18, 48, 0.86)",
              backdropFilter: "blur(8px)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.16)",
            }}
          >
            <i />
            Sri Lanka · {stats ? `${stats.openRequestsCount} open requests · ${stats.openSheltersCount} shelters` : "Live Operations Map"}
          </div>
        </div>

        {/* AI tile (violet = AI only) */}
        <div className="lp-t lp-b">
          <span className="ai-chip mono">AI SUGGESTION</span>
          <div className="lp-rr">
            <svg width="88" height="88" viewBox="0 0 92 92" aria-hidden="true">
              <circle cx="46" cy="46" r="38" fill="none" stroke="#fff" strokeWidth="9" />
              <circle
                className="ai-ring"
                style={{ ["--c" as string]: 239, strokeDashoffset: 80 }}
                cx="46" cy="46" r="38" fill="none" stroke="#7C3AED" strokeWidth="9" strokeLinecap="round" transform="rotate(-90 46 46)"
              />
            </svg>
            <div style={{ fontSize: 19, lineHeight: 1.25, fontWeight: 600, letterSpacing: "-.02em" }}>
              AI explains its reasoning. A person approves.
            </div>
          </div>
          <div className="lp-chips">
            <span>Urgency</span><span>Vulnerability</span><span>Waiting time</span><span>Distance</span><span>Supply fit</span>
          </div>
        </div>

        {/* Chat tile */}
        <div className="lp-t lp-c">
          <div className="lp-lbl mono" style={{ color: "#0B6B4D" }}>Chat with the relief team</div>
          <div className="lp-bub" />
          <div className="lp-bub u" />
          <div className="lp-ty" aria-hidden="true"><i /><i /><i /></div>
        </div>

        <div className="lp-t lp-d">
          <div className="lp-lbl mono">Request in 3 steps</div>
          <div className="lp-big">3</div>
          <div className="lp-tl">What you need, where you are, send. Confirmation arrives by email.</div>
          <div className="lp-arw" aria-hidden="true">→</div>
        </div>

        <div className="lp-t lp-e">
          <div className="lp-lbl mono">Covering every district</div>
          <div className="lp-big lp-cnt" style={{ ["--n" as string]: 25 }} />
          <div className="lp-tl">districts across the island</div>
        </div>

        <div className="lp-t lp-f">
          <div className="lp-env" aria-hidden="true"><i /></div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.2 }}>Every update lands in your inbox.</div>
          <div className="lp-tl" style={{ color: "#B7BDDA", fontWeight: 400 }}>Verification codes, approvals, messages.</div>
        </div>

        <div className="lp-t lp-g">
          <div className="lp-lbl mono" style={{ color: "#CDEFF2" }}>Ask in your language</div>
          <div className="lp-lc">
            <div>
              <b>Help</b><b>උදව්</b><b>உதவி</b><b>مساعدة</b><b>Aide</b><b>Ayuda</b><b>Help</b>
            </div>
          </div>
          <div className="lp-tl" style={{ fontWeight: 400, color: "#CDEFF2" }}>Sinhala, Tamil and English.</div>
        </div>

        <div className="lp-t lp-h" id="how">
          <h2 className="lp-h2">From a worried message to help at the door</h2>
          <p className="lp-p">Follow every step of your request.</p>
          <div className="lp-st">
            {STEPS.map((s, i) => (
              <div className="lp-sp" key={s}>
                <b>{i + 1}</b>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lp-t lp-i">
          <h2 className="lp-h2">A record nobody can quietly edit</h2>
          <p className="lp-p" style={{ marginBottom: 14 }}>Each entry is linked to the one before.</p>
          <div className="lp-hs"><b>AI suggested</b><span className="mono" style={{ color: "#585E7A" }}>linked entry</span></div>
          <div className="lp-hs"><b>Staff decided</b><span className="mono" style={{ color: "#585E7A" }}>linked entry</span></div>
          <div className="lp-hs"><b>Dispatched</b><span className="mono" style={{ color: "#585E7A" }}>linked entry</span></div>
        </div>
      </section>

      <div className="lp-mq" aria-hidden="true">
        <div>
          {[...ROLES, ...ROLES].map((r, i) => (
            <span key={`${r}-${i}`}>{r}</span>
          ))}
        </div>
      </div>

      <section className="lp-cta">
        <h3>Ready before the next emergency.</h3>
        <p>Create an account in under a minute, using only your NIC.</p>
        <Link className="lbtn cor" href="/register">Create an account</Link>
      </section>
    </div>
  );
}
