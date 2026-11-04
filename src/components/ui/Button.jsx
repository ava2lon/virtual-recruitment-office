export default function Button({ variant = "default", className = "", children, ...props }) {
  const variantClass = variant === "primary" ? "wb-btn wb-btn--primary" : "wb-btn";
  return (
    <button className={`${variantClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
