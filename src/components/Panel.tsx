import type { ReactNode } from 'react';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  );
}

export function Field({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {value !== undefined && <span className="field-value">{value}</span>}
      </span>
      {children}
    </label>
  );
}
