"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Flame } from "lucide-react";
import { Button } from "@/components/ui/Button";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/create", label: "Explore Rooms" },
  { href: "/#about", label: "About" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-night/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4" aria-label="Main">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-cream">
          <Flame className="h-5 w-5 text-ember" aria-hidden />
          Campfire
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-muted transition-colors hover:text-cream">
              {l.label}
            </Link>
          ))}
          <Link href="/create">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>

        <button
          className="text-cream md:hidden cursor-pointer"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-line/60 px-5 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-sm text-muted hover:text-cream"
              >
                {l.label}
              </Link>
            ))}
            <Link href="/create" onClick={() => setOpen(false)}>
              <Button size="sm" className="w-full">Get Started</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
