import "./EmptyState.css";

interface Props {
  icon?: string;
  title: string;
  description?: string;
}

export default function EmptyState({ icon = "📭", title, description }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="empty-state__title">{title}</div>
      {description && <p className="empty-state__desc">{description}</p>}
    </div>
  );
}
