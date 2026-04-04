export const queryBigQuery = async (query: string) => {
  const response = await fetch('/api/bigquery/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to query BigQuery');
  }

  return response.json();
};
