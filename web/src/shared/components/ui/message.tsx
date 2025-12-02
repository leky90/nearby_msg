import type { ComponentProps, HTMLAttributes } from "react";
import { tv } from "tailwind-variants";

import { cn } from "@/shared/lib/utils";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui/avatar";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant" | "system";
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex flex-col gap-2",
      from === "user" ? "is-user items-end" : "is-assistant items-start w-full",
      className
    )}
    {...props}
  />
);

const messageContentVariants = tv({
  base: [
    "is-user:dark flex flex-col gap-2 overflow-hidden rounded-lg text-sm w-full",
    "px-2 py-1.5",
    // Owner messages: colored bubble
    "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground",
    // Other users: neutral bubble full width
    "group-[.is-assistant]:bg-muted group-[.is-assistant]:text-foreground group-[.is-assistant]:w-full",
  ],
});

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div className={messageContentVariants({ className })} {...props}>
    {children}
  </div>
);

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  src: string;
  name?: string;
};

export const MessageAvatar = ({
  src,
  name,
  className,
  ...props
}: MessageAvatarProps) => (
  <Avatar className={cn("ring-border size-8 ring-1", className)} {...props}>
    <AvatarImage alt="" className="mt-0 mb-0" src={src} />
    <AvatarFallback>{name?.slice(0, 2) || "ME"}</AvatarFallback>
  </Avatar>
);
