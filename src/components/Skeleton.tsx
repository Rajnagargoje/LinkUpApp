import React from "react";
import "./Skeleton.scss";

interface SkeletonProps {
  /** e.g. "18px" or "100%" */
  width?: string;
  height?: string;
  radius?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A single shimmering placeholder block. Compose several inside a
 * flex/grid wrapper to build a skeleton for any real layout — see
 * NotificationSkeletonRow below for the pattern.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = "14px",
  radius = "6px",
  className = "",
  style,
}) => (
  <span
    className={`skeleton-block ${className}`}
    style={{ width, height, borderRadius: radius, ...style }}
    aria-hidden="true"
  />
);

/**
 * Matches the real shape of a .notification-row so the loading state
 * doesn't jump/reflow once real data arrives.
 */
export const NotificationSkeletonRow: React.FC = () => (
  <div className="notification-row notification-row--skeleton">
    <Skeleton width="40px" height="40px" radius="50%" />
    <span className="notification-copy">
      <Skeleton width="55%" height="13px" />
      <Skeleton width="85%" height="12px" style={{ marginTop: 6 }} />
      <Skeleton width="30%" height="10px" style={{ marginTop: 8 }} />
    </span>
  </div>
);

export const NotificationSkeletonList: React.FC<{ count?: number }> = ({
  count = 6,
}) => (
  <div className="notification-list" aria-busy="true" aria-label="Loading notifications">
    {Array.from({ length: count }).map((_, index) => (
      <NotificationSkeletonRow key={index} />
    ))}
  </div>
);

export default Skeleton;
