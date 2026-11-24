"use client";

import type { ComponentPropsWithoutRef } from "react";
import { avatar, idText } from "@/lib/member-display";
import { useProfiles } from "./members/member-profiles";

type Props = Omit<ComponentPropsWithoutRef<"img">, "src" | "onError"> & { member: number };
export default function MemberAvatar({ member, alt, ...props }: Props) {
  const { profiles } = useProfiles();
  const original = avatar(member);
  const replacement = profiles[idText(member)]?.avatar;
  return <img {...props} src={replacement || original} alt={alt ?? idText(member) + " 号群友头像"} onError={event => {
    const image = event.currentTarget;
    const failed = image.getAttribute("src");
    if (replacement && failed === replacement) image.src = original;
    else if (failed !== "/default-avatar.svg") image.src = "/default-avatar.svg";
  }}/>;
}
