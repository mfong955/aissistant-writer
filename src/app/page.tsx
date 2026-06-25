import Link from "next/link";
import { PenLine, Brain, Layers, CloudUpload, FileDown, ArrowRight, Check } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <PenLine className="h-5 w-5 text-primary" />
          <span className="font-semibold">Aissistant Writer</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-8 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Get started free
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background py-24 md:py-36">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm text-primary">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
          </span>
          AI-powered writing assistant
        </div>

        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Write more.{" "}
          <span className="text-primary">Edit less.</span>
          <br />
          AI that knows your story.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Aissistant Writer brings an AI assistant into your creative workflow — one that reads your
          characters, chapters, and notes so you never have to repeat yourself.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start writing free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-lg border border-border px-6 text-base font-medium text-foreground transition-colors hover:bg-accent"
          >
            Sign in
          </Link>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          No credit card required · Free to get started
        </p>
      </div>
    </section>
  );
}

const features = [
  {
    icon: Brain,
    title: "AI that reads your project",
    body: "Every response is informed by your characters, chapters, and notes. No more pasting context — the AI already knows your story.",
  },
  {
    icon: Layers,
    title: "Organized like a novel",
    body: "A hierarchical explorer for chapters, scenes, characters, settings, and custom entity types. Keep everything where it belongs.",
  },
  {
    icon: CloudUpload,
    title: "Cloud synced",
    body: "Your work is always safe and accessible from any browser. Write on your laptop, pick up on your iPad.",
  },
  {
    icon: FileDown,
    title: "Export anywhere",
    body: "Export chapters as DOCX, PDFs, or ZIP your entire project. Your manuscript, in any format you need.",
  },
];

function Features() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Everything a writer needs</h2>
          <p className="mt-3 text-muted-foreground">
            Built for long-form work — novels, screenplays, game narratives, and more.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border/60 bg-card p-6 transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const steps = [
  {
    number: "01",
    title: "Create a project",
    body: "Name your novel, screenplay, or campaign. Add a description and system instructions to shape the AI's voice.",
  },
  {
    number: "02",
    title: "Build your world",
    body: "Add characters, settings, chapters, and notes to the explorer. The AI reads all of it as context.",
  },
  {
    number: "03",
    title: "Write with AI at your side",
    body: "Open the chat panel and ask for anything — brainstorming, drafting, editing, continuity checks. The AI knows your project.",
  },
];

function HowItWorks() {
  return (
    <section className="bg-muted/30 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.number} className="relative">
              <div className="mb-4 text-4xl font-bold text-primary/20">{step.number}</div>
              <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For writers who bring their own AI key.",
    cta: "Get started",
    href: "/signup",
    highlight: false,
    features: [
      "Unlimited projects & entities",
      "Full editor with export",
      "Cloud sync & backup",
      "Bring your own OpenRouter API key",
      "Community support",
    ],
  },
  {
    name: "Pro",
    price: "$12",
    period: "per month",
    description: "AI credits included — no API key needed.",
    cta: null,
    href: null,
    highlight: true,
    badge: "Coming soon",
    features: [
      "Everything in Free",
      "200 AI messages / month included",
      "No API key required",
      "Priority support",
      "Early access to new features",
    ],
  },
];

function Pricing() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Simple pricing</h2>
          <p className="mt-3 text-muted-foreground">
            Start free, upgrade when you need more AI.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 ${
                plan.highlight
                  ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                  : "border-border bg-card"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  {plan.badge}
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/{plan.period}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <ul className="mb-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>

              {plan.cta && plan.href ? (
                <Link
                  href={plan.href}
                  className={`inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    plan.highlight
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-border bg-background hover:bg-accent"
                  }`}
                >
                  {plan.cta}
                </Link>
              ) : (
                <div className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-border bg-muted px-4 py-2.5 text-sm font-medium text-muted-foreground">
                  Coming soon
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Need more AI? Credit top-ups coming soon — pay only for what you use.
        </p>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="border-t border-border bg-gradient-to-b from-background to-primary/5 py-20">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          Ready to write something great?
        </h2>
        <p className="mt-4 text-muted-foreground">
          Join writers who use Aissistant to keep their projects organized and their
          AI assistant in context.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start writing free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PenLine className="h-4 w-4" />
            <span>Aissistant Writer</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-foreground">
              Sign up
            </Link>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Aissistant Writer. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
