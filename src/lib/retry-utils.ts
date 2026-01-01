/**
 * Retry utility with exponential backoff
 */

export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  backoffMultiplier: number;
  maxDelay: number;
  retryableErrors?: (error: any) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: any;
  attempts: number;
}

/**
 * Check if error is retryable
 */
const isRetryableError = (error: any): boolean => {
  // Network errors
  if (!error.response && error.message) {
    return true;
  }

  // 5xx server errors
  if (error.response?.status >= 500 && error.response?.status < 600) {
    return true;
  }

  // Timeout errors
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return true;
  }

  // 408 Request Timeout
  if (error.response?.status === 408) {
    return true;
  }

  return false;
};

/**
 * Calculate delay with exponential backoff
 */
const calculateDelay = (
  attempt: number,
  initialDelay: number,
  multiplier: number,
  maxDelay: number
): number => {
  const delay = initialDelay * Math.pow(multiplier, attempt - 1);
  return Math.min(delay, maxDelay);
};

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<RetryResult<T>> {
  const {
    maxAttempts,
    initialDelay,
    backoffMultiplier,
    maxDelay,
    retryableErrors = isRetryableError,
  } = options;

  let lastError: any;
  let attempts = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts = attempt;

    try {
      const data = await fn();
      return { success: true, data, attempts };
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      if (!retryableErrors(error)) {
        return { success: false, error, attempts };
      }

      // Don't delay after last attempt
      if (attempt < maxAttempts) {
        const delay = calculateDelay(attempt, initialDelay, backoffMultiplier, maxDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return { success: false, error: lastError, attempts };
}

/**
 * Get retry status message
 */
export const getRetryStatusMessage = (attempt: number, maxAttempts: number): string => {
  if (attempt === 1) {
    return 'Sending...';
  }
  if (attempt <= maxAttempts) {
    return `Retrying... (Attempt ${attempt}/${maxAttempts})`;
  }
  return 'Failed to send. Retry manually?';
};

