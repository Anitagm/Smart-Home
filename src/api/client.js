// src/api/client.js
//
// Thin fetch wrapper around the Django backend (see /backend). The base URL
// is configurable via VITE_API_BASE_URL (see .env.example) so the same
// build can point at a local dev server or a deployed API.

// Falls back to "same host the page was loaded from, port 8000" so a build
// served from a remote box still reaches its own backend without a
// hard-coded VITE_API_BASE_URL at build time.
const BASE_URL = import.meta.env.VITE_API_BASE_URL
  || `${window.location.protocol}//${window.location.hostname}:8000/api`;

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
  } catch (networkErr) {
    throw new ApiError(`Could not reach the AI backend at ${BASE_URL}. Is it running? (${networkErr.message})`, 0);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed with status ${res.status}`, res.status);
  }
  return data;
}

// --- Forecasting (Direction A) -------------------------------------------
export function getForecast(horizon = 48) {
  return request(`/forecasting/forecast/?horizon=${horizon}`);
}

export function getForecastWhatIf({ horizon = 48, whatifKwh, whatifHours }) {
  return request('/forecasting/forecast/', {
    method: 'POST',
    body: JSON.stringify({ horizon, whatif_kwh: whatifKwh, whatif_hours: whatifHours })
  });
}

// --- Occupancy (Direction C) ----------------------------------------------
export function predictOccupancy(rooms) {
  return request('/occupancy/predict/', {
    method: 'POST',
    body: JSON.stringify({ rooms })
  });
}

// --- Energy manager / DRL (Direction D) -----------------------------------
export function getRecommendation({ hour, batteryPercent } = {}) {
  const params = new URLSearchParams();
  if (hour != null) params.set('hour', hour);
  if (batteryPercent != null) params.set('battery_percent', batteryPercent);
  const qs = params.toString();
  return request(`/energy-manager/recommend/${qs ? `?${qs}` : ''}`);
}

export function getRecommendationHistory() {
  return request('/energy-manager/history/');
}

export function decideRecommendation(id, status) {
  return request(`/energy-manager/recommendations/${id}/decide/`, {
    method: 'POST',
    body: JSON.stringify({ status })
  });
}

export { ApiError };
