import "katex/dist/katex.min.css";
import katex from "katex";
import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import type { NoteSection } from "@/contracts/notes";
import { orbitCardClass, orbitEyebrowClass } from "@/components/orbit/shell";
import { cn } from "@/lib/utils";

type Block = NoteSection["blocks"][number];

/**
 * Read-only rendering of generated notes. Text blocks are Markdown with inline `$…$` / `$$…$$`
 * math; equation blocks are LaTeX (no delimiters), rendered as display math with KaTeX.
 * react-markdown ignores raw HTML, and KaTeX runs with `trust: false`, so model output can't inject markup.
 */

/** Groups consecutive bullet blocks into one list; every other block stands alone. */
export function groupBlocks(blocks: Block[]): ({ kind: "bullets"; items: Block[] } | { kind: "single"; block: Block })[] {
  const out: ({ kind: "bullets"; items: Block[] } | { kind: "single"; block: Block })[] = [];
  for (const block of blocks) {
    const last = out.at(-1);
    if (block.kind === "bullet" && last?.kind === "bullets") last.items.push(block);
    else if (block.kind === "bullet") out.push({ kind: "bullets", items: [block] });
    else out.push({ kind: "single", block });
  }
  return out;
}

const proseClass =
  "text-[15px] leading-[1.75] text-[#e8e6ff] [&_a]:text-[#ff5e7a] [&_a]:underline [&_code]:rounded [&_code]:bg-[#1e1f45] [&_code]:px-1 [&_em]:text-[#c1bedf] [&_li]:ml-5 [&_ol]:list-decimal [&_p+p]:mt-2 [&_strong]:font-semibold [&_strong]:text-white [&_ul]:list-disc";

function Text({ children }: { children: string }) {
  return (
    <div className={proseClass}>
      <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}>
        {children}
      </Markdown>
    </div>
  );
}

/** Display-mode LaTeX; invalid input renders as red source text instead of throwing. */
export function Equation({ latex }: { latex: string }) {
  const html = katex.renderToString(latex, { displayMode: true, throwOnError: false, trust: false, strict: "ignore" });
  return (
    <div
      className="overflow-x-auto rounded-[12px] bg-[#1e1f45]/70 px-4 py-1 text-[17px] text-white"
      // KaTeX output from our own renderer (trust: false), not raw model HTML.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function Labeled({ label, tone, children }: { label: string; tone: "accent" | "success"; children: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-[12px] border-l-[3px] px-4 py-3",
        tone === "accent" ? "border-[#ff5e7a] bg-[#281d35]/60" : "border-[#4ecba0] bg-[#142b30]/70",
      )}
    >
      <p className={cn("text-[10px] font-semibold tracking-[1.5px] uppercase", tone === "accent" ? "text-[#ff5e7a]" : "text-[#4ecba0]")}>
        {label}
      </p>
      <Text>{children}</Text>
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "equation":
      return <Equation latex={block.text} />;
    case "definition":
      return (
        <Labeled label="Definition" tone="accent">
          {block.text}
        </Labeled>
      );
    case "example":
      return (
        <Labeled label="Example" tone="success">
          {block.text}
        </Labeled>
      );
    default:
      return <Text>{block.text}</Text>;
  }
}

export function NotesView({ sections }: { sections: NoteSection[] }) {
  if (!sections.length) {
    return (
      <section className={orbitCardClass}>
        <p className="text-[14px] text-[#9496bf]">These notes are empty.</p>
      </section>
    );
  }
  return (
    <div className="flex w-full flex-col gap-[22px]">
      {sections.map((section, i) => (
        <section key={section.id} aria-labelledby={`section-${section.id}`} className={orbitCardClass}>
          <div className="flex flex-col gap-1.5">
            <p className={orbitEyebrowClass}>{String(i + 1).padStart(2, "0")}</p>
            <h2 id={`section-${section.id}`} className="text-[21px] leading-[1.3] font-medium tracking-[-0.4px] sm:text-[23px]">
              {section.heading}
            </h2>
          </div>
          <div className="flex flex-col gap-4">
            {groupBlocks(section.blocks).map((group) =>
              group.kind === "bullets" ? (
                <ul key={group.items[0].id} className="flex list-disc flex-col gap-1.5 pl-5 marker:text-[#ff5e7a]">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <Text>{item.text}</Text>
                    </li>
                  ))}
                </ul>
              ) : (
                <BlockView key={group.block.id} block={group.block} />
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
