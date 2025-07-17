import { useCopy } from "@/hooks/use-copy";
import { VercelAIWorkflowToolStreamingResult } from "app-types/workflow";
import equal from "lib/equal";
import { AlertTriangleIcon, Check, Copy, Loader2, XIcon } from "lucide-react";
import { memo, useEffect, useMemo, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "ui/alert";
import { Button } from "ui/button";
import JsonView from "ui/json-view";
import { NodeResultPopup } from "../workflow/node-result-popup";
import { cn } from "lib/utils";
import { NodeIcon } from "../workflow/node-icon";
import { TextShimmer } from "ui/text-shimmer";

interface WorkflowInvocationProps {
  result: VercelAIWorkflowToolStreamingResult;
}

function PureWorkflowInvocation({ result }: WorkflowInvocationProps) {
  const { copied, copy } = useCopy();
  const savedResult = useRef<VercelAIWorkflowToolStreamingResult>(result);
  const output = useMemo(() => {
    if (result.status == "running") return null;
    if (result.status == "fail")
      return (
        <Alert variant={"destructive"} className="border-destructive">
          <AlertTriangleIcon className="size-3" />
          <AlertTitle>{result?.error?.name || "ERROR"}</AlertTitle>
          <AlertDescription>{result.error?.message}</AlertDescription>
        </Alert>
      );
    if (!result.result) return null;

    return (
      <div className="w-full bg-card p-4 border text-xs rounded-lg text-muted-foreground">
        <div className="flex items-center">
          <h5 className="text-muted-foreground font-medium select-none">
            Response
          </h5>
          <div className="flex-1" />
          {copied ? (
            <Check className="size-3" />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-3 text-muted-foreground"
              onClick={() => copy(JSON.stringify(result.result))}
            >
              <Copy className="size-3" />
            </Button>
          )}
        </div>
        <div className="p-2 max-h-[300px] overflow-y-auto">
          <JsonView data={result.result} />
        </div>
      </div>
    );
  }, [result.status, result.error, result.result, copied]);
  useEffect(() => {
    if (result.status == "running") {
      savedResult.current = result;
    }
  }, [result]);

  return (
    <div className="w-full flex flex-col gap-1">
      {result.history.map((item, i) => {
        const result = item.result || savedResult.current.history[i]?.result;
        return (
          <NodeResultPopup
            key={item.id}
            disabled={!result}
            history={{
              name: item.name,
              status: item.status,
              startedAt: item.startedAt,
              endedAt: item.endedAt,
              error: item.error?.message,
              result,
            }}
          >
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-2 text-sm rounded-sm px-2 py-1.5 relative",
                item.status == "fail" && "text-destructive",
                !!result && "cursor-pointer hover:bg-secondary",
              )}
            >
              <div className="border rounded overflow-hidden">
                <NodeIcon
                  type={item.kind}
                  iconClassName="size-3"
                  className="rounded-none"
                />
              </div>
              {item.status == "running" ? (
                <TextShimmer className="font-semibold">
                  {`${item.name} Running...`}
                </TextShimmer>
              ) : (
                <span className="font-semibold">{item.name}</span>
              )}
              <span
                className={cn(
                  "ml-auto text-xs",
                  item.status != "fail" && "text-muted-foreground",
                )}
              >
                {item.status != "running" &&
                  ((item.endedAt! - item.startedAt!) / 1000).toFixed(2)}
              </span>
              {item.status == "success" ? (
                <Check className="size-3" />
              ) : item.status == "fail" ? (
                <XIcon className="size-3" />
              ) : (
                <Loader2 className="size-3 animate-spin" />
              )}
            </div>
          </NodeResultPopup>
        );
      })}
      <div className="mt-2">{output}</div>
    </div>
  );
}

function areEqual(
  prev: WorkflowInvocationProps,
  next: WorkflowInvocationProps,
) {
  if (prev.result.status != next.result.status) return false;
  if (prev.result.error?.message != next.result.error?.message) return false;
  if (prev.result.result != next.result.result) return false;
  if (!equal(prev.result.history, next.result.history)) return false;
  if (!equal(prev.result.result, next.result.result)) return false;
  return true;
}

export const WorkflowInvocation = memo(PureWorkflowInvocation, areEqual);
