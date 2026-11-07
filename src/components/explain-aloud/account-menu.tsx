"use client";

import { SignInButton, useClerk, useUser } from "@clerk/nextjs";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type ClerkUser = NonNullable<ReturnType<typeof useUser>["user"]>;

function emailLocalPart(user: ClerkUser) {
  return user.primaryEmailAddress?.emailAddress.split("@")[0] ?? "";
}

export function displayName(user: ClerkUser) {
  return user.firstName || user.fullName || user.username || emailLocalPart(user) || "Account";
}

export function initials(user: ClerkUser) {
  const fromName = [user.firstName, user.lastName]
    .map((part) => part?.trim()[0])
    .filter(Boolean)
    .join("");
  const fallback = (user.username || emailLocalPart(user) || "?").slice(0, 2);
  return (fromName || fallback).toUpperCase();
}

const menuItemClass =
  "block w-full rounded-[8px] px-3 py-2 text-left text-[13px] leading-[1.5] text-[#e8e6ff] transition-colors hover:bg-[#1e1f45]";

/** Avatar, name and account menu for the dark Orbit nav, driven by the Clerk session (incl. OAuth profile photos). */
export function AccountMenu() {
  const { isLoaded, isSignedIn, user } = useUser();
  const clerk = useClerk();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!isLoaded) {
    return <span aria-hidden data-testid="account-loading" className="size-[34px] shrink-0 rounded-full bg-[#2a2b5a]" />;
  }

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button
          type="button"
          className="rounded-full bg-[#ff5e7a] px-[17px] py-[8px] text-[13px] leading-[1.5] font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#ff7790]"
        >
          Sign in
        </button>
      </SignInButton>
    );
  }

  const name = displayName(user);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5"
      >
        {user.hasImage ? (
          <Image
            src={user.imageUrl}
            alt=""
            width={34}
            height={34}
            unoptimized
            className="size-[34px] shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[#2a2b5a] text-[12px] leading-[1.5] font-semibold text-[#ff5e7a]">
            {initials(user)}
          </span>
        )}
        <span className="hidden text-[13px] leading-[1.5] whitespace-nowrap text-[#e8e6ff] sm:inline">{name}</span>
        <span className="relative h-[6px] w-[10px] shrink-0">
          <Image
            src="/figma/explain-aloud/account-menu.svg"
            alt=""
            width={10.7682}
            height={7.10112}
            className="absolute top-[-0.32px] left-[-0.38px] block max-w-none"
          />
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute top-[calc(100%+10px)] right-0 z-20 w-48 rounded-[12px] border border-[rgba(42,43,80,0.6)] bg-[#161730] p-1.5 shadow-[0px_6px_24px_0px_rgba(0,0,0,0.35)]"
        >
          <p className="truncate px-3 pt-1 pb-2 text-[11px] leading-[1.5] text-[#9496bf]">
            {user.primaryEmailAddress?.emailAddress ?? name}
          </p>
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            onClick={() => {
              setOpen(false);
              clerk.openUserProfile();
            }}
          >
            Manage account
          </button>
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            onClick={() => {
              setOpen(false);
              void clerk.signOut({ redirectUrl: "/" });
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
