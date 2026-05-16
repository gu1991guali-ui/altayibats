type StatusMessageProps = {
  title?: string;
  children: React.ReactNode;
  tone?: "info" | "error" | "success";
};

export function StatusMessage({ title, children, tone = "info" }: StatusMessageProps) {
  return (
    <div className={`status-message ${tone}`} role={tone === "error" ? "alert" : "status"}>
      {title ? <strong>{title}</strong> : null}
      <span>{children}</span>
    </div>
  );
}
