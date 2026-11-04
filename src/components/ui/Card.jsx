export default function Card({ className = "", children, ...props }) {
  return (
    <div className={`wb-card ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
