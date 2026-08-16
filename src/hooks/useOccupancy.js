// src/hooks/useOccupancy.js
import { useCallback, useEffect, useState } from 'react';
import { predictOccupancy } from '../api/client.js';
import { rooms } from '../data/rooms-data.js';

export function useOccupancy(pollMs = 30000) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error | not-trained
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await predictOccupancy(rooms);
      setData(result);
      setStatus('ready');
      setError(null);
    } catch (err) {
      setError(err);
      setStatus(err.status === 503 ? 'not-trained' : 'error');
    }
  }, []);

  useEffect(() => {
    load();
    if (!pollMs) return undefined;
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  return { data, status, error, reload: load };
}
