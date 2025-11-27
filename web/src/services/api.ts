/**
 * HTTP client for API calls
 * Handles authentication, request/response formatting, and error handling
 */

// In development, use proxy if VITE_API_URL is not set
// In production, use VITE_API_URL or fallback to absolute URL
const getApiUrl = (): string => {
  // If VITE_API_URL is explicitly set, use it (for production or custom setup)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // In development mode, use proxy (relative URL)
  if (import.meta.env.DEV) {
    return '/api'; // Proxy configured in vite.config.ts
  }
  
  // Production fallback
  return 'http://localhost:8080/v1';
};

const API_URL = getApiUrl();

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

/**
 * Gets the stored JWT token
 * @returns JWT token or null
 */
function getToken(): string | null {
  return localStorage.getItem('jwt_token');
}

/**
 * Sets the JWT token
 * @param token - JWT token to store
 */
export function setToken(token: string): void {
  localStorage.setItem('jwt_token', token);
}

/**
 * Removes the JWT token
 */
export function clearToken(): void {
  localStorage.removeItem('jwt_token');
}

/**
 * Makes an HTTP request with authentication
 * @param endpoint - API endpoint (without base URL)
 * @param options - Fetch options
 * @returns Promise resolving to response data
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.statusText}`;
    let errorCode: string | undefined;
    
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
      errorCode = errorData.code;
    } catch {
      // If response is not JSON, use status text
    }

    const error: ApiError = {
      message: errorMessage,
      code: errorCode,
      status: response.status,
    };

    // Handle authentication errors
    if (response.status === 401) {
      clearToken();
    }

    throw error;
  }

  // Handle empty responses
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }

  return {} as T;
}

/**
 * GET request
 * @param endpoint - API endpoint
 * @returns Promise resolving to response data
 */
export async function get<T>(endpoint: string): Promise<T> {
  return request<T>(endpoint, { method: 'GET' });
}

/**
 * POST request
 * @param endpoint - API endpoint
 * @param data - Request body data
 * @returns Promise resolving to response data
 */
export async function post<T>(endpoint: string, data?: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT request
 * @param endpoint - API endpoint
 * @param data - Request body data
 * @returns Promise resolving to response data
 */
export async function put<T>(endpoint: string, data?: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PATCH request
 * @param endpoint - API endpoint
 * @param data - Request body data
 * @returns Promise resolving to response data
 */
export async function patch<T>(endpoint: string, data?: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE request
 * @param endpoint - API endpoint
 * @returns Promise resolving to response data
 */
export async function del<T>(endpoint: string): Promise<T> {
  return request<T>(endpoint, { method: 'DELETE' });
}

