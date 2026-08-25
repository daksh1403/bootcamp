export default function Marquee({
  items,
  speed = 26,
  className = "",
}: {
  items: string[];
  speed?: number;
  className?: string;
}) {
  const row = items.join("  ✦  ");
  return (
    <div className={`marquee-wrap overflow-hidden ${className}`}>
      <div className="marquee-track" style={{ animationDuration: `${speed}s` }}>
        <span className="whitespace-nowrap pr-8">{row}</span>
        <span aria-hidden className="whitespace-nowrap pr-8">
          {row}
        </span>
      </div>
    </div>
  );
}
