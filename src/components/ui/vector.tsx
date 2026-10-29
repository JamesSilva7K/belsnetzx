/**
 * ✨ Conjunto de ícones vetoriais autorais da boutique.
 * Todos desenhados no mesmo grid (24×24 por padrão), com traço fino
 * (stroke 1.5), cantos arredondados e cor herdada de `currentColor`
 * — garantindo consistência visual com o restante da loja.
 */
import React from 'react';

type IconProps = React.SVGProps<SVGSVGElement> & {
  size?: number;
  strokeWidth?: number;
};

function base({ size = 24, strokeWidth = 1.5, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    ...rest
  };
}

/** Ícone oficial vetorial do WhatsApp (vetor autêntico com balão e monofone interno). */
export const IconWhatsApp: React.FC<React.SVGProps<SVGSVGElement> & { size?: number; brandColor?: boolean }> = ({
  size = 20,
  brandColor = false,
  className = '',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    style={brandColor ? { color: '#25D366' } : undefined}
    aria-hidden="true"
    focusable={false}
    {...props}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.04 20.15C10.56 20.15 9.11 19.76 7.85 19.01L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.98 3.81 13.47 3.81 11.91C3.81 7.37 7.5 3.69 12.04 3.69C14.24 3.69 16.31 4.55 17.86 6.1C19.42 7.66 20.27 9.72 20.27 11.92C20.27 16.46 16.58 20.15 12.04 20.15ZM16.55 14.41C16.3 14.28 15.07 13.68 14.84 13.59C14.62 13.51 14.45 13.47 14.29 13.72C14.12 13.97 13.64 14.53 13.5 14.69C13.35 14.86 13.21 14.88 12.96 14.75C12.71 14.63 11.91 14.36 10.96 13.52C10.22 12.86 9.72 12.05 9.58 11.8C9.43 11.55 9.56 11.42 9.69 11.29C9.8 11.18 9.94 11 10.06 10.86C10.19 10.72 10.23 10.61 10.31 10.45C10.4 10.28 10.35 10.14 10.29 10.02C10.23 9.89 9.73 8.67 9.53 8.17C9.32 7.69 9.12 7.75 8.97 7.75C8.83 7.74 8.66 7.74 8.5 7.74C8.33 7.74 8.06 7.8 7.83 8.05C7.6 8.3 6.96 8.9 6.96 10.12C6.96 11.34 7.85 12.52 7.97 12.69C8.1 12.85 9.72 15.36 12.21 16.43C12.8 16.69 13.26 16.84 13.62 16.96C14.22 17.15 14.76 17.12 15.19 17.06C15.67 16.99 16.66 16.46 16.87 15.88C17.07 15.3 17.07 14.81 17.01 14.7C16.95 14.6 16.8 14.53 16.55 14.41Z"
    />
  </svg>
);

/** Selo oficial colorido do WhatsApp para destaques */
export const WhatsAppBrandBadge: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
  <span
    className={`inline-flex items-center justify-center rounded-full bg-[#25D366] text-white shadow-xs ${className}`}
    style={{ width: size, height: size }}
  >
    <IconWhatsApp size={Math.round(size * 0.65)} className="text-white" />
  </span>
);

/** Cabide com alça de cetim. */
export const IconHanger: React.FC<IconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M12 6.2a2.2 2.2 0 1 1 2.2 2.2c-.7 0-1.2.4-1.2 1.1v1.1" />
    <path d="M12 10.6 3.9 16.1a1.6 1.6 0 0 0 .9 2.9h14.4a1.6 1.6 0 0 0 .9-2.9L12 10.6Z" />
  </svg>
);

/** Fita métrica enrolada com trecho estendido. */
export const IconTapeMeasure: React.FC<IconProps> = (props) => (
  <svg {...base(props)}>
    <circle cx="7.2" cy="12" r="4.1" />
    <circle cx="7.2" cy="12" r="1.2" />
    <path d="M9.6 8.4h8.1a3.6 3.6 0 0 1 0 7.2H9.9" />
    <path d="M13 8.4v2.2M16 8.4v3.4M19 8.9v1.7" opacity=".75" />
  </svg>
);

