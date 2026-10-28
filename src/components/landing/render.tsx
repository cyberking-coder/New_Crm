import type { AnyBlock, BlockKind } from "@/lib/landing/blocks";
import { cn } from "@/lib/utils";

// Pure, deterministic renderers. The public landing page and the builder preview
// both call these — one source of truth for how a block looks.

type RenderCtx = {
  // The registration form element to inline when a `form_anchor` block is reached.
  formSlot?: React.ReactNode;
  // Target time for countdown blocks when `data.target_iso` is empty.
  defaultCountdownIso?: string;
};

export function renderBlock(block: AnyBlock, ctx: RenderCtx = {}): React.ReactNode {
  if (block.is_hidden) return null;

  switch (block.kind as BlockKind) {
    case "hero":
      return <HeroBlock data={block.data as HeroData} />;
    case "rich_text":
      return <RichTextBlock data={block.data as RichTextData} />;
    case "bullets":
      return <BulletsBlock data={block.data as BulletsData} />;
    case "video":
      return <VideoBlock data={block.data as VideoData} />;
    case "countdown":
      return (
        <CountdownBlock data={block.data as CountdownData} fallbackIso={ctx.defaultCountdownIso} />
      );
    case "logos":
      return <LogosBlock data={block.data as LogosData} />;
    case "testimonial":
      return <TestimonialBlock data={block.data as TestimonialData} />;
    case "faq":
      return <FaqBlock data={block.data as FaqData} />;
    case "cta":
      return <CtaBlock data={block.data as CtaData} />;
    case "image":
      return <ImageBlock data={block.data as ImageData} />;
    case "form_anchor":
      return ctx.formSlot ? <FormAnchor>{ctx.formSlot}</FormAnchor> : null;
    default:
      return null;
  }
}

// -----------------------------------------------------------------------------
// Individual block renderers. Each one is a self-contained section.
// -----------------------------------------------------------------------------

function Section({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("w-full px-6 py-12 md:py-16", className)}>
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  );
}

// ---- hero
type HeroData = {
  eyebrow?: string;
  heading: string;
  subheading?: string;
  background?: "light" | "dark" | "accent";
};
function HeroBlock({ data }: { data: HeroData }) {
  const bg =
    data.background === "dark"
      ? "bg-sidebar text-sidebar-foreground"
      : data.background === "accent"
        ? "bg-primary text-primary-foreground"
        : "bg-background";
  return (
    <Section className={bg}>
      {data.eyebrow ? (
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider opacity-80">
          {data.eyebrow}
        </div>
      ) : null}
      <h1 className="mb-4 text-4xl font-semibold tracking-tight md:text-5xl">{data.heading}</h1>
      {data.subheading ? <p className="max-w-2xl text-lg opacity-90">{data.subheading}</p> : null}
    </Section>
  );
}

// ---- rich text
type RichTextData = { heading?: string; body: string };
function RichTextBlock({ data }: { data: RichTextData }) {
  return (
    <Section>
      {data.heading ? <h2 className="mb-3 text-2xl font-semibold">{data.heading}</h2> : null}
      <div className="whitespace-pre-wrap text-base leading-relaxed">{data.body}</div>
    </Section>
  );
}

