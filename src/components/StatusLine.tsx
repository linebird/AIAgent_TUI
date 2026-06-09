export default function StatusLine({ text }: { text: string }) {
  return (
    <div className="status-line">
      <span className="spinner" />
      <span className="shimmer">{text}</span>
    </div>
  );
}
