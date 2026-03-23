export const handler = async (event) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      message: `Route ${event.httpMethod} ${event.path} is wired but not yet implemented`,
      path: event.path,
      method: event.httpMethod,
      timestamp: new Date().toISOString()
    })
  };
};