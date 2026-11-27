import QRCode, { type QRCodeErrorCorrectionLevel } from "qrcode";

export interface QrCodeSvgProps {
  value: string;
  size?: number;
  margin?: number;
  errorCorrectionLevel?: QRCodeErrorCorrectionLevel;
  fgColor?: string;
  bgColor?: string;
  className?: string;
  title?: string;
}

function buildQrSvgData(
  value: string,
  margin: number,
  errorCorrectionLevel: QRCodeErrorCorrectionLevel
): { viewBoxSize: number; pathData: string } {
  const qr = QRCode.create(value, { errorCorrectionLevel });
  const { size, get } = qr.modules;
  const segments: string[] = [];

  for (let row = 0; row < size; row += 1) {
    let col = 0;
    while (col < size) {
      if (get.call(qr.modules, row, col)) {
        const start = col;
        while (col < size && get.call(qr.modules, row, col)) {
          col += 1;
        }
        const runLength = col - start;
        segments.push(
          `M${start + margin} ${row + margin}h${runLength}v1h-${runLength}z`
        );
      } else {
        col += 1;
      }
    }
  }

  return {
    viewBoxSize: size + margin * 2,
    pathData: segments.join(""),
  };
}

export function QrCodeSvg({
  value,
  size,
  margin = 2,
  errorCorrectionLevel = "M",
  fgColor = "#1F1916",
  bgColor = "#FFFFFF",
  className,
  title,
}: QrCodeSvgProps) {
  const safeMargin = Math.max(0, Math.floor(margin));
  const { viewBoxSize, pathData } = buildQrSvgData(
    value,
    safeMargin,
    errorCorrectionLevel
  );
  const label = title ?? `Código QR para ${value}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={className}
    >
      <title>{label}</title>
      <rect width={viewBoxSize} height={viewBoxSize} fill={bgColor} />
      <path d={pathData} fill={fgColor} />
    </svg>
  );
}
