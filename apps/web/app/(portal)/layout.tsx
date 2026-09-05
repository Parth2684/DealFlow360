export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-canvas">
      <header className="border-b border-hairline px-4 py-4 sm:px-8">
        <p className="font-display text-lg text-ink">DealFlow360</p>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}
