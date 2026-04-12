export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left brand panel — subtle gradient */}
      <div className="hidden lg:flex lg:w-[420px] relative overflow-hidden bg-gradient-to-br from-[hsl(228,18%,14%)] to-[hsl(228,18%,10%)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(16_65%_52%/0.12),transparent_60%)]" />
        <div className="relative z-10 flex flex-col justify-between p-10 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm font-bold text-sm">
              BM
            </div>
            <span className="text-[15px] font-bold tracking-tight">
              Benefit Market
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl font-bold leading-tight tracking-tight">
              Корпоративные
              <br />
              льготы в&nbsp;одном месте
            </h1>
            <p className="text-white/50 text-sm leading-relaxed max-w-[320px]">
              Современная платформа для управления и выбора корпоративных льгот.
              Удобно для сотрудников, прозрачно для HR.
            </p>
          </div>

          <p className="text-[11px] text-white/30">
            &copy; {new Date().getFullYear()} Benefit Market
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center bg-background p-6 lg:p-12">
        <div className="w-full max-w-[400px]">{children}</div>
      </div>
    </div>
  );
}
