export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="font-display text-2xl text-ink">DealFlow360</p>
          <p className="mt-1 text-sm text-muted">Quotation-to-cash platform</p>
        </div>
        <div className="rounded-lg border border-hairline bg-canvas p-8 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
