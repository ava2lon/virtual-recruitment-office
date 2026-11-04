export default function Skeleton({ width = "100%", height = "1rem", className = "" }) {
  return (
    <span
      className={`wb-skeleton ${className}`.trim()}
      style={{ width, height, display: "inline-block" }}
      aria-hidden="true"
    />
  );
}
