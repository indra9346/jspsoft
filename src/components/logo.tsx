/* eslint-disable @next/next/no-img-element */
export function Logo({
  src,
  size = 44,
  className = "",
}: {
  src?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-2xl bg-white shadow-md shrink-0 ${className}`}
      style={{ width: size, height: size, padding: size * 0.14 }}
    >
      <img src={src || "/swan-logo.png"} alt="School logo" className="h-full w-full object-contain" />
    </span>
  );
}
