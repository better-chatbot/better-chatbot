"use client";

import { ToolInvocationUIPart } from "app-types/chat";
import { TavilyResponse } from "lib/ai/tools/web/web-search";
import equal from "lib/equal";
import { notify } from "lib/notify";
import { cn, toAny } from "lib/utils";
import { AlertTriangleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import { GlobalIcon } from "ui/global-icon";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "ui/hover-card";
import JsonView from "ui/json-view";
import { Separator } from "ui/separator";
import { TextShimmer } from "ui/text-shimmer";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";

interface WebSearchToolInvocationProps {
  part: ToolInvocationUIPart["toolInvocation"];
}

function PureWebSearchToolInvocation({ part }: WebSearchToolInvocationProps) {
  const t = useTranslations();

  const result = useMemo(() => {
    if (part.state != "result") return null;
    return part.result as TavilyResponse & { isError: boolean; error?: string };
  }, [part.state]);
  const [errorSrc, setErrorSrc] = useState<string[]>([]);

  const options = useMemo(() => {
    return (
      <HoverCard openDelay={200} closeDelay={0}>
        <HoverCardTrigger asChild>
          <span className="hover:text-primary transition-colors text-xs text-muted-foreground">
            {t("Chat.Tool.searchOptions")}
          </span>
        </HoverCardTrigger>
        <HoverCardContent className="max-w-xs md:max-w-md! w-full! overflow-auto flex flex-col">
          <p className="text-xs text-muted-foreground px-2 mb-2">
            {t("Chat.Tool.searchOptionsDescription")}
          </p>
          <div className="p-2">
            <JsonView data={part.args} />
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  }, [part.args]);

  const onError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.currentTarget;
    if (errorSrc.includes(target.src)) return;
    setErrorSrc([...errorSrc, target.src]);
  };

  const images = useMemo(() => {
    return (
      result?.images?.filter((image) => !errorSrc.includes(image.url)) ?? []
    );
  }, [result?.images, errorSrc]);

  if (part.state != "result")
    return (
      <div className="flex items-center gap-2 text-sm">
        <GlobalIcon className="size-5 wiggle text-muted-foreground" />
        <TextShimmer>{t("Chat.Tool.webSearching")}</TextShimmer>
      </div>
    );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <GlobalIcon className="size-5 text-muted-foreground" />
        <span className="text-sm font-semibold">
          {t("Chat.Tool.searchedTheWeb")}
        </span>
        {options}
      </div>
      <div className="flex gap-2">
        <div className="px-2.5">
          <Separator
            orientation="vertical"
            className="bg-gradient-to-b from-border to-transparent from-80%"
          />
        </div>
        <div className="flex flex-col gap-2 pb-2">
          {Boolean(images?.length) && (
            <div className="grid grid-cols-3 gap-3 max-w-2xl">
              {images.map((image, i) => {
                if (!image.url) return null;
                return (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <div
                        key={image.url}
                        onClick={() => {
                          notify.component({
                            className: "max-w-[90vw]! max-h-[90vh]! p-6!",
                            children: (
                              <div className="flex flex-col h-full gap-4">
                                <div className="flex-1 flex items-center justify-center min-h-0 py-6">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={image.url}
                                    className="max-w-[80vw] max-h-[80vh] object-contain rounded-lg"
                                    alt={image.description}
                                    onError={onError}
                                  />
                                </div>
                              </div>
                            ),
                          });
                        }}
                        className="block shadow rounded-lg overflow-hidden ring ring-input cursor-pointer"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          loading="lazy"
                          src={image.url}
                          alt={image.description}
                          className="w-full h-36 object-cover hover:scale-120 transition-transform duration-300"
                          onError={onError}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="p-4 max-w-xs whitespace-pre-wrap break-words">
                      <p className="text-xs text-muted-foreground">
                        {image.description || image.url}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {result?.isError ? (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangleIcon className="size-3.5" />
                {result.error || "Error"}
              </p>
            ) : (
              (result as TavilyResponse)?.results?.map((result, i) => {
                return (
                  <HoverCard key={i} openDelay={200} closeDelay={0}>
                    <HoverCardTrigger asChild>
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-full bg-secondary pl-1.5 pr-2 py-1.5 text-xs flex items-center gap-1 hover:bg-input hover:ring hover:ring-blue-500 transition-all cursor-pointer"
                      >
                        <div className="rounded-full bg-input ring ring-input">
                          <Avatar className="size-3 rounded-full">
                            <AvatarImage src={result.favicon} />
                            <AvatarFallback>
                              {result.title?.slice(0, 1).toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <span className="truncate max-w-44">{result.url}</span>
                      </a>
                    </HoverCardTrigger>

                    <HoverCardContent className="flex flex-col gap-1 p-6">
                      <div className="flex items-center gap-2">
                        <div className="rounded-full ring ring-input">
                          <Avatar className="size-6 rounded-full">
                            <AvatarImage src={result.favicon} />
                            <AvatarFallback>
                              {result.title?.slice(0, 1).toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <span
                          className={cn(
                            "font-medium",
                            !result.title && "truncate",
                          )}
                        >
                          {result.title || result.url}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2 mt-4">
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-card from-80% " />
                          <p className="text-xs text-muted-foreground max-h-60 overflow-y-auto">
                            {result.content || result.raw_content}
                          </p>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                );
              })
            )}
          </div>
          {result?.results?.length && (
            <p className="text-xs text-muted-foreground ml-1 flex items-center gap-1">
              {t("Common.resultsFound", {
                count: result?.results?.length,
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function areEqual(
  { part: prevPart }: WebSearchToolInvocationProps,
  { part: nextPart }: WebSearchToolInvocationProps,
) {
  if (prevPart.state != nextPart.state) return false;
  if (!equal(prevPart.args, nextPart.args)) return false;
  if (
    prevPart.state == "result" &&
    !equal(prevPart.result, toAny(nextPart).result)
  )
    return false;
  return true;
}

export const WebSearchToolInvocation = memo(
  PureWebSearchToolInvocation,
  areEqual,
);
