export default function TrustShareLogo({ className = "" }) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
      aria-label="TrustShare logo"
    >
      <svg
        width="112"
        height="112"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="TrustShare shield and lock"
      >
        <defs>
          <linearGradient id="trustshareTeal" x1="15" y1="10" x2="85" y2="90">
            <stop stopColor="#00F0D8" />
            <stop offset="1" stopColor="#00AFC5" />
          </linearGradient>
        </defs>
        <path
          d="M50 7 84 24V48C84 69 70 84 50 94 30 84 16 69 16 48V24L50 7Z"
          stroke="url(#trustshareTeal)"
          strokeWidth="7"
          strokeLinejoin="round"
        />
        <rect x="33" y="43" width="34" height="28" rx="6" fill="url(#trustshareTeal)" />
        <path
          d="M40 43V34C40 20 60 20 60 34V43"
          stroke="url(#trustshareTeal)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <circle cx="50" cy="55" r="4" fill="#032033" />
        <path d="M50 58V63" stroke="#032033" strokeWidth="3" strokeLinecap="round" />
        <path
          d="M13 60C25 78 70 69 87 40"
          stroke="#00E8D2"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}