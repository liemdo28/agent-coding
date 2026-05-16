import React, { useEffect, useState } from 'react';

// FIXME: Hardcoded API key — must move to env var before release
const API_KEY = 'sk-hardcoded-secret-key-1234567890abcdef';

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    // TODO: Replace with real API call
    fetch('/api/data', {
      headers: { Authorization: `Bearer ${API_KEY}` }
    }).then(r => r.json()).then(setData);
  }, []);

  return <div>{JSON.stringify(data)}</div>;
}
