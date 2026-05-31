import React from 'react';
import { Alert, AlertTitle, AlertDescription } from './alert';
import { Button } from './button';
import { Icon } from '@/components/icon/Icon';
export interface ErrorAlertProps {
  /** Primary error message displayed as the alert title */
  message: string;
  /** Optional secondary description providing more context */
  description?: string;
  /** Optional callback for a "Retry" action button */
  onRetry?: () => void;
  /** Optional label for the retry button (default: "Retry") */
  retryLabel?: string;
  /** Optional additional class names */
  className?: string;
}

/**
 * ErrorAlert displays an error message in a styled alert with an optional
 * description and retry button. Uses the project's existing Alert primitive
 * with the destructive variant for consistent styling.
 */
export function ErrorAlert({
  message,
  description,
  onRetry,
  retryLabel = 'Retry',
  className,
}: ErrorAlertProps) {
  return (
    <Alert
      variant="destructive"
      className={className}
      role="alert"
    >
      <Icon name="error-warning" className="h-4 w-4" />
      <AlertTitle>{message}</AlertTitle>
      {description && (
        <AlertDescription>
          <span>{description}</span>
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              size="xs"
              className="mt-2"
            >
              <Icon name="restart" className="h-3 w-3" />
              {retryLabel}
            </Button>
          )}
        </AlertDescription>
      )}
      {!description && onRetry && (
        <AlertDescription>
          <Button
            onClick={onRetry}
            variant="outline"
            size="xs"
          >
            <Icon name="restart" className="h-3 w-3" />
            {retryLabel}
          </Button>
        </AlertDescription>
      )}
    </Alert>
  );
}