/** Silhueta com marcações de busto, cintura e quadril. */
export const IconSilhouette: React.FC<IconProps> = (props) => (
  <svg {...base(props)}>
    <circle cx="12" cy="4.6" r="2.1" />
    <path d="M12 7.4v1.2" />
    <path d="M7.1 10.6c1.3-.9 3-1.4 4.9-1.4s3.6.5 4.9 1.4c-.5 1.6-.9 3.1-1 4.7-.1 1.5.2 2.8.7 4.1H7.4c.5-1.3.8-2.6.7-4.1-.1-1.6-.5-3.1-1-4.7Z" />
    <path d="M6.4 11.9h11.2M7.9 15.4h8.2M7.4 21h9.2" opacity=".55" />
  </svg>
);

/** Silhueta completa para o provador: proporções reais das medidas. */
export const BodySilhouette: React.FC<{
  bust: number;
  waist: number;
  hip: number;
  className?: string;
}> = ({ bust, waist, hip, className }) => {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const norm = (value: number, min: number, max: number) => clamp((value - min) / (max - min), 0, 1);

  const half = (value: number) => value / 2;
  const bustW = 46 + norm(bust, 70, 130) * 20;
  const waistW = 31 + norm(waist, 52, 120) * 17;
  const hipW = 48 + norm(hip, 74, 140) * 20;
  const ribW = bustW - 4;

  const cx = 60;
  const yNeck = 44;
  const yBust = 88;
  const yRib = 108;
  const yWaist = 134;
  const yHip = 170;
  const yThigh = 210;
  const yBottom = 248;

  const p = (w: number, y: number) => `${cx - half(w)} ${y}`;
  const q = (w: number, y: number) => `${cx + half(w)} ${y}`;

  return (
    <svg
      viewBox="0 0 120 260"
      className={className}
      role="img"
      aria-label="Silhueta proporcional às suas medidas"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* cabeça e pescoço */}
      <circle cx={cx} cy="24" r="11.5" />
      <path d={`M${cx - 4.5} 35 L${cx - 5} ${yNeck} M${cx + 4.5} 35 L${cx + 5} ${yNeck}`} opacity=".75" />

      {/* ombros */}
      <path
        d={`M${p(bustW + 3, yNeck + 2)} Q${p(bustW + 8, yNeck + 9)} ${p(bustW + 2, yNeck + 16)}
            M${q(bustW + 3, yNeck + 2)} Q${q(bustW + 8, yNeck + 9)} ${q(bustW + 2, yNeck + 16)}`}
        opacity=".55"
      />

      {/* tronco */}
      <path
        d={[
          `M${p(bustW - 6, yNeck)}`,
          `C${p(bustW, yNeck + 16)} ${p(bustW, yBust - 8)} ${p(bustW, yBust)}`,
          `C${p(ribW, yBust + 9)} ${p(ribW, yRib)} ${p(waistW, yWaist)}`,
          `C${p(waistW + 2, yWaist + 12)} ${p(hipW - 4, yHip - 12)} ${p(hipW, yHip)}`,
          `C${p(hipW - 1, yHip + 16)} ${p(hipW - 8, yThigh)} ${p(hipW - 11, yBottom)}`,
          `L${q(hipW - 11, yBottom)}`,
          `C${q(hipW - 8, yThigh)} ${q(hipW - 1, yHip + 16)} ${q(hipW, yHip)}`,
          `C${q(hipW - 4, yHip - 12)} ${q(waistW + 2, yWaist + 12)} ${q(waistW, yWaist)}`,
          `C${q(ribW, yRib)} ${q(ribW, yBust + 9)} ${q(bustW, yBust)}`,
          `C${q(bustW, yBust - 8)} ${q(bustW, yNeck + 16)} ${q(bustW - 6, yNeck)}`,
          'Z'
        ].join(' ')}
      />

      {/* braços (indicam a largura real do tronco) */}
      <path
        d={`M${p(bustW + 4, yNeck + 14)} C${p(bustW + 9, yBust + 6)} ${p(bustW + 4, yWaist + 4)} ${p(waistW + 6, yHip - 4)}`}
        opacity=".45"
      />
      <path
        d={`M${q(bustW + 4, yNeck + 14)} C${q(bustW + 9, yBust + 6)} ${q(bustW + 4, yWaist + 4)} ${q(waistW + 6, yHip - 4)}`}
        opacity=".45"
      />

      {/* linhas de medida */}
      <g opacity=".9">
        <path d={`M${cx - half(bustW) - 6} ${yBust} H${cx + half(bustW) + 6}`} strokeDasharray="3 3" />
        <circle cx={cx - half(bustW) - 6} cy={yBust} r="1.8" fill="currentColor" stroke="none" />
        <circle cx={cx + half(bustW) + 6} cy={yBust} r="1.8" fill="currentColor" stroke="none" />

        <path d={`M${cx - half(waistW) - 6} ${yWaist} H${cx + half(waistW) + 6}`} strokeDasharray="3 3" />
        <circle cx={cx - half(waistW) - 6} cy={yWaist} r="1.8" fill="currentColor" stroke="none" />
        <circle cx={cx + half(waistW) + 6} cy={yWaist} r="1.8" fill="currentColor" stroke="none" />

        <path d={`M${cx - half(hipW) - 6} ${yHip} H${cx + half(hipW) + 6}`} strokeDasharray="3 3" />
        <circle cx={cx - half(hipW) - 6} cy={yHip} r="1.8" fill="currentColor" stroke="none" />
        <circle cx={cx + half(hipW) + 6} cy={yHip} r="1.8" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
};

