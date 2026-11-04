export default function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-symbol">✳</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
