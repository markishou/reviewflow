export const handler = async (event) => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Authenticated! You have access to ReviewFlow API.",
      timestamp: new Date().toISOString(),
      user: event.requestContext?.authorizer?.claims || "no-claims"
    })
  };
};
