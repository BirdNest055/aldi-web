"use client";

import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred while rendering this page. The error
            has been logged.
          </p>
          {error?.message && (
            <div className="p-3 rounded-md bg-muted border">
              <p className="text-xs font-mono break-words">{error.message}</p>
              {error.digest && (
                <p className="text-xs text-muted-foreground mt-1">digest: {error.digest}</p>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={reset} size="sm" className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              Try again
            </Button>
            <Link href="/">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Home className="w-3.5 h-3.5" />
                Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