// ---- bullets
type BulletsData = { heading?: string; items: { title: string; description?: string }[] };
function BulletsBlock({ data }: { data: BulletsData }) {
  return (
    <Section>
      {data.heading ? <h2 className="mb-6 text-2xl font-semibold">{data.heading}</h2> : null}
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.items.map((it, i) => (
          <li key={i} className="rounded-lg border bg-card p-4">
            <div className="font-semibold">{it.title}</div>
            {it.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{it.description}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ---- video
type VideoData = { heading?: string; url: string };
function VideoBlock({ data }: { data: VideoData }) {
  const embed = toEmbedUrl(data.url);
  const isDirect = /\.(mp4|webm)$/i.test(data.url);
  return (
    <Section>
      {data.heading ? <h2 className="mb-4 text-2xl font-semibold">{data.heading}</h2> : null}
      <div className="aspect-video overflow-hidden rounded-lg border bg-black">
        {isDirect ? (
          <video src={data.url} controls className="h-full w-full" />
        ) : embed ? (
          <iframe
            src={embed}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={data.heading ?? "Video"}
          />
        ) : null}
      </div>
    </Section>
  );
}
function toEmbedUrl(u: string): string | null {
  try {
    const url = new URL(u);
    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (url.hostname === "youtu.be") {
      return `https://www.youtube.com/embed${url.pathname}`;
    }
    if (url.hostname.includes("vimeo.com")) {
      const id = url.pathname.replace(/^\//, "").split("/")[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (url.hostname.includes("wistia.com")) return u;
    return null;
  } catch {
    return null;
  }
}

// ---- countdown
type CountdownData = { heading?: string; target_iso?: string };
function CountdownBlock({ data, fallbackIso }: { data: CountdownData; fallbackIso?: string }) {
  const iso = data.target_iso || fallbackIso;
  if (!iso) return null;
  const target = new Date(iso);
  const now = new Date();
  const totalSeconds = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return (
    <Section>
      {data.heading ? <h2 className="mb-4 text-2xl font-semibold">{data.heading}</h2> : null}
      <div className="flex items-center gap-4 text-center">
        {[
          { label: "days", v: days },
          { label: "hours", v: hours },
          { label: "min", v: minutes },
        ].map((p) => (
          <div key={p.label} className="rounded-lg border bg-card px-5 py-3">
            <div className="text-3xl font-semibold tabular-nums">{p.v}</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{p.label}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Rendered server-side — refresh for an updated value.
      </p>
    </Section>
  );
}

// ---- logos
type LogosData = { heading?: string; logos: { alt: string; url: string }[] };
function LogosBlock({ data }: { data: LogosData }) {
  return (
    <Section>
      {data.heading ? (
        <h2 className="mb-6 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {data.heading}
        </h2>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
        {data.logos.map((l, i) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img key={i} src={l.url} alt={l.alt} className="h-8 opacity-70 grayscale" />
        ))}
      </div>
    </Section>
  );
}

// ---- testimonial
type TestimonialData = { quote: string; author: string; role?: string; avatar_url?: string };
function TestimonialBlock({ data }: { data: TestimonialData }) {
  return (
    <Section>
      <blockquote className="mx-auto max-w-3xl rounded-xl border bg-card p-6 text-center">
        <p className="text-lg italic">&ldquo;{data.quote}&rdquo;</p>
        <footer className="mt-4 flex items-center justify-center gap-3">
          {data.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={data.avatar_url} alt={data.author} className="h-10 w-10 rounded-full" />
          ) : null}
          <div className="text-sm">
            <div className="font-semibold">{data.author}</div>
            {data.role ? <div className="text-muted-foreground">{data.role}</div> : null}
          </div>
        </footer>
      </blockquote>
    </Section>
  );
}

// ---- faq
type FaqData = { heading?: string; items: { q: string; a: string }[] };
function FaqBlock({ data }: { data: FaqData }) {
  return (
    <Section>
      {data.heading ? <h2 className="mb-4 text-2xl font-semibold">{data.heading}</h2> : null}
      <div className="divide-y rounded-lg border bg-card">
        {data.items.map((it, i) => (
          <details key={i} className="group p-4">
            <summary className="cursor-pointer font-medium">{it.q}</summary>
            <p className="mt-2 text-sm text-muted-foreground">{it.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

// ---- cta
type CtaData = { heading: string; subheading?: string };
function CtaBlock({ data }: { data: CtaData }) {
  return (
    <Section className="bg-primary/10">
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{data.heading}</h2>
          {data.subheading ? (
            <p className="mt-1 text-sm text-muted-foreground">{data.subheading}</p>
          ) : null}
        </div>
        <a
          href="#register"
          className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Register
        </a>
      </div>
    </Section>
  );
}

// ---- image
type ImageData = { url: string; alt: string; caption?: string };
function ImageBlock({ data }: { data: ImageData }) {
  return (
    <Section>
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.url} alt={data.alt} className="w-full rounded-lg border" />
        {data.caption ? (
          <figcaption className="mt-2 text-center text-xs text-muted-foreground">
            {data.caption}
          </figcaption>
        ) : null}
      </figure>
    </Section>
  );
}

// ---- form anchor
function FormAnchor({ children }: { children: React.ReactNode }) {
  return (
    <section id="register" className="w-full px-6 py-12 md:py-16">
      <div className="mx-auto max-w-xl rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Save your seat</h2>
        {children}
      </div>
    </section>
  );
}
