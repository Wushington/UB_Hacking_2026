/* eslint-disable @next/next/no-img-element -- Figma SVG assets retain their intrinsic dimensions. */
import Link from "next/link";
import type { ReactNode } from "react";
import "./auth.css";

export function DesignIcon({ name }: { name: string }) {
  return <img src={`/orbit/${name}.svg`} alt="" aria-hidden="true" />;
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="orbit-auth">
      <header className="orbit-nav">
        <Link href="/home" className="orbit-brand"><DesignIcon name="orbit" />Orbit Study</Link>
        <Link href="/home" className="orbit-home"><DesignIcon name="arrow-left" />Back to home</Link>
      </header>
      <div className="orbit-content">
        {children}
        <p className="orbit-reassurance"><DesignIcon name="book" />Your notes, flashcards, and next big idea await.</p>
      </div>
      <footer className="orbit-footer">
        <span>© 2026 Orbit Study</span>
        <nav aria-label="Legal and support">
          <Link href="/information#privacy">Privacy</Link>
          <Link href="/information#terms">Terms</Link>
          <Link href="/information#help">Need help?</Link>
        </nav>
      </footer>
    </div>
  );
}
