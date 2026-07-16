/**
 * SSRF (Server-Side Request Forgery) Prevention
 * 
 * Blocks URLs with hostnames that resolve to private, loopback, or link-local IP addresses.
 * This prevents the shortener from being used as a proxy to internal services.
 * 
 * Design Note:
 * - Synchronous IP range checking for immediate validation
 * - Checks hostname directly for IPv4/IPv6 format
 * - Also checks common hostnames like localhost, 127.0.0.1, etc.
 * 
 * Blocked ranges:
 * IPv4:
 *  - 127.0.0.0/8 (loopback)
 *  - 10.0.0.0/8 (private)
 *  - 172.16.0.0/12 (private)
 *  - 192.168.0.0/16 (private)
 *  - 169.254.0.0/16 (link-local)
 * 
 * IPv6:
 *  - ::1/128 (loopback)
 *  - fc00::/7 (unique local)
 *  - fe80::/10 (link-local)
 * 
 * Limitations:
 * - Does NOT perform DNS resolution (synchronous only)
 * - Hostname to IP mapping requires async DNS, deferred to infrastructure layer
 * - Relies on hostname being an IP address or known private hostname
 */

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const [a, b, c, d] = parts;

  return (
    // 127.0.0.0/8 (loopback)
    a === 127 ||
    // 10.0.0.0/8 (private)
    a === 10 ||
    // 172.16.0.0/12 (private)
    (a === 172 && b >= 16 && b <= 31) ||
    // 192.168.0.0/16 (private)
    (a === 192 && b === 168) ||
    // 169.254.0.0/16 (link-local)
    (a === 169 && b === 254) ||
    // 0.0.0.0/8 (this network)
    a === 0
  );
}

function isPrivateIPv6(ip: string): boolean {
  // Normalize IPv6 address for easier comparison
  const normalized = ip.toLowerCase();

  // ::1/128 (loopback)
  if (normalized === '::1') {
    return true;
  }

  // fc00::/7 (unique local)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }

  // fe80::/10 (link-local)
  if (normalized.startsWith('fe80:')) {
    return true;
  }

  // 127::/8 (loopback)
  if (normalized.startsWith('127:')) {
    return true;
  }

  return false;
}

function isPrivateHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    lower === '[::1]'
  );
}

/**
 * Check if hostname points to a private/loopback/link-local address
 * 
 * @param hostname - The hostname from URL (e.g., "example.com", "localhost", "127.0.0.1")
 * @returns true if hostname is private/loopback/link-local, false otherwise
 * 
 * Note: This performs synchronous checks only.
 * Full DNS resolution would be required for complete SSRF prevention,
 * but that requires async operations. This covers the most common cases.
 */
export function isSSRFRisk(hostname: string): boolean {
  if (!hostname) {
    return false;
  }

  // Remove brackets from IPv6 addresses (e.g., "[::1]" -> "::1")
  const cleaned = hostname.replace(/^\[|\]$/g, '');

  // Check if it looks like IPv4
  if (/^\d+\.\d+\.\d+\.\d+$/.test(cleaned)) {
    return isPrivateIPv4(cleaned);
  }

  // Check if it looks like IPv6 (contains :)
  if (cleaned.includes(':')) {
    return isPrivateIPv6(cleaned);
  }

  // Check against known private hostnames
  return isPrivateHostname(cleaned);
}
