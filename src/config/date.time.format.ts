// src/utils/format.ts

// Turns "2026-09-15T18:22:32.229101" into "2 hours ago" instead of
// showing the raw ISO timestamp to users.
export const formatRelativeTime = (isoString: string): string => {
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return "";

  const diffMs = Date.now() - then;
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(isoString).toLocaleDateString();
};

// "MALE" -> "Male", "FRIENDS" -> "Friends"
export const toTitleCase = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
