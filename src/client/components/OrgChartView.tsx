/**
 * Read-only leadership chart: absolutely-positioned member boxes with SVG
 * connectors drawn manager → report. The designer reuses the geometry constants
 * and edge-path helper so the editor and the public view line up exactly.
 */

import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { memberName } from '../../shared/names';
import { memberAvatar } from '../../shared/avatar';
import type { OrgChart } from '../../shared/orgchart';

export interface ChartMember {
  id: number;
  discordId: string;
  username: string;
  globalName: string | null;
  displayName: string | null;
  avatar: string | null;
  profileImageUrl: string | null;
  rankName: string | null;
  rankSortOrder: number | null;
}

export const BOX_W = 190;
export const BOX_H = 62;
const PAD = 48;

/** A smooth vertical S-curve from a manager's bottom to a report's top. */
export function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const my = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
}

export function chartSize(nodes: { x: number; y: number }[]): { width: number; height: number } {
  return {
    width: Math.max(400, ...nodes.map((n) => n.x + BOX_W)) + PAD,
    height: Math.max(260, ...nodes.map((n) => n.y + BOX_H)) + PAD,
  };
}

export default function OrgChartView({
  chart,
  members,
  linkMembers = false,
}: {
  chart: OrgChart;
  members: ChartMember[];
  /** Wrap boxes in a link to the member's profile (only where the viewer can open it). */
  linkMembers?: boolean;
}) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const nodes = chart.nodes.filter((n) => byId.has(n.memberId));

  if (nodes.length === 0) {
    return <p className="empty">The leadership chart hasn’t been set up yet.</p>;
  }

  const { width, height } = chartSize(nodes);
  const nodeById = new Map(nodes.map((n) => [n.memberId, n]));

  const nodeIds = new Set(nodes.map((n) => n.memberId));
  const children = new Map<number, number[]>();
  const incoming = new Set<number>();
  for (const edge of chart.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
    const list = children.get(edge.from) ?? [];
    list.push(edge.to);
    children.set(edge.from, list);
    incoming.add(edge.to);
  }
  const roots = nodes.map((n) => n.memberId).filter((id) => !incoming.has(id));
  if (!roots.length) roots.push(nodes[0]!.memberId);

  const renderMobileNode = (memberId: number, ancestry: Set<number>) => {
    const member = byId.get(memberId);
    if (!member || ancestry.has(memberId)) return null;
    const next = new Set(ancestry);
    next.add(memberId);
    const childIds = children.get(memberId) ?? [];
    const inner = (
      <>
        <img className="org-mobile-avatar" src={memberAvatar(member, 64)} alt="" />
        <div className="org-mobile-copy">
          <strong>{memberName(member)}</strong>
          {member.rankName && <span>{member.rankName}</span>}
        </div>
      </>
    );

    return (
      <li key={memberId}>
        {linkMembers ? (
          <Link to={`/members/${memberId}`} className="org-mobile-person">
            {inner}
          </Link>
        ) : (
          <div className="org-mobile-person">{inner}</div>
        )}
        {childIds.length > 0 && (
          <ul>{childIds.map((id) => renderMobileNode(id, next))}</ul>
        )}
      </li>
    );
  };

  return (
    <>
      <div className="org-mobile-tree" aria-label="Jerarquía del clan">
        <ul>{roots.map((id) => renderMobileNode(id, new Set()))}</ul>
      </div>
      <div className="org-scroll">
      <div className="org-canvas" style={{ width, height }}>
        <svg className="org-edges" width={width} height={height} aria-hidden>
          {chart.edges.map((e, i) => {
            const a = nodeById.get(e.from);
            const b = nodeById.get(e.to);
            if (!a || !b) return null;
            return (
              <path
                key={i}
                className="org-edge"
                d={edgePath(a.x + BOX_W / 2, a.y + BOX_H, b.x + BOX_W / 2, b.y)}
              />
            );
          })}
        </svg>

        {nodes.map((n) => {
          const m = byId.get(n.memberId)!;
          const style: CSSProperties = { left: n.x, top: n.y, width: BOX_W, height: BOX_H };
          const inner = (
            <>
              <img className="org-box-avatar" src={memberAvatar(m, 48)} alt="" />
              <div className="org-box-text">
                <span className="org-box-name">{memberName(m)}</span>
                {m.rankName && <span className="org-box-rank">{m.rankName}</span>}
              </div>
            </>
          );
          return linkMembers ? (
            <Link key={n.memberId} to={`/members/${n.memberId}`} className="org-box" style={style}>
              {inner}
            </Link>
          ) : (
            <div key={n.memberId} className="org-box" style={style}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}
