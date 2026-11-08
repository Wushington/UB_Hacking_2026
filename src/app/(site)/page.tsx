export default function Home() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-16 sm:px-6">
      <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">AI study companion</p>
      <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Orbit Study</h1>
      <p className="max-w-xl text-lg text-pretty text-muted-foreground">
        Turn whiteboard photos and lecture recordings into organized notes, flashcards, and a clear view of what to
        study next.
      </p>
    </section>
  );
}
