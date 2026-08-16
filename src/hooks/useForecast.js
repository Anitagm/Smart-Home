// src/hooks/useForecast.js
import { useCallback, useEffect, useState } from 'react';
import { getForecast, getForecastWhatIf } from '../api/client.js';

export function useForecast(horizon = 48) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error | not-trained
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const result = await getForecast(horizon);
      setData(result);
      setStatus('ready');
    } catch (err) {
      setError(err);
      setStatus(err.status === 503 ? 'not-trained' : 'error');
    }
  }, [horizon]);

  useEffect(() => {
    load();
  }, [load]);

  const applyWhatIf = useCallback(async (whatifKwh, whatifHours) => {
    setStatus('loading');
    try {
      const result = await getForecastWhatIf({ horizon, whatifKwh, whatifHours });
      setData(result);
      setStatus('ready');
    } catch (err) {
      setError(err);
      setStatus(err.status === 503 ? 'not-trained' : 'error');
    }
  }, [horizon]);

  return { data, status, error, reload: load, applyWhatIf };
}