/** Três manequins com caimentos diferentes (justo / padrão / fluido). */
export const FitPreferenceGlyph: React.FC<{ variant: 'justo' | 'padrao' | 'solto'; className?: string }> = ({
  variant,
  className
}) => {
  const spread = variant === 'justo' ? 4 : variant === 'padrao' ? 9 : 14;
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <circle cx="24" cy="10" r="4.2" />
      <path d={`M24 14.5v3`} />
      <path
        d={`M${24 - 8} 20 C${24 - 8 - spread / 2} 26 ${24 - 4 - spread / 2} 32 ${24 - 5 - spread / 2} 40 H${24 + 5 + spread / 2} C${24 + 4 + spread / 2} 32 ${24 + 8 + spread / 2} 26 ${24 + 8} 20`}
      />
      <path d="M18.5 24h11" opacity=".45" strokeDasharray="2 2" />
    </svg>
  );
};

/** Metro/reguinha decorativa. */
export const IconRulerScale: React.FC<IconProps> = (props) => (
  <svg {...base(props)}>
    <rect x="2.4" y="8.4" width="19.2" height="7.2" rx="1.8" />
    <path d="M6.6 8.4v3M10.5 8.4v4.4M14.4 8.4v3M18.3 8.4v4.4" opacity=".6" />
  </svg>
);

/** Estrela de quatro pontas (curadoria). */
export const IconSparkle: React.FC<IconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M12 3.2c.6 3.6 1.6 5.2 5.2 6.4 1.4.4 2.2.8 2.6 1.5-.4.7-1.2 1.1-2.6 1.5-3.6 1.2-4.6 2.8-5.2 6.4-.6-3.6-1.6-5.2-5.2-6.4-1.4-.4-2.2-.8-2.6-1.5.4-.7 1.2-1.1 2.6-1.5 3.6-1.2 4.6-2.8 5.2-6.4Z" />
  </svg>
);

/** Ilustrações de como medir (traço minimalista, sem fotos). */
export const MeasureIllustration: React.FC<{
  area: 'busto' | 'cintura' | 'quadril';
  className?: string;
}> = ({ area, className }) => {
  const tape = {
    busto: { y: 70, half: 18 },
    cintura: { y: 86, half: 15 },
    quadril: { y: 98, half: 19 }
  }[area];

  return (
    <svg
      viewBox="0 0 100 170"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* cabeça e pescoço */}
      <circle cx="50" cy="26" r="9.5" />
      <path d="M46 35.5v5M54 35.5v5" opacity=".8" />

      {/* silhueta */}
      <path
        d="M50 41c-9.5 0-16 5-17 14-1 8 1 15 2 22 1 9-2 16-4 25 5.5 3 12 4.5 19 4.5s13.5-1.5 19-4.5c-2-9-5-16-4-25 1-7 3-14 2-22-1-9-7.5-14-17-14Z"
        opacity=".45"
      />

      {/* fita métrica */}
      <path d={`M${50 - tape.half} ${tape.y}H${50 + tape.half}`} strokeWidth="2.2" />
      <path
        d={`M${50 - tape.half} ${tape.y}l4-2.6v5.2l-4-2.6ZM${50 + tape.half} ${tape.y}l-4-2.6v5.2l4-2.6Z`}
        fill="currentColor"
        stroke="none"
      />
      <rect x={50 + tape.half - 6} y={tape.y - 3.4} width="7" height="6.8" rx="1.4" strokeWidth="1.2" />
      <path d={`M${50 - tape.half + 8} ${tape.y}v-2.6M${50 - tape.half + 13} ${tape.y}v-3.4M${50 - tape.half + 18} ${tape.y}v-2.6`} strokeWidth="1" opacity=".7" />
    </svg>
  );
};
