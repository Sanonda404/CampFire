import Link from "next/link";
import { Timer, Sparkles, Users, MoonStar, ArrowRight, Flame } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { HeroScene } from "@/components/landing/HeroScene";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const FEATURES = [
  {
    icon: Timer,
    title: "Synchronized focus timer",
    text: "One shared clock, driven by the server. Host starts it, everyone sees the same second — no drift, no excuses.",
  },
  {
    icon: Sparkles,
    title: "Shared Sparks",
    text: "At the pause, a challenge drops for the whole room. Answers stay sealed until the reveal, then light up together.",
  },
  {
    icon: Users,
    title: "Rooms that feel alive",
    text: "Live presence, chat and reactions. See who's around the fire in real time, and who just stepped away.",
  },
  {
    icon: MoonStar,
    title: "A recap worth keeping",
    text: "Every session ends with what you built together — your group's answer, the AI's take, and how long you lasted.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-2 md:py-24">
          <div className="animate-rise">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-ember">
              Co-working, the cozy way
            </p>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
              Welcome to{" "}
              <span className="bg-gradient-to-r from-ember to-ember-soft bg-clip-text text-transparent">
                Campfire
              </span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
              Gather your friends around a virtual fire.               Focus in sync, trade a
              Shared Spark at the break, and let the room think together — even
              when you’re miles apart.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/create?mode=create">
                <Button size="lg">
                  Create a Room <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </Link>
              <Link href="/create?mode=join">
                <Button size="lg" variant="secondary">
                  Explore Rooms
                </Button>
              </Link>
            </div>
          </div>

          <div className="animate-rise" style={{ animationDelay: "0.15s" }}>
            <HeroScene />
          </div>
        </section>

        <section id="about" className="border-t border-line/50 bg-night-soft/60">
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
            <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
              Everything a session needs, nothing it doesn’t
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-sm text-muted">
              Campfire keeps a small circle of friends in rhythm — from the first
              minute of focus to the group’s final word.
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <Card key={f.title} className="transition-colors hover:border-ember/50">
                  <f.icon className="h-6 w-6 text-ember" aria-hidden />
                  <h3 className="mt-4 text-sm font-bold tracking-wide">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-16 text-center md:py-24">
          <Flame className="mx-auto h-8 w-8 text-ember" aria-hidden />
          <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
            The fire’s already lit
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted">
              Start a room, share the code, and your circle can join in seconds.
          </p>
          <Link href="/create" className="mt-8 inline-block">
            <Button size="lg">Light your Campfire</Button>
          </Link>
        </section>
      </main>

      <footer className="border-t border-line/60 py-6 text-center text-xs text-muted/70">
        Campfire — gather, focus, spark.
      </footer>
    </div>
  );
}
