import Link from "next/link";
import { cookies } from "next/headers";
import { getPublicStats, getRequests, type RequestDetail } from "@/lib/api";
import { Icon, type IconName } from "@/components/icons/Icon";
import { MainDashboardHub } from "./MainDashboardHub";

const PIPELINE: { num: string; title: string; detail: string; icon: IconName }[] = [
  { num: "01", title: "Ask", detail: "Share family needs & GPS", icon: "pin" },
  { num: "02", title: "Verify", detail: "NIC vault & duplicate check", icon: "shield" },
  { num: "03", title: "Decide", detail: "AI ranks, human approves", icon: "spark" },
  { num: "04", title: "Dispatch", detail: "Supplies & shelter routed", icon: "box" },
  { num: "05", title: "Record", detail: "Sealed in SHA-256 chain", icon: "check" },
];
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

      {isLoggedIn && (
        <MainDashboardHub
          isLoggedIn={isLoggedIn}
          isCitizen={isCitizen}
          isStaff={isStaff}
          citizenRequests={citizenRequests}
        />
      )}

      {live.length > 0 && (
        <section
          aria-label="Live public statistics"
          className="kpis"
          style={{
            position: "relative",
            zIndex: 2,
            maxWidth: "1208px",
            margin: "0 auto 20px",
            padding: "0 16px",
            gridTemplateColumns: `repeat(auto-fit, minmax(210px, 1fr))`,
          }}
        >
          {live.map((m) => (
            <div className="kpi" key={m.label}>
              <div className="kpi-top">
                <span className="kpi-lbl">{m.label}</span>
                <span className="tag tag-mint">Live</span>
              </div>
              <div className="kpi-num mono">{m.value}</div>
            </div>
          ))}
        </section>
      )}

      <section className="lp-bento" aria-label="Product overview">
        <div className="lp-t lp-d lp-flex-tile">
          <div className="lp-card-top">
            <span className="lp-lbl mono" style={{ margin: 0, color: "rgba(255,255,255,0.86)" }}>01 · Rapid intake</span>
            <Link href="/register" className="lp-arw-inline" aria-label="Request in 3 steps">→</Link>
          </div>
          <div>
            <div className="lp-big">3</div>
            <div className="lp-tl">What you need, where you are, send. Confirmation arrives by email.</div>
          </div>
          <div className="lp-mini-pills">
            <span>1. Need</span>
            <span>2. GPS Pin</span>
            <span>3. Send</span>
          </div>
        </div>

        <div className="lp-t lp-e lp-flex-tile">
          <div className="lp-card-top">
            <span className="lp-lbl mono" style={{ margin: 0, color: "#153024" }}>02 · Island-wide grid</span>
            <span className="lp-dot-live" aria-hidden="true" />
          </div>
          <div>
            <div className="lp-big lp-cnt" style={{ ["--n" as string]: 25 }} />
            <div className="lp-tl">districts connected across Sri Lanka</div>
          </div>
          <div className="lp-mini-pills dark-ink">
            <span>Western</span>
            <span>Central</span>
            <span>Southern</span>
            <span>North &amp; East</span>
          </div>
        </div>

        <div className="lp-t lp-f lp-flex-tile">
          <div className="lp-card-top">
            <div className="lp-mail-badge" aria-hidden="true">
              <Icon name="mail" size={18} />
              <i />
            </div>
            <span className="lp-lbl mono" style={{ margin: 0, color: "#9EC2B5" }}>03 · Verified alerts</span>
          </div>
          <div>
            <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.025em", lineHeight: 1.2 }}>
              Every update lands in your inbox.
            </div>
            <div className="lp-tl" style={{ color: "#BDD3CA", fontWeight: 400, marginTop: 8 }}>
              6-digit OTPs, approvals, and dispatch notices.
            </div>
          </div>
          <div className="lp-inbox-preview mono">
            <span>✓ Instant OTP</span>
            <span>·</span>
            <span>Live status</span>
          </div>
        </div>

        <div className="lp-t lp-g lp-flex-tile">
          <div className="lp-card-top">
            <span className="lp-lbl mono" style={{ margin: 0, color: "#D6ECE4" }}>04 · Trilingual</span>
            <span className="lp-lang-pill mono">EN · සිං · த</span>
          </div>
          <div className="lp-lc lp-lc-lk">
            <div>
              <b>Help</b>
              <b>උදව්</b>
              <b>உதவி</b>
              <b>Help</b>
            </div>
          </div>
          <div>
            <div className="lp-tl" style={{ fontWeight: 500, color: "#E4F2EC", marginTop: 0 }}>
              Sinhala, Tamil and English.
            </div>
            <div className="lp-mini-pills" style={{ marginTop: 10 }}>
              <span>English</span>
              <span>සිංහල</span>
              <span>தமிழ்</span>
            </div>
          </div>
        </div>

        <div className="lp-t lp-h" id="how">
          <div className="lp-card-top" style={{ marginBottom: 18 }}>
            <div>
              <span className="eyebrow" style={{ color: "var(--teal)" }}>END-TO-END WORKFLOW</span>
              <h2 className="lp-h2" style={{ marginTop: 4 }}>From a worried message to help at the door</h2>
              <p className="lp-p">Follow every step of your request in real time with complete accountability.</p>
            </div>
            <Link href="/register" className="btn btn-teal btn-sm" style={{ textDecoration: "none", whiteSpace: "nowrap" }}>
              Start request →
            </Link>
          </div>

          <div className="lp-modern-steps">
            {PIPELINE.map((step) => (
              <div className="lp-step-card" key={step.num}>
                <div className="lp-step-head">
                  <span className="lp-step-ico">
                    <Icon name={step.icon} size={16} />
                  </span>
                  <span className="mono lp-step-num">{step.num}</span>
                </div>
                <b>{step.title}</b>
                <p>{step.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="lp-t lp-i">
          <span className="eyebrow" style={{ color: "var(--teal)" }}>TAMPER-EVIDENT LEDGER</span>
          <h2 className="lp-h2" style={{ marginTop: 4 }}>A record nobody can quietly edit</h2>
          <p className="lp-p" style={{ marginBottom: 16 }}>Each entry is cryptographically linked to the one before.</p>

          <div className="lp-modern-chain">
            <div className="lp-chain-item ai">
              <span className="lp-chain-dot ai" />
              <div className="lp-chain-card ai">
                <div className="lp-chain-row">
                  <b>AI suggested priority</b>
                  <span className="tag tag-ai" style={{ padding: "2px 8px", fontSize: 10 }}>AI</span>
                </div>
                <span className="mono lp-chain-hash">hash: #a9f4 · prev: #0000</span>
              </div>
            </div>

            <div className="lp-chain-item">
              <span className="lp-chain-dot sage" />
              <div className="lp-chain-card">
                <div className="lp-chain-row">
                  <b>Staff coordinator decided</b>
                  <span className="tag tag-teal" style={{ padding: "2px 8px", fontSize: 10 }}>Verified</span>
                </div>
                <span className="mono lp-chain-hash">hash: #3c8e · prev: #a9f4</span>
              </div>
            </div>

            <div className="lp-chain-item">
              <span className="lp-chain-dot moss" />
              <div className="lp-chain-card">
                <div className="lp-chain-row">
                  <b>Relief dispatched</b>
                  <span className="tag tag-mint" style={{ padding: "2px 8px", fontSize: 10 }}>Sealed</span>
                </div>
                <span className="mono lp-chain-hash">hash: #f17b · prev: #3c8e</span>
              </div>
            </div>
          </div>
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
