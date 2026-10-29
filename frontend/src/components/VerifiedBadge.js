export default function VerifiedBadge({ verified }) {
  if (!verified) return null;
  return (
    <span className="verified" title="Original community member" aria-label="OG">
      OG
    </span>
  );
}
