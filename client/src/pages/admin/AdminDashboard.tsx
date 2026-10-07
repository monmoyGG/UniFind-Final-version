import { Link } from "react-router-dom";
import { ArrowRight, FileWarning, Package, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApi } from "@/hooks/useApi";
import { adminService } from "@/services/adminService";
import { PageHeader, Panel, StatCard } from "@/components/common/PageHeader";
import { ErrorMessage, LoadingSpinner } from "@/components/common/Feedback";

/* Charts read from the same tokens as the rest of the interface. Recharts wants
   concrete colours rather than CSS variables, so section 1 of index.css is the
   source these are copied from — keep them in step if the palette moves. */
const INK = "#2d3436";
const MUTED = "#7a869a";
const ACCENT = "#e98b29";
const LOST = "#c0554b";
const FOUND = "#3f8f6b";
const PENDING = "#c98a1f";
const SURFACE = "#f0f2f5";
const SHADOW = "#babecc";

const TOOLTIP_STYLE = {
  background: SURFACE,
  border: "none",
  borderRadius: 14,
  boxShadow: `5px 5px 12px ${SHADOW}, -5px -5px 12px #ffffff`,
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 12,
  color: INK,
};

/** Admin overview — platform health at a glance. */
export function AdminDashboard() {
  const { data, loading, error, reload } = useApi(signal => adminService.stats(signal), []);

  if (loading) return <LoadingSpinner label="Loading platform statistics…" />;
  if (error) return <ErrorMessage message={error} onRetry={reload} />;

  // The API returns six counters; these are the two views worth drawing. Lost
  // against found is the balance an administrator actually watches, and the
  // case mix says whether things are moving through to resolution.
  const typeSplit = [
    { name: "Lost", value: data?.lost_posts ?? 0, fill: LOST },
    { name: "Found", value: data?.found_posts ?? 0, fill: FOUND },
  ];

  const caseMix = [
    { name: "ACTIVE", value: data?.active_posts ?? 0, fill: ACCENT },
    { name: "RESOLVED", value: data?.resolved_cases ?? 0, fill: FOUND },
    { name: "FLAGGED", value: data?.pending_moderation ?? 0, fill: PENDING },
  ];

  const hasCharts = typeSplit.some(entry => entry.value > 0) || caseMix.some(e => e.value > 0);

  return (
    <div className="page">
      <PageHeader
        eyebrow="ADMIN CONSOLE"
        title="Platform activity."
        description="Careful moderation, clear outcomes. Every action here is checked against your administrator account on the server."
      />

      <div className="stat-grid admin-stat-grid">
        <StatCard label="ACTIVE POSTS" value={data?.active_posts ?? 0} note="Open and pending" accent />
        <StatCard label="LOST POSTS" value={data?.lost_posts ?? 0} note="Currently visible" />
        <StatCard label="FOUND POSTS" value={data?.found_posts ?? 0} note="Currently visible" />
        <StatCard
          label="PENDING MODERATION"
          value={data?.pending_moderation ?? 0}
          note="Open reports"
        />
        <StatCard label="RESOLVED CASES" value={data?.resolved_cases ?? 0} note="Items reunited" />
        <StatCard label="REGISTERED MEMBERS" value={data?.total_users ?? 0} note="UIU accounts" />
      </div>

      {hasCharts && (
        <div className="admin-chart-grid">
          <Panel label="REPORT BALANCE" title="Lost against found.">
            <div className="admin-chart">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={typeSplit}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={54}
                    outerRadius={84}
                    paddingAngle={3}
                    stroke={SURFACE}
                    strokeWidth={3}
                  >
                    {typeSplit.map(entry => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend
                    verticalAlign="bottom"
                    height={28}
                    formatter={value => <span style={{ color: MUTED, fontSize: 12 }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="panel-note">
              A heavy lean either way is worth a look: many lost and few found usually means the
              network needs more people posting what they pick up.
            </p>
          </Panel>

          <Panel label="CASE MIX" title="Where cases sit." >
            <div className="admin-chart">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={caseMix} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: MUTED, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
                    axisLine={{ stroke: SHADOW }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: MUTED, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(233,139,41,0.08)" }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={54}>
                    {caseMix.map(entry => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="panel-note">
              Flagged content is the column to keep at zero — every bar there is a member waiting on
              a moderation decision.
            </p>
          </Panel>
        </div>
      )}

      <Panel label="QUICK LINKS" title="Where to go next.">
        <div className="quick-links">
          <Link to="/admin/posts" className="quick-link recessed">
            <Package size={20} />
            <div>
              <strong>Manage posts</strong>
              <span>Review, remove, or restore any listing.</span>
            </div>
            <ArrowRight size={16} />
          </Link>

          <Link to="/admin/reports" className="quick-link recessed">
            <FileWarning size={20} />
            <div>
              <strong>Review reports</strong>
              <span>Work through flagged content.</span>
            </div>
            <ArrowRight size={16} />
          </Link>

          <Link to="/admin/users" className="quick-link recessed">
            <Users size={20} />
            <div>
              <strong>User administration</strong>
              <span>Suspend or reinstate a member when necessary.</span>
            </div>
            <ArrowRight size={16} />
          </Link>
        </div>
      </Panel>
    </div>
  );
}
