"use client";

import { UIMessage } from "ai";
import {
  Check,
  Copy,
  Loader,
  Pencil,
  ChevronDownIcon,
  RefreshCw,
  X,
  Trash2,
  ChevronRight,
  TriangleAlert,
  AlertTriangleIcon,
  Percent,
  HammerIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import { Button } from "ui/button";
import { Markdown } from "./markdown";
import { cn, isObject, safeJSONParse, toAny } from "lib/utils";
import JsonView from "ui/json-view";
import {
  useMemo,
  useState,
  memo,
  useEffect,
  useRef,
  Suspense,
  useCallback,
} from "react";
import { MessageEditor } from "./message-editor";
import type { UseChatHelpers } from "@ai-sdk/react";
import { useCopy } from "@/hooks/use-copy";

import { AnimatePresence, motion } from "framer-motion";
import { SelectModel } from "./select-model";
import {
  deleteMessageAction,
  deleteMessagesByChatIdAfterTimestampAction,
} from "@/app/api/chat/actions";

import { toast } from "sonner";
import { safe } from "ts-safe";
import {
  ChatModel,
  ClientToolInvocation,
  ToolInvocationUIPart,
} from "app-types/chat";

import { Skeleton } from "ui/skeleton";
import { PieChart } from "./tool-invocation/pie-chart";
import { BarChart } from "./tool-invocation/bar-chart";
import { LineChart } from "./tool-invocation/line-chart";
import { useTranslations } from "next-intl";
import { extractMCPToolId } from "lib/ai/mcp/mcp-tool-id";
import { Separator } from "ui/separator";

import { TextShimmer } from "ui/text-shimmer";
import equal from "lib/equal";
import { isVercelAIWorkflowTool } from "app-types/workflow";
import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import { DefaultToolName } from "lib/ai/tools";

import { CodeBlock } from "ui/CodeBlock";
import { SafeJsExecutionResult, safeJsRun } from "lib/safe-js-run";
import { SafePythonExecutionResult, safePythonRun } from "lib/safe-python-run";
import { WebSearchToolInvocation } from "./tool-invocation/web-search";
import { WorkflowInvocation } from "./tool-invocation/workflow-invocation";

type MessagePart = UIMessage["parts"][number];

type TextMessagePart = Extract<MessagePart, { type: "text" }>;
type AssistMessagePart = Extract<MessagePart, { type: "text" }>;

interface UserMessagePartProps {
  part: TextMessagePart;
  isLast: boolean;
  message: UIMessage;
  setMessages: UseChatHelpers["setMessages"];
  reload: UseChatHelpers["reload"];
  status: UseChatHelpers["status"];
  isError?: boolean;
}

interface AssistMessagePartProps {
  part: AssistMessagePart;
  message: UIMessage;
  showActions: boolean;
  threadId?: string;
  setMessages: UseChatHelpers["setMessages"];
  reload: UseChatHelpers["reload"];
  isError?: boolean;
}

interface ToolMessagePartProps {
  part: ToolInvocationUIPart;
  messageId: string;
  showActions: boolean;
  isLast?: boolean;
  isManualToolInvocation?: boolean;
  onPoxyToolCall?: (result: ClientToolInvocation) => void;
  isError?: boolean;
  setMessages?: UseChatHelpers["setMessages"];
}

export const UserMessagePart = memo(
  function UserMessagePart({
    part,
    isLast,
    status,
    message,
    setMessages,
    reload,
    isError,
  }: UserMessagePartProps) {
    const { copied, copy } = useCopy();
    const [mode, setMode] = useState<"view" | "edit">("view");
    const [isDeleting, setIsDeleting] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const scrolledRef = useRef(false);

    const deleteMessage = useCallback(() => {
      safe(() => setIsDeleting(true))
        .ifOk(() => deleteMessageAction(message.id))
        .ifOk(() =>
          setMessages((messages) => {
            const index = messages.findIndex((m) => m.id === message.id);
            if (index !== -1) {
              return messages.filter((_, i) => i !== index);
            }
            return messages;
          }),
        )
        .ifFail((error) => toast.error(error.message))
        .watch(() => setIsDeleting(false))
        .unwrap();
    }, [message.id]);

    useEffect(() => {
      if (status === "submitted" && isLast && !scrolledRef.current) {
        scrolledRef.current = true;

        ref.current?.scrollIntoView({ behavior: "smooth" });
      }
    }, [status]);

    if (mode === "edit") {
      return (
        <div className="flex flex-row gap-2 items-start w-full">
          <MessageEditor
            message={message}
            setMode={setMode}
            setMessages={setMessages}
            reload={reload}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2 items-end my-2">
        <div
          data-testid="message-content"
          className={cn(
            "flex flex-col gap-4 max-w-full ring ring-input",
            {
              "bg-accent text-accent-foreground px-4 py-3 rounded-2xl": isLast,
              "opacity-50": isError,
            },
            isError && "border-destructive border",
          )}
        >
          <p className={cn("whitespace-pre-wrap text-sm break-words")}>
            {part.text}
          </p>
        </div>
        {isLast && (
          <div className="flex w-full justify-end opacity-0 group-hover/message:opacity-100 transition-opacity duration-300">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="message-edit-button"
                  variant="ghost"
                  size="icon"
                  className={cn("size-3! p-4!")}
                  onClick={() => copy(part.text)}
                >
                  {copied ? <Check /> : <Copy />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Copy</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="message-edit-button"
                  variant="ghost"
                  size="icon"
                  className="size-3! p-4!"
                  onClick={() => setMode("edit")}
                >
                  <Pencil />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Edit</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  disabled={isDeleting}
                  onClick={deleteMessage}
                  variant="ghost"
                  size="icon"
                  className="size-3! p-4! hover:text-destructive"
                >
                  {isDeleting ? (
                    <Loader className="animate-spin" />
                  ) : (
                    <Trash2 />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-destructive" side="bottom">
                Delete Message
              </TooltipContent>
            </Tooltip>
          </div>
        )}
        <div ref={ref} className="min-w-0" />
      </div>
    );
  },
  (prev, next) => {
    if (prev.part.text != next.part.text) return false;
    if (prev.isError != next.isError) return false;
    if (prev.isLast != next.isLast) return false;
    if (prev.status != next.status) return false;
    if (prev.message.id != next.message.id) return false;
    if (!equal(prev.part, next.part)) return false;
    return true;
  },
);
UserMessagePart.displayName = "UserMessagePart";

export const AssistMessagePart = memo(function AssistMessagePart({
  part,
  showActions,
  reload,
  message,
  setMessages,
  isError,
  threadId,
}: AssistMessagePartProps) {
  const { copied, copy } = useCopy();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteMessage = useCallback(() => {
    safe(() => setIsDeleting(true))
      .ifOk(() => deleteMessageAction(message.id))
      .ifOk(() =>
        setMessages((messages) => {
          const index = messages.findIndex((m) => m.id === message.id);
          if (index !== -1) {
            return messages.filter((_, i) => i !== index);
          }
          return messages;
        }),
      )
      .ifFail((error) => toast.error(error.message))
      .watch(() => setIsDeleting(false))
      .unwrap();
  }, [message.id]);

  const handleModelChange = (model: ChatModel) => {
    safe(() => setIsLoading(true))
      .ifOk(() =>
        threadId
          ? deleteMessagesByChatIdAfterTimestampAction(message.id)
          : Promise.resolve(),
      )
      .ifOk(() =>
        setMessages((messages) => {
          const index = messages.findIndex((m) => m.id === message.id);
          if (index !== -1) {
            return [...messages.slice(0, index)];
          }
          return messages;
        }),
      )
      .ifOk(() =>
        reload({
          body: {
            model,
            action: "update-assistant",
            id: threadId,
          },
        }),
      )
      .ifFail((error) => toast.error(error.message))
      .watch(() => setIsLoading(false))
      .unwrap();
  };

  return (
    <div
      className={cn(isLoading && "animate-pulse", "flex flex-col gap-2 group")}
    >
      <div
        data-testid="message-content"
        className={cn("flex flex-col gap-4 px-2", {
          "opacity-50 border border-destructive bg-card rounded-lg": isError,
        })}
      >
        <Markdown>{part.text}</Markdown>
      </div>
      {showActions && (
        <div className="flex w-full ">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-testid="message-edit-button"
                variant="ghost"
                size="icon"
                className={cn(
                  "size-3! p-4! opacity-0 group-hover/message:opacity-100",
                )}
                onClick={() => copy(part.text)}
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <SelectModel onSelect={handleModelChange}>
                  <Button
                    data-testid="message-edit-button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "size-3! p-4! opacity-0 group-hover/message:opacity-100",
                    )}
                  >
                    {<RefreshCw />}
                  </Button>
                </SelectModel>
              </div>
            </TooltipTrigger>
            <TooltipContent>Change Model</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={isDeleting}
                onClick={deleteMessage}
                className="size-3! p-4! opacity-0 group-hover/message:opacity-100 hover:text-destructive"
              >
                {isDeleting ? <Loader className="animate-spin" /> : <Trash2 />}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-destructive" side="bottom">
              Delete Message
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
});
AssistMessagePart.displayName = "AssistMessagePart";

export const ToolMessagePart = memo(
  ({
    part,
    isLast,
    showActions,
    onPoxyToolCall,
    isError,
    messageId,
    setMessages,
    isManualToolInvocation,
  }: ToolMessagePartProps) => {
    const t = useTranslations("");
    const { toolInvocation } = part;
    const { toolName, toolCallId, state, args } = toolInvocation;
    const [expanded, setExpanded] = useState(false);
    const { copied: copiedInput, copy: copyInput } = useCopy();
    const { copied: copiedOutput, copy: copyOutput } = useCopy();
    const [isDeleting, setIsDeleting] = useState(false);

    const deleteMessage = useCallback(() => {
      safe(() => setIsDeleting(true))
        .ifOk(() => deleteMessageAction(messageId))
        .ifOk(() =>
          setMessages?.((messages) => {
            const index = messages.findIndex((m) => m.id === messageId);
            if (index !== -1) {
              return messages.filter((_, i) => i !== index);
            }
            return messages;
          }),
        )
        .ifFail((error) => toast.error(error.message))
        .watch(() => setIsDeleting(false))
        .unwrap();
    }, [messageId, setMessages]);

    const result = useMemo(() => {
      if (state === "result") {
        return toolInvocation.result?.content
          ? {
              ...toolInvocation.result,
              content: toolInvocation.result.content.map((node) => {
                if (node.type === "text") {
                  const parsed = safeJSONParse(node.text);
                  return {
                    ...node,
                    text: parsed.success ? parsed.value : node.text,
                  };
                }
                return node;
              }),
            }
          : toolInvocation.result;
      }
      return null;
    }, [toolInvocation, onPoxyToolCall]);

    const CustomToolComponent = useMemo(() => {
      if (
        toolName === DefaultToolName.WebSearch ||
        toolName === DefaultToolName.WebContent
      ) {
        return <WebSearchToolInvocation part={toolInvocation} />;
      }

      if (toolName === DefaultToolName.JavascriptExecution) {
        return (
          <SimpleJavascriptExecutionToolPart
            part={toolInvocation}
            onResult={
              onPoxyToolCall
                ? (result) =>
                    onPoxyToolCall?.({
                      action: "direct",
                      result,
                    })
                : undefined
            }
          />
        );
      }

      if (toolName === DefaultToolName.PythonExecution) {
        return (
          <SimplePythonExecutionToolPart
            part={toolInvocation}
            onResult={
              onPoxyToolCall
                ? (result) =>
                    onPoxyToolCall?.({
                      action: "direct",
                      result,
                    })
                : undefined
            }
          />
        );
      }

      if (state === "result") {
        switch (toolName) {
          case DefaultToolName.CreatePieChart:
            return (
              <Suspense
                fallback={<Skeleton className="h-64 w-full rounded-md" />}
              >
                <PieChart
                  key={`${toolCallId}-${toolName}`}
                  {...(args as any)}
                />
              </Suspense>
            );
          case DefaultToolName.CreateBarChart:
            return (
              <Suspense
                fallback={<Skeleton className="h-64 w-full rounded-md" />}
              >
                <BarChart
                  key={`${toolCallId}-${toolName}`}
                  {...(args as any)}
                />
              </Suspense>
            );
          case DefaultToolName.CreateLineChart:
            return (
              <Suspense
                fallback={<Skeleton className="h-64 w-full rounded-md" />}
              >
                <LineChart
                  key={`${toolCallId}-${toolName}`}
                  {...(args as any)}
                />
              </Suspense>
            );
        }
      }
      return null;
    }, [toolName, state, onPoxyToolCall, result, args]);

    const isWorkflowTool = useMemo(
      () => isVercelAIWorkflowTool(result),
      [result],
    );

    const { serverName: mcpServerName, toolName: mcpToolName } = useMemo(() => {
      return extractMCPToolId(toolName);
    }, [toolName]);

    const isExpanded = useMemo(() => {
      return expanded || result === null || isWorkflowTool;
    }, [expanded, result, isWorkflowTool]);

    const isExecuting = useMemo(() => {
      if (isWorkflowTool) return result?.status == "running";
      return state !== "result" && (isLast || !!onPoxyToolCall);
    }, [isWorkflowTool, result, state, isLast, !!onPoxyToolCall]);

    return (
      <div key={toolCallId} className="group w-full">
        {CustomToolComponent ? (
          CustomToolComponent
        ) : (
          <div className="flex flex-col fade-in duration-300 animate-in">
            <div
              className="flex gap-2 items-center cursor-pointer group/title"
              onClick={() => setExpanded(!expanded)}
            >
              <div className="p-1.5 text-primary bg-input/40 rounded">
                {isExecuting ? (
                  <Loader className="size-3.5 animate-spin" />
                ) : isError ? (
                  <TriangleAlert className="size-3.5 text-destructive" />
                ) : isWorkflowTool ? (
                  <Avatar className="size-3.5">
                    <AvatarImage src={result.workflowIcon?.value} />
                    <AvatarFallback>
                      {toolName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <HammerIcon className="size-3.5" />
                )}
              </div>
              <span className="font-bold flex items-center gap-2">
                {isExecuting ? (
                  <TextShimmer>{mcpServerName}</TextShimmer>
                ) : (
                  mcpServerName
                )}
              </span>
              {mcpToolName && (
                <>
                  <ChevronRight className="size-3.5" />
                  <span className="text-muted-foreground group-hover/title:text-primary transition-colors duration-300">
                    {mcpToolName}
                  </span>
                </>
              )}
              <div className="ml-auto group-hover/title:bg-input p-1.5 rounded transition-colors duration-300">
                <ChevronDownIcon
                  className={cn(isExpanded && "rotate-180", "size-3.5")}
                />
              </div>
            </div>
            <div className="flex gap-2 py-2">
              <div className="w-7 flex justify-center">
                <Separator
                  orientation="vertical"
                  className="h-full bg-gradient-to-t from-transparent to-border to-5%"
                />
              </div>
              <div className="w-full flex flex-col gap-2">
                <div
                  className={cn(
                    "min-w-0 w-full p-4 rounded-lg bg-card px-4 border text-xs transition-colors fade-300",
                    !isExpanded && "hover:bg-secondary cursor-pointer",
                  )}
                  onClick={() => {
                    if (!isExpanded) {
                      setExpanded(true);
                    }
                  }}
                >
                  <div className="flex items-center">
                    <h5 className="text-muted-foreground font-medium select-none transition-colors">
                      Request
                    </h5>
                    <div className="flex-1" />
                    {copiedInput ? (
                      <Check className="size-3" />
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-3 text-muted-foreground"
                        onClick={() =>
                          copyInput(JSON.stringify(toolInvocation.args))
                        }
                      >
                        <Copy className="size-3" />
                      </Button>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="p-2 max-h-[300px] overflow-y-auto ">
                      <JsonView data={toolInvocation.args} />
                    </div>
                  )}
                </div>
                {!result ? null : isWorkflowTool ? (
                  <WorkflowInvocation result={result} />
                ) : (
                  <div
                    className={cn(
                      "min-w-0 w-full p-4 rounded-lg bg-card px-4 border text-xs mt-2 transition-colors fade-300",
                      !isExpanded && "hover:bg-secondary cursor-pointer",
                    )}
                    onClick={() => {
                      if (!isExpanded) {
                        setExpanded(true);
                      }
                    }}
                  >
                    <div className="flex items-center">
                      <h5 className="text-muted-foreground font-medium select-none">
                        Response
                      </h5>
                      <div className="flex-1" />
                      {copiedOutput ? (
                        <Check className="size-3" />
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-3 text-muted-foreground"
                          onClick={() => copyOutput(JSON.stringify(result))}
                        >
                          <Copy className="size-3" />
                        </Button>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="p-2 max-h-[300px] overflow-y-auto">
                        <JsonView data={result} />
                      </div>
                    )}
                  </div>
                )}

                {onPoxyToolCall && isManualToolInvocation && (
                  <div className="flex flex-row gap-2 items-center mt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-full text-xs hover:ring"
                      onClick={() =>
                        onPoxyToolCall({ action: "manual", result: true })
                      }
                    >
                      <Check />
                      {t("Common.approve")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs"
                      onClick={() =>
                        onPoxyToolCall({ action: "manual", result: false })
                      }
                    >
                      <X />
                      {t("Common.reject")}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {showActions && (
              <div className="flex flex-row gap-2 items-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      disabled={isDeleting}
                      onClick={deleteMessage}
                      variant="ghost"
                      size="icon"
                      className="size-3! p-4! opacity-0 group-hover/message:opacity-100 hover:text-destructive"
                    >
                      {isDeleting ? (
                        <Loader className="animate-spin" />
                      ) : (
                        <Trash2 />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="text-destructive" side="bottom">
                    Delete Message
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
  (prev, next) => {
    if (prev.isError !== next.isError) return false;
    if (prev.isLast !== next.isLast) return false;
    if (prev.showActions !== next.showActions) return false;
    if (!!prev.onPoxyToolCall !== !!next.onPoxyToolCall) return false;
    if (prev.isManualToolInvocation !== next.isManualToolInvocation)
      return false;
    if (prev.messageId !== next.messageId) return false;
    if (!equal(prev.part.toolInvocation, next.part.toolInvocation))
      return false;
    return true;
  },
);

ToolMessagePart.displayName = "ToolMessagePart";

export const ReasoningPart = memo(function ReasoningPart({
  reasoning,
}: {
  reasoning: string;
  isThinking?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const variants = {
    collapsed: {
      height: 0,
      opacity: 0,
      marginTop: 0,
      marginBottom: 0,
    },
    expanded: {
      height: "auto",
      opacity: 1,
      marginTop: "1rem",
      marginBottom: "0.5rem",
    },
  };

  return (
    <div
      className="flex flex-col cursor-pointer"
      onClick={() => {
        setIsExpanded(!isExpanded);
      }}
    >
      <div className="flex flex-row gap-2 items-center text-ring hover:text-primary transition-colors">
        <div className="font-medium">Reasoned for a few seconds</div>
        <button
          data-testid="message-reasoning-toggle"
          type="button"
          className="cursor-pointer"
        >
          <ChevronDownIcon size={16} />
        </button>
      </div>

      <div className="pl-4">
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              data-testid="message-reasoning"
              key="content"
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              variants={variants}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
              className="pl-6 text-muted-foreground border-l flex flex-col gap-4"
            >
              <Markdown>{reasoning}</Markdown>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
ReasoningPart.displayName = "ReasoningPart";

export const SimpleJavascriptExecutionToolPart = memo(
  function SimpleJavascriptExecutionToolPart({
    part,
    onResult,
  }: {
    part: ToolInvocationUIPart["toolInvocation"];
    onResult?: (result?: any) => void;
  }) {
    const isRun = useRef(false);
    const [isExecuting, setIsExecuting] = useState(false);

    const [realtimeLogs, setRealtimeLogs] = useState<
      (SafeJsExecutionResult["logs"][number] & { time: number })[]
    >([]);

    const codeResultContainerRef = useRef<HTMLDivElement>(null);

    const runCode = useCallback(
      async (code: string, input: any) => {
        const result = await safeJsRun(code, input, 60000, (log) => {
          setRealtimeLogs((prev) => [...prev, { ...log, time: Date.now() }]);
        });

        onResult?.({
          ...toAny(result),
          guide:
            "The code has already been executed and displayed to the user. Please provide only the output results from console.log() or error details if any occurred. Do not repeat the code itself.",
        });
      },
      [onResult],
    );

    const isRunning = useMemo(() => {
      return isExecuting || part.state != "result";
    }, [isExecuting, part.state]);

    const scrollToCode = useCallback(() => {
      codeResultContainerRef.current?.scrollTo({
        top: codeResultContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, []);

    const result = useMemo(() => {
      if (part.state != "result") return null;
      return part.result as SafeJsExecutionResult;
    }, [part]);

    const logs = useMemo(() => {
      const error = result?.error;
      const logs = realtimeLogs.length ? realtimeLogs : (result?.logs ?? []);

      if (error) {
        return [{ type: "error", args: [error], time: Date.now() }, ...logs];
      }

      return logs;
    }, [part, realtimeLogs]);

    const reExecute = useCallback(async () => {
      if (isExecuting) return;
      setIsExecuting(true);
      setRealtimeLogs([
        { type: "info", args: ["Re-executing code..."], time: Date.now() },
      ]);
      const code = part.args?.code;
      const input = part.args?.input;
      safe(() =>
        safeJsRun(code, input, 60000, (log) => {
          setRealtimeLogs((prev) => [...prev, { ...log, time: Date.now() }]);
        }),
      ).watch(() => setIsExecuting(false));
    }, [part.args, isExecuting]);

    const header = useMemo(() => {
      if (isRunning)
        return (
          <>
            <Loader className="size-3 animate-spin text-muted-foreground" />
            <TextShimmer className="text-xs">Generating Code...</TextShimmer>
          </>
        );
      return (
        <>
          {result?.error ? (
            <>
              <AlertTriangleIcon className="size-3 text-destructive" />
              <span className="text-destructive text-xs">ERROR</span>
            </>
          ) : (
            <>
              <div className="text-[7px] bg-border rounded-xs w-4 h-4 p-0.5 flex items-end justify-end font-bold">
                JS
              </div>
            </>
          )}
        </>
      );
    }, [part.state, result, isRunning]);

    const fallback = useMemo(() => {
      return <CodeFallback />;
    }, []);

    const logContainer = useMemo(() => {
      if (!logs.length) return null;
      return (
        <div className="p-4 text-[10px] text-foreground flex flex-col gap-1">
          <div className="text-foreground flex items-center gap-1">
            {isRunning ? (
              <Loader className="size-2 animate-spin" />
            ) : (
              <div className="w-1 h-1 mr-1 ring ring-border rounded-full" />
            )}
            better-chatbot
            <Percent className="size-2" />
            {part.state == "result" && (
              <div
                className="hover:text-foreground ml-auto px-2 py-1 rounded-sm cursor-pointer text-muted-foreground/80"
                onClick={reExecute}
              >
                retry
              </div>
            )}
          </div>
          {logs.map((log, i) => {
            return (
              <div
                key={i}
                className={cn(
                  "flex gap-1 text-muted-foreground pl-3",
                  log.type == "error" && "text-destructive",
                  log.type == "warn" && "text-yellow-500",
                )}
              >
                <div className="w-[8.6rem] hidden md:block">
                  {new Date(toAny(log).time || Date.now()).toISOString()}
                </div>
                <div className="h-[15px] flex items-center">
                  {log.type == "error" ? (
                    <AlertTriangleIcon className="size-2" />
                  ) : log.type == "warn" ? (
                    <AlertTriangleIcon className="size-2" />
                  ) : (
                    <ChevronRight className="size-2" />
                  )}
                </div>
                <div className="flex-1 min-w-0 whitespace-pre-wrap">
                  {log.args
                    .map((arg) =>
                      isObject(arg) ? JSON.stringify(arg) : arg.toString(),
                    )
                    .join(" ")}
                </div>
              </div>
            );
          })}
          {isRunning && (
            <div className="ml-3 animate-caret-blink text-muted-foreground">
              |
            </div>
          )}
        </div>
      );
    }, [logs, isRunning]);

    useEffect(() => {
      if (onResult && part.args && part.state == "call" && !isRun.current) {
        isRun.current = true;
        runCode(part.args.code, part.args.input);
      }
    }, [part.state, !!onResult]);

    useEffect(() => {
      if (isRunning) {
        const closeKey = setInterval(scrollToCode, 300);
        return () => clearInterval(closeKey);
      } else if (part.state == "result" && isRun.current) {
        scrollToCode();
      }
    }, [isRunning]);

    return (
      <div className="flex flex-col">
        <div className="px-6 py-3">
          <div
            ref={codeResultContainerRef}
            onClick={scrollToCode}
            className="border overflow-y-auto overflow-x-hidden max-h-[70vh] relative rounded-lg shadow fade-in animate-in duration-500"
          >
            <div className="sticky top-0 py-2.5 px-4 flex items-center gap-1.5 z-10 border-b bg-background min-h-[37px]">
              {header}
              <div className="flex-1" />
              <div className="w-1.5 h-1.5 rounded-full bg-input" />
              <div className="w-1.5 h-1.5 rounded-full bg-input" />
              <div className="w-1.5 h-1.5 rounded-full bg-input" />
            </div>

            <div className={`min-h-14 p-6 text-xs`}>
              <CodeBlock
                className="p-4 text-[10px] overflow-x-auto"
                code={part.args?.code}
                lang="javascript"
                fallback={fallback}
              />
            </div>
            {logContainer}
          </div>
        </div>
      </div>
    );
  },
);

export const SimplePythonExecutionToolPart = memo(
  function SimplePythonExecutionToolPart({
    part,
    onResult,
  }: {
    part: ToolInvocationUIPart["toolInvocation"];
    onResult?: (result?: any) => void;
  }) {
    const isRun = useRef(false);
    const [isExecuting, setIsExecuting] = useState(false);

    const [realtimeLogs, setRealtimeLogs] = useState<
      (SafePythonExecutionResult["logs"][number] & { time: number })[]
    >([]);

    const codeResultContainerRef = useRef<HTMLDivElement>(null);

    const runCode = useCallback(
      async (code: string, input: any) => {
        const result = await safePythonRun(code, input, 60000, (log) => {
          setRealtimeLogs((prev) => [...prev, { ...log, time: Date.now() }]);
        });

        onResult?.({
          ...toAny(result),
          guide:
            "The code has already been executed and displayed to the user. Please provide only the output results from console.log() or error details if any occurred. Do not repeat the code itself.",
        });
      },
      [onResult],
    );

    const isRunning = useMemo(() => {
      return isExecuting || part.state != "result";
    }, [isExecuting, part.state]);

    const scrollToCode = useCallback(() => {
      codeResultContainerRef.current?.scrollTo({
        top: codeResultContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, []);

    const result = useMemo(() => {
      if (part.state != "result") return null;
      return part.result as SafePythonExecutionResult;
    }, [part]);

    const logs = useMemo(() => {
      const error = result?.error;
      const logs = realtimeLogs.length ? realtimeLogs : (result?.logs ?? []);

      if (error) {
        return [{ type: "error", args: [error], time: Date.now() }, ...logs];
      }

      return logs;
    }, [part, realtimeLogs]);

    const reExecute = useCallback(async () => {
      if (isExecuting) return;
      setIsExecuting(true);
      setRealtimeLogs([
        { type: "stdout", args: ["Re-executing code..."], time: Date.now() },
      ]);
      const code = part.args?.code;
      const input = part.args?.input;
      safe(() =>
        safePythonRun(code, input, 60000, (log) => {
          setRealtimeLogs((prev) => [...prev, { ...log, time: Date.now() }]);
        }),
      ).watch(() => setIsExecuting(false));
    }, [part.args, isExecuting]);

    const header = useMemo(() => {
      if (isRunning)
        return (
          <>
            <Loader className="size-3 animate-spin text-muted-foreground" />
            <TextShimmer className="text-xs">Generating Code...</TextShimmer>
          </>
        );
      return (
        <>
          {result?.error ? (
            <>
              <AlertTriangleIcon className="size-3 text-destructive" />
              <span className="text-destructive text-xs">ERROR</span>
            </>
          ) : (
            <>
              <div className="text-[7px] bg-border rounded-xs w-4 h-4 p-0.5 flex items-end justify-end font-bold">
                PY
              </div>
            </>
          )}
        </>
      );
    }, [part.state, result, isRunning]);

    const fallback = useMemo(() => {
      return <CodeFallback />;
    }, []);

    const logContainer = useMemo(() => {
      if (!logs.length) return null;
      return (
        <div className="p-4 text-[10px] text-foreground flex flex-col gap-1">
          <div className="text-foreground flex items-center gap-1">
            {isRunning ? (
              <Loader className="size-2 animate-spin" />
            ) : (
              <div className="w-1 h-1 mr-1 ring ring-border rounded-full" />
            )}
            better-chatbot
            <Percent className="size-2" />
            {part.state == "result" && (
              <div
                className="hover:text-foreground ml-auto px-2 py-1 rounded-sm cursor-pointer text-muted-foreground/80"
                onClick={reExecute}
              >
                retry
              </div>
            )}
          </div>
          {logs.map((log, i) => {
            return (
              <div
                key={i}
                className={cn(
                  "flex gap-1 text-muted-foreground pl-3",
                  log.type == "error" && "text-destructive",
                  log.type == "warn" && "text-yellow-500",
                )}
              >
                <div className="w-[8.6rem] hidden md:block">
                  {new Date(toAny(log).time || Date.now()).toISOString()}
                </div>
                <div className="h-[15px] flex items-center">
                  {log.type == "error" ? (
                    <AlertTriangleIcon className="size-2" />
                  ) : log.type == "warn" ? (
                    <AlertTriangleIcon className="size-2" />
                  ) : (
                    <ChevronRight className="size-2" />
                  )}
                </div>
                <div className="flex-1 min-w-0 whitespace-pre-wrap">
                  {log.args
                    .map((arg) =>
                      isObject(arg) ? JSON.stringify(arg) : arg.toString(),
                    )
                    .join(" ")}
                </div>
              </div>
            );
          })}
          {isRunning && (
            <div className="ml-3 animate-caret-blink text-muted-foreground">
              |
            </div>
          )}
        </div>
      );
    }, [logs, isRunning]);

    useEffect(() => {
      if (onResult && part.args && part.state == "call" && !isRun.current) {
        isRun.current = true;
        runCode(part.args.code, part.args.input);
      }
    }, [part.state, !!onResult]);

    useEffect(() => {
      if (isRunning) {
        const closeKey = setInterval(scrollToCode, 300);
        return () => clearInterval(closeKey);
      } else if (part.state == "result" && isRun.current) {
        scrollToCode();
      }
    }, [isRunning]);

    return (
      <div className="flex flex-col">
        <div className="px-6 py-3">
          <div
            ref={codeResultContainerRef}
            onClick={scrollToCode}
            className="border overflow-y-auto overflow-x-hidden max-h-[70vh] relative rounded-lg shadow fade-in animate-in duration-500"
          >
            <div className="sticky top-0 py-2.5 px-4 flex items-center gap-1.5 z-10 border-b bg-background min-h-[37px]">
              {header}
              <div className="flex-1" />
              <div className="w-1.5 h-1.5 rounded-full bg-input" />
              <div className="w-1.5 h-1.5 rounded-full bg-input" />
              <div className="w-1.5 h-1.5 rounded-full bg-input" />
            </div>

            <div className={`min-h-14 p-6 text-xs`}>
              <CodeBlock
                className="p-4 text-[10px] overflow-x-auto"
                code={part.args?.code}
                lang="python"
                fallback={fallback}
              />
            </div>
            {logContainer}
          </div>
        </div>
      </div>
    );
  },
);

function CodeFallback() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-3 w-1/6" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-1/4" />
    </div>
  );
}
