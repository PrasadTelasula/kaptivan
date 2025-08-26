/**
 * Formats a duration in a human-readable format like Kubernetes does
 * @param startTime - ISO timestamp string
 * @returns Formatted age string (e.g., "2d", "3h", "45m", "30s")
 */
export function formatAge(startTime?: string | null): string {
  if (!startTime) return '-';
  
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  
  if (diffMs < 0) return '-';
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const years = Math.floor(days / 365);
  
  if (years > 0) {
    return `${years}y`;
  }
  if (days > 0) {
    return `${days}d`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * Gets a more detailed age description
 * @param startTime - ISO timestamp string
 * @returns Detailed age string (e.g., "2 days 3 hours")
 */
export function formatDetailedAge(startTime?: string | null): string {
  if (!startTime) return 'Unknown';
  
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  
  if (diffMs < 0) return 'Unknown';
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const years = Math.floor(days / 365);
  
  const parts: string[] = [];
  
  if (years > 0) {
    parts.push(`${years} year${years > 1 ? 's' : ''}`);
    const remainingDays = days % 365;
    if (remainingDays > 0) {
      parts.push(`${remainingDays} day${remainingDays > 1 ? 's' : ''}`);
    }
  } else if (days > 0) {
    parts.push(`${days} day${days > 1 ? 's' : ''}`);
    const remainingHours = hours % 24;
    if (remainingHours > 0) {
      parts.push(`${remainingHours} hour${remainingHours > 1 ? 's' : ''}`);
    }
  } else if (hours > 0) {
    parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes > 0) {
      parts.push(`${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`);
    }
  } else if (minutes > 0) {
    parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds > 0) {
      parts.push(`${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''}`);
    }
  } else {
    parts.push(`${seconds} second${seconds > 1 ? 's' : ''}`);
  }
  
  return parts.slice(0, 2).join(' ') || 'Just now';
}