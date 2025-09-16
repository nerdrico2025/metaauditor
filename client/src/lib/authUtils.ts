export function isUnauthorizedError(error: any): boolean {
  if (!error) return false;

  // Check status code directly
  if (error.status === 401) return true;

  // Check message content (case insensitive)
  const message = error.message?.toLowerCase() || '';
  return message.includes('401') || 
         message.includes('unauthorized') ||
         message.includes('not authenticated') ||
         message.includes('token') ||
         message.includes('authentication required');
}