const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined') {
    const { protocol, host, hostname } = window.location;
    // Handle cloud workspace subdomains (e.g. 3000-xxx.workspace.domain)
    if (hostname.includes('3000')) {
      return `${protocol}//${host.replace('3000', '8000')}`;
    }
    // Handle standard port-based URLs (e.g. localhost:3000, 127.0.0.1:3000)
    if (host.includes(':3000')) {
      return `${protocol}//${host.replace(':3000', ':8000')}`;
    }
    // Fallback to hostname with port 8000
    return `${protocol}//${hostname}:8000`;
  }
  return 'http://localhost:8000';
};

export const API_BASE_URL = getApiBaseUrl();

