import { RPSChoice } from '../data/rps';

interface HandSkeletonSvgProps {
  gesture: RPSChoice;
  color?: string;
  className?: string;
  glow?: boolean;
}

// 21 tọa độ landmark chuẩn hóa (0..100) cho từng thế tay
const SKELETON_LANDMARKS: Record<RPSChoice, [number, number][]> = {
  // ✊ BÚA: Cả 5 ngón gập chặt thành nắm đấm
  rock: [
    [50, 90], // 0: Cổ tay
    [36, 80], [28, 68], [35, 60], [46, 62], // 1-4: Ngón cái ôm ngoài
    [36, 54], [35, 42], [41, 45], [42, 54], // 5-8: Ngón trỏ gập
    [47, 52], [47, 39], [51, 42], [51, 52], // 9-12: Ngón giữa gập
    [58, 54], [59, 42], [57, 45], [57, 54], // 13-16: Ngón áp út gập
    [68, 60], [69, 50], [67, 53], [66, 60], // 17-20: Ngón út gập
  ],

  // ✌️ KÉO: Ngón trỏ & giữa duỗi thẳng chữ V, 3 ngón còn lại gập
  scissors: [
    [50, 92], // 0: Cổ tay
    [36, 80], [28, 70], [36, 64], [46, 65], // 1-4: Ngón cái gập
    [37, 56], [33, 40], [28, 25], [23, 10], // 5-8: Ngón trỏ DUỖI V
    [50, 54], [53, 38], [57, 24], [61, 8],  // 9-12: Ngón giữa DUỖI V
    [62, 58], [63, 48], [60, 51], [59, 58], // 13-16: Ngón áp út gập
    [72, 64], [73, 56], [70, 59], [68, 65], // 17-20: Ngón út gập
  ],

  // ✋ BAO: Cả 5 ngón tay xòe rộng hình quạt
  paper: [
    [50, 92], // 0: Cổ tay
    [36, 80], [24, 68], [16, 56], [9, 44],  // 1-4: Ngón cái xòe trái
    [37, 56], [31, 40], [26, 25], [22, 10], // 5-8: Ngón trỏ xòe
    [50, 54], [50, 36], [50, 20], [50, 6],  // 9-12: Ngón giữa thẳng đứng
    [63, 56], [69, 40], [74, 25], [78, 10], // 13-16: Ngón áp út xòe
    [74, 62], [82, 50], [88, 38], [93, 28], // 17-20: Ngón út xòe phải
  ],
};

const SKELETON_CONNECTIONS: [number, number][] = [
  // Cổ tay đến gốc các ngón
  [0, 1], [0, 5], [0, 9], [0, 13], [0, 17],
  // Vành lòng bàn tay (MCP)
  [5, 9], [9, 13], [13, 17],
  // Ngón cái
  [1, 2], [2, 3], [3, 4],
  // Ngón trỏ
  [5, 6], [6, 7], [7, 8],
  // Ngón giữa
  [9, 10], [10, 11], [11, 12],
  // Ngón áp út
  [13, 14], [14, 15], [15, 16],
  // Ngón út
  [17, 18], [18, 19], [19, 20],
];

const TIP_INDICES = [4, 8, 12, 16, 20];

export function HandSkeletonSvg({
  gesture,
  color = '#00D89A',
  className = 'w-full h-full',
  glow = true,
}: HandSkeletonSvgProps) {
  const points = SKELETON_LANDMARKS[gesture] || SKELETON_LANDMARKS.paper;
  const filterId = `neon-glow-${gesture}-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg
      viewBox="-6 -4 112 108"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {glow && (
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* Đường xương kết nối */}
      <g filter={glow ? `url(#${filterId})` : undefined}>
        {SKELETON_CONNECTIONS.map(([from, to], idx) => {
          const p1 = points[from];
          const p2 = points[to];
          return (
            <line
              key={`bone-${idx}`}
              x1={p1[0]}
              y1={p1[1]}
              x2={p2[0]}
              y2={p2[1]}
              stroke={color}
              strokeWidth="4.2"
              strokeLinecap="round"
              strokeOpacity="0.88"
            />
          );
        })}
      </g>

      {/* 21 Khớp tròn MediaPipe Landmark */}
      {points.map(([x, y], idx) => {
        const isTip = TIP_INDICES.includes(idx);
        const isWrist = idx === 0;

        return (
          <g key={`joint-${idx}`}>
            {/* Vòng hào quang cho đầu ngón */}
            {isTip && (
              <circle
                cx={x}
                cy={y}
                r="6.2"
                fill={color}
                fillOpacity="0.35"
              />
            )}
            <circle
              cx={x}
              cy={y}
              r={isTip ? 4.4 : isWrist ? 4.4 : 3.2}
              fill={isTip ? '#FFFFFF' : color}
              stroke={isTip ? color : '#FFFFFF'}
              strokeWidth="1.2"
            />
          </g>
        );
      })}
    </svg>
  );
}
