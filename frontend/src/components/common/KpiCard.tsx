interface Props {
  label: string;
  value: string | number;
}

export function KpiCard({ label, value }: Props) {
  return (
    <article className="kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
