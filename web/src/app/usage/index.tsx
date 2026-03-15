import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useClaudeUsage } from "@/lib/api";
import { cn } from "@/lib/utils";

dayjs.extend(relativeTime);

export const Route = createFileRoute("/usage/")({
  component: UsagePage,
});

function formatResetsIn(resetsAt: string): string {
  const target = dayjs(resetsAt);
  const now = dayjs();
  const diffMs = target.diff(now);
  if (diffMs <= 0) return "Resets soon";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `Resets in ${hours} hr ${minutes} min`;
  }
  return `Resets in ${minutes} min`;
}

function formatResetsAt(resetsAt: string): string {
  const target = dayjs(resetsAt);
  return `Resets ${target.format("ddd h:mm A")}`;
}

function UsagePage() {
  const {
    data: usage,
    isLoading,
    isRefetching,
    refetch,
    dataUpdatedAt,
  } = useClaudeUsage();

  const lastUpdatedLabel =
    dataUpdatedAt != null
      ? `Last updated: ${dayjs(dataUpdatedAt).fromNow()}`
      : "Last updated: --";

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="container-md mx-auto flex max-w-2xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Claude usage limits</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {/* Current session (five_hour) */}
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Current session</h3>
              {isLoading ? (
                <Skeleton className="h-2 w-full" />
              ) : usage?.five_hour ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    {usage.five_hour.resets_at
                      ? formatResetsIn(usage.five_hour.resets_at)
                      : "Starts when a message is sent"}
                  </p>
                  <div className="flex items-center gap-3">
                    <Progress
                      value={Math.min(usage.five_hour.utilization, 100)}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground">
                      {usage.five_hour.utilization}% used
                    </span>
                  </div>
                </>
              ) : null}
            </div>

            <Separator />

            {/* Weekly limits */}
            <section className="flex flex-col gap-4">
              <h3 className="text-sm font-medium">Weekly limits</h3>
              <a
                href="https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:underline"
              >
                Learn more about usage limits
              </a>

              {/* All models (seven_day) */}
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">All models</h3>
                {isLoading ? (
                  <Skeleton className="h-2 w-full" />
                ) : usage?.seven_day ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {formatResetsAt(usage.seven_day.resets_at)}
                    </p>
                    <div className="flex items-center gap-3">
                      <Progress
                        value={Math.min(usage.seven_day.utilization, 100)}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground">
                        {usage.seven_day.utilization}% used
                      </span>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{lastUpdatedLabel}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => refetch()}
                  disabled={isRefetching}
                  aria-label="Refresh"
                >
                  <RefreshCw
                    className={cn("size-3.5", isRefetching && "animate-spin")}
                  />
                </Button>
              </div>
            </section>

            <Separator />

            {/* Extra usage */}
            <section className="flex flex-col gap-4">
              <h3 className="text-sm font-medium">Extra usage</h3>
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Turn on extra usage to keep using Claude if you hit a limit.{" "}
                  <a
                    href="https://support.claude.com/en/articles/12429409-extra-usage-for-paid-claude-plans"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:underline"
                  >
                    Learn more
                  </a>
                </p>
                {isLoading ? (
                  <Skeleton className="size-8 w-14 shrink-0 rounded-full" />
                ) : (
                  <Switch
                    checked={usage?.extra_usage?.is_enabled ?? false}
                    disabled
                    aria-label="Extra usage"
                  />
                )}
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
