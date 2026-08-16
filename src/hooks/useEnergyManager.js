// src/hooks/useEnergyManager.js
import { useCallback, useEffect, useState } from 'react';
import { decideRecommendation, getRecommendation, getRecommendationHistory } from '../api/client.js';

export function useEnergyManager() {
  const [recommendation, setRecommendation] = useState(null);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error | not-trained
  const [error, setError] = useState(null);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await getRecommendationHistory());
    } catch {
      // history is secondary; ignore failures here, the main status covers it
    }
  }, []);

  const refresh = useCallback(async (params) => {
    setStatus('loading');
    try {
      const result = await getRecommendation(params);
      setRecommendation(result);
      setStatus('ready');
      setError(null);
      loadHistory();
    } catch (err) {
      setError(err);
      setStatus(err.status === 503 ? 'not-trained' : 'error');
    }
  }, [loadHistory]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const decide = useCallback(async (id, decision) => {
    await decideRecommendation(id, decision);
    loadHistory();
  }, [loadHistory]);

  return { recommendation, history, status, error, refresh, decide };
}
