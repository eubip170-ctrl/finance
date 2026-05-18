interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-3 flex items-center gap-3 border-b border-border pb-1">
      <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent">
        CHRT
      </span>
      <h1 className="text-2xs font-bold uppercase tracking-[0.3em] text-zinc-100">
        {title}
      </h1>
      {subtitle && (
        <span className="text-2xs uppercase tracking-widest text-zinc-500">
          │ {subtitle}
        </span>
      )}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}
