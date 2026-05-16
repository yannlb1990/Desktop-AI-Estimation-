interface Props {
  height?: number;
  markColor?: string;
  dotColor?: string;
}

export const MetricoreLogoMark = ({
  height = 32,
  markColor = "white",
  dotColor = "#1e4db7",
}: Props) => (
  <svg
    height={height}
    viewBox="0 0 215 132"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "block", flexShrink: 0 }}
    aria-label="Metricore"
  >
    {/* Wavy m mark — sinusoidal path with thick rounded stroke */}
    <path
      d="M 18,110 L 18,65
         C 18,10 72,10 72,65
         C 72,120 126,120 126,65
         C 126,10 180,10 180,65
         L 180,110"
      stroke={markColor}
      strokeWidth="35"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Blue dot — period at end of right leg */}
    <circle cx="197" cy="113" r="15" fill={dotColor} />
  </svg>
);
