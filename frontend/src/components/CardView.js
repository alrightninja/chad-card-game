import { useLayoutEffect, useRef } from "react";
import { motion } from "framer-motion";

function FitText({ className, children, minPx = 7 }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      el.style.fontSize = "";
      const base = parseFloat(getComputedStyle(el).fontSize);
      let size = base;
      while (
        size > minPx &&
        (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)
      ) {
        size -= 0.35;
        el.style.fontSize = `${size}px`;
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children, minPx]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export function cardArtSrc(card) {
  if (!card) return "";
  if (card.art) return `/cards/${card.art}`;
  return "";
}

function currentPower(card) {
  return Math.max(0, (card.power || 0) + (card.tempPower || 0));
}

export default function CardView({
  card,
  size = "small",
  selected = false,
  onClick,
  onPointerDown,
  showAbility = true,
  animate = true,
  lunge = 0,
  layoutKey,
  dragging = false,
  hot = false,
  dropKind,
  dropIndex,
  entering = false,
  onDoubleClick,
  badges = []
}) {
  if (!card) return null;
  const printed = card.printedPower ?? card.power;
  const now = currentPower(card);
  const decayed = printed != null && (card.power || 0) < printed;
  const temp = card.tempPower || 0;
  const compact = size === "bench" || size === "board" || size === "tiny" || size === "active" || size === "hand";
  const sizeClass = size === "board" ? "bench" : size;
  const cls = [
    "tcg",
    sizeClass,
    selected ? "selected" : "",
    dragging ? "is-ghost-source" : "",
    hot ? "drop-hot" : "",
    card.trait ? `trait-${card.trait}` : ""
  ].join(" ");

  const nameEl = compact ? (
    <div className="tcg-name" title={card.name}>{card.name}</div>
  ) : (
    <FitText className="tcg-name" minPx={8}>{card.name}</FitText>
  );

  const inner = (
    <>
      <div className="tcg-top">
        {nameEl}
        <div className="tcg-hp">
          <span className="tcg-hp-num">{now}</span>
          {temp ? <span className="tcg-temp">{temp > 0 ? `+${temp}` : temp}</span> : null}
        </div>
      </div>
      <div className="tcg-art">
        {cardArtSrc(card) ? (
          <img src={cardArtSrc(card)} alt="" draggable="false" />
        ) : null}
      </div>
      <div className="tcg-type">{card.trait}</div>
      {compact && sizeClass === "active" && card.abilityKeyword ? (
        <div className="tcg-ability-chip">{card.abilityKeyword}</div>
      ) : null}
      {showAbility && !compact ? (
        <FitText className="tcg-ability" minPx={8}>{card.abilityText || ""}</FitText>
      ) : null}
      {showAbility && !compact && card.flavorLine ? (
        <div className="tcg-flavor">{card.flavorLine}</div>
      ) : null}
      <div className="tcg-was">{decayed ? `was ${printed}` : "\u00a0"}</div>
    </>
  );

  const dropProps = dropKind
    ? { "data-drop": dropKind, "data-index": dropIndex }
    : {};

  const face = <div className={cls}>{inner}</div>;

  return (
    <div
      className={`card-fit ${sizeClass} ${selected ? "selected" : ""} ${hot ? "drop-hot" : ""} ${entering ? "entering" : ""} ${card.tired || card.tiredTurns > 0 ? "is-tired" : ""}`}
      role={onClick || onDoubleClick ? "button" : undefined}
      tabIndex={onClick || onDoubleClick ? 0 : undefined}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      {...dropProps}
    >
      {badges.length ? (
        <div className="card-badges">
          {badges.map((b) => (
            <span key={b.kind} className={`card-badge ${b.kind}`}>{b.text}</span>
          ))}
        </div>
      ) : null}
      {animate ? (
        <motion.div
          className="card-motion"
          animate={{
            y: lunge || (selected && !dragging ? -6 : 0),
            opacity: dragging ? 0.35 : 1
          }}
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
          initial={false}
        >
          {face}
        </motion.div>
      ) : (
        face
      )}
    </div>
  );
}
