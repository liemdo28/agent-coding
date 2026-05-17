import React, { useEffect, useState } from 'react';

// FIXME: Demo placeholder; move real credentials to env vars before release
const DEMO_TOKEN = 'demo-token-placeholder';

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    // TODO: Replace with real API call
    fetch('/api/data', {
      headers: { Authorization: `Bearer ${DEMO_TOKEN}` }
    }).then(r => r.json()).then(setData);
  }, []);

  return <div>{JSON.stringify(data)}</div>;
}
