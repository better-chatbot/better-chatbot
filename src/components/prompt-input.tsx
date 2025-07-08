"use client";

import {
  AudioWaveformIcon,
  ChevronDown,
  CornerRightUp,
  Paperclip,
  Pause,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "ui/button";
import { UseChatHelpers } from "@ai-sdk/react";
import { SelectModel } from "./select-model";
import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import { ChatMention, ChatMessageAnnotation, ChatModel } from "app-types/chat";
import dynamic from "next/dynamic";
import { ToolModeDropdown } from "./tool-mode-dropdown";
import { ToolSelectDropdown } from "./tool-select-dropdown";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import { useTranslations } from "next-intl";
import { Editor } from "@tiptap/react";
import { WorkflowSummary } from "app-types/workflow";
import { FileModePicker } from "./file-mode-picker"; // <- reuse from old version

interface PromptInputProps {
  placeholder?: string;
  setInput: (value: string) => void;
  input: string;
  onStop: () => void;
  append: UseChatHelpers["append"];
  toolDisabled?: boolean;
  isLoading?: boolean;
  model?: ChatModel;
  setModel?: (model: ChatModel) => void;
  voiceDisabled?: boolean;
}

const ChatMentionInput = dynamic(() => import("./chat-mention-input"), {
  ssr: false,
  loading() {
    return <div className="h-[2rem] w-full animate-pulse"></div>;
  },
});

export default function PromptInput({
  placeholder,
  append,
  model,
  setModel,
  input,
  setInput,
  onStop,
  isLoading,
  toolDisabled,
  voiceDisabled,
}: PromptInputProps) {
  const t = useTranslations("Chat");

  const [currentThreadId, currentProjectId, globalModel, appStoreMutate] =
    appStore(
      useShallow((state) => [
        state.currentThreadId,
        state.currentProjectId,
        state.chatModel,
        state.mutate,
      ]),
    );

  const chatModel = useMemo(() => model ?? globalModel, [model, globalModel]);
  const editorRef = useRef<Editor | null>(null);

  const setChatModel = useCallback(
    (model: ChatModel) => {
      if (setModel) setModel(model);
      else appStoreMutate({ chatModel: model });
    },
    [setModel, appStoreMutate],
  );

  const [toolMentionItems, setToolMentionItems] = useState<ChatMention[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  type UploadedFile = {
    file: File;
    mode: "text" | "binary";
  };
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const onSelectWorkflow = useCallback((workflow: WorkflowSummary) => {
    const workflowMention: ChatMention = {
      type: "workflow",
      workflowId: workflow.id,
      icon: workflow.icon,
      name: workflow.name,
      description: workflow.description,
    };
    editorRef.current
      ?.chain()
      .insertContent({
        type: "mention",
        attrs: {
          label: `${workflow.name} `,
          id: JSON.stringify(workflowMention),
        },
      })
      .focus()
      .run();
  }, []);

  const submit = async () => {
    if (isLoading) return;
    const userMessage = input?.trim() || "";
    if (!userMessage && uploadedFiles.length === 0) return;

    const annotations: ChatMessageAnnotation[] = [];
    if (toolMentionItems.length > 0) {
      annotations.push({ mentions: toolMentionItems });
    }

    const fileParts = await Promise.all(
      uploadedFiles.map(async ({ file, mode }) => {
        const content = await file.arrayBuffer();
        return {
          type: "text" as const,
          text:
            mode === "text"
              ? `File "${file.name}":\n${new TextDecoder().decode(content)}`
              : `ATTACHMENT (do not interpret): File "${file.name}":\n${Array.from(new Uint8Array(content)).join(",")}`,
        };
      }),
    );

    append!({
      role: "user",
      content: "",
      annotations,
      parts: [
        ...fileParts,
        ...(userMessage ? [{ type: "text", text: userMessage }] : []),
      ],
    });

    setToolMentionItems([]);
    setInput("");
    setUploadedFiles([]);
  };

  return (
    <div className="max-w-3xl mx-auto fade-in animate-in">
      <div className="z-10 mx-auto w-full max-w-3xl relative">
        <fieldset className="flex w-full flex-col px-2">
          <div className="rounded-4xl backdrop-blur-sm bg-muted/80 transition-all duration-200 relative flex flex-col cursor-text border focus-within:border-muted-foreground hover:border-muted-foreground p-3">
            <div className="flex flex-col gap-3.5 px-1">
              <div className="relative min-h-[2rem]">
                <ChatMentionInput
                  input={input}
                  onChange={setInput}
                  onChangeMention={setToolMentionItems}
                  onEnter={submit}
                  placeholder={placeholder ?? t("placeholder")}
                  ref={editorRef}
                />
              </div>

              {/* uploaded files list */}
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((uf, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 border rounded px-2 py-1 bg-muted"
                  >
                    <span className="text-xs truncate">
                      {uf.file.name} ({uf.mode})
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setUploadedFiles((prev) =>
                          prev.filter((_, i) => i !== index),
                        )
                      }
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5 z-30">
                {/* upload file button */}
                <div
                  className="cursor-pointer text-muted-foreground hover:ring ring-input rounded-full p-2 bg-transparent hover:bg-muted transition-all duration-200"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="size-4" />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      setPendingFile(e.target.files[0]);
                    }
                  }}
                />
                {pendingFile && (
                  <FileModePicker
                    file={pendingFile}
                    onSelect={(mode) => {
                      setUploadedFiles((prev) => [
                        ...prev,
                        { file: pendingFile, mode },
                      ]);
                      setPendingFile(null);
                    }}
                    onClose={() => setPendingFile(null)}
                  />
                )}

                {!toolDisabled && (
                  <>
                    <ToolModeDropdown />
                    <ToolSelectDropdown
                      align="start"
                      side="top"
                      onSelectWorkflow={onSelectWorkflow}
                    />
                  </>
                )}

                <div className="flex-1" />

                <SelectModel onSelect={setChatModel} defaultModel={chatModel}>
                  <Button
                    variant={"ghost"}
                    className="rounded-full data-[state=open]:bg-input! hover:bg-input!"
                  >
                    {chatModel?.model ?? (
                      <span className="text-muted-foreground">model</span>
                    )}
                    <ChevronDown className="size-3" />
                  </Button>
                </SelectModel>

                {!isLoading && !input.length && !voiceDisabled ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        onClick={() =>
                          appStoreMutate((state) => ({
                            voiceChat: {
                              ...state.voiceChat,
                              isOpen: true,
                              threadId: currentThreadId ?? undefined,
                              projectId: currentProjectId ?? undefined,
                            },
                          }))
                        }
                        className="border fade-in animate-in cursor-pointer text-background rounded-full p-2 bg-primary hover:bg-primary/90 transition-all duration-200"
                      >
                        <AudioWaveformIcon size={16} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{t("VoiceChat.title")}</TooltipContent>
                  </Tooltip>
                ) : (
                  <div
                    onClick={() => {
                      if (isLoading) onStop();
                      else submit();
                    }}
                    className="fade-in animate-in cursor-pointer text-muted-foreground rounded-full p-2 bg-secondary hover:bg-accent-foreground hover:text-accent transition-all duration-200"
                  >
                    {isLoading ? (
                      <Pause
                        size={16}
                        className="fill-muted-foreground text-muted-foreground"
                      />
                    ) : (
                      <CornerRightUp size={16} />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  );
}
