import type { Product, UserBodyProfile } from '../types';

/**
 * Motor de caimento da Aura Rosa
 * -------------------------------------------------
 * Regras determinísticas, sem "precisão" inventada:
 *  1. valida e normaliza as medidas;
 *  2. considera APENAS os tamanhos que a peça realmente vende;
 *  3. pontua cada tamanho pela distância às faixas corporais da tabela,
 *     ponderada pela categoria da peça;
 *  4. descreve o caimento por região (folga em cm);
 *  5. aponta inconsistências e tamanhos esgotados em vez de esconder.
 */

export type FitStatus = 'justo' | 'ajustado' | 'perfeito' | 'folgado' | 'muito folgado';

export interface AreaFit {
  key: 'bust' | 'waist' | 'hip';
  label: string;
  measured: number;
  garmentMin: number;
  garmentMax: number;
  ease: number;
  /** Positivo = corpo acima do limite superior da faixa; negativo = abaixo do inferior. */
  delta: number;
  inside: boolean;
  status: FitStatus;
  note: string;
}

export interface FitAnalysisResult {
  recommendedSize: string;
  numericSize: string;
  alternativeSize?: string;
  availableSizes: string[];
  inStock: boolean;
  adherence: number;
  insideCount: number;
  adherenceLabel: string;
  bodyType: string;
  bodyTypeNote: string;
  overallFitLabel: string;
  summary: string;
  explanation: string;
  areas: Record<'bust' | 'waist' | 'hip', AreaFit>;
  warnings: string[];
  bmi: number | null;
  garment: { bust: number; waist: number; hip: number; length: number } | null;
  confidence: number; // compatibilidade: espelha `adherence`
  bustFit: FitStatus;
  waistFit: FitStatus;
  hipFit: FitStatus;
  garmentDimensions: { bust: number; waist: number; hip: number; length: number };
}

type SizeKey = 'PP' | 'P' | 'M' | 'G' | 'GG';

export const STANDARD_MEASUREMENTS: Record<
  SizeKey,
  { minBust: number; maxBust: number; minWaist: number; maxWaist: number; minHip: number; maxHip: number; number: string }
> = {
  PP: { minBust: 78, maxBust: 84, minWaist: 60, maxWaist: 66, minHip: 86, maxHip: 92, number: '36' },
  P: { minBust: 85, maxBust: 90, minWaist: 67, maxWaist: 72, minHip: 93, maxHip: 98, number: '38' },
  M: { minBust: 91, maxBust: 96, minWaist: 73, maxWaist: 78, minHip: 99, maxHip: 104, number: '40' },
  G: { minBust: 97, maxBust: 104, minWaist: 79, maxWaist: 86, minHip: 105, maxHip: 112, number: '42' },
  GG: { minBust: 105, maxBust: 114, minWaist: 87, maxWaist: 96, minHip: 113, maxHip: 122, number: '44' }
};

const SIZE_KEYS: SizeKey[] = ['PP', 'P', 'M', 'G', 'GG'];

/** Categorias com tecido elástico toleram um caimento mais justo. */
const ELASTIC_HINTS = ['elastano', 'malha', 'ribana', 'canelad', 'tricot', 'lycra'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function sanitize(value: number, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return clamp(Math.round(parsed), min, max);
}

function normalizeSizeLabel(raw: string): SizeKey | null {
  const value = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (['PP', 'P', 'M', 'G', 'GG'].includes(value)) return value as SizeKey;
  const numeric = Object.entries(STANDARD_MEASUREMENTS).find(([, data]) => data.number === value);
  return numeric ? (numeric[0] as SizeKey) : null;
}

function distanceToRange(value: number, min: number, max: number) {
  if (value < min) return min - value;
  if (value > max) return value - max;
  return 0;
}

/** Peso de cada região de acordo com a modelagem da categoria. */
function categoryWeights(category?: string) {
  switch (category) {
    case 'Vestidos':
      return { bust: 1.3, waist: 1.2, hip: 0.8 };
    case 'Alfaiataria':
      return { bust: 1.35, waist: 1.35, hip: 0.6 };
    case 'Saias':
      return { bust: 0.1, waist: 1.6, hip: 1.2 };
    case 'Calças & Jeans':
      return { bust: 0.15, waist: 1.4, hip: 1.3 };
    case 'Blusas & Camisas':
      return { bust: 1.5, waist: 0.9, hip: 0.2 };
    case 'Conjuntos':
      return { bust: 1.2, waist: 1.2, hip: 1.1 };
    default:
      return { bust: 1, waist: 1, hip: 1 };
  }
}

/** Classifica uma região comparando a medida com a faixa corporal do tamanho. */
function classifyArea(measured: number, min: number, max: number): { status: FitStatus; delta: number; inside: boolean } {
  if (measured > max) {
    const delta = measured - max;
    return { status: delta <= 2 ? 'ajustado' : 'justo', delta, inside: false };
  }
  if (measured < min) {
    const gap = min - measured;
    return { status: gap <= 3 ? 'ajustado' : gap <= 7 ? 'folgado' : 'muito folgado', delta: measured - min, inside: false };
  }
  return { status: 'perfeito', delta: 0, inside: true };
}

function areaNote(area: string, status: FitStatus, delta: number): string {
  if (status === 'perfeito') return `Dentro da faixa da tabela para ${area}.`;
  if (delta > 0) return `${delta.toFixed(1).replace('.', ',')} cm acima do limite — a peça marca ${area}.`;
  return `${Math.abs(delta).toFixed(1).replace('.', ',')} cm abaixo do limite — sobra folga em ${area}.`;
}

function bodyTypeFor(bust: number, waist: number, hip: number) {
  const bustHip = Math.abs(bust - hip);
  if (bustHip <= 5 && hip - waist >= 18) {
    return {
      type: 'Ampulheta',
      note: 'Ombros e quadril equilibrados com cintura marcada — peças acinturadas valorizam a silhueta.'
    };
  }
  if (hip - bust > 5) {
    return {
      type: 'Triângulo (pêra)',
      note: 'Quadril mais largo que o busto — saias fluidas e decotes estruturados equilibram a proporção.'
    };
  }
  if (bust - hip > 5) {
    return {
      type: 'Triângulo invertido',
      note: 'Busto/ombros mais largos que o quadril — modelagens evasê criam equilíbrio.'
    };
  }
  return {
    type: 'Retângulo',
    note: 'Medidas próximas entre busto, cintura e quadril — cintos e recortes criam definição.'
  };
}

export function calculateProductFit(profile: UserBodyProfile, product?: Product | null): FitAnalysisResult {
  const warnings: string[] = [];

  const bust = sanitize(profile?.bust, 70, 135, 90);
  const waist = sanitize(profile?.waist, 52, 125, 72);
  const hip = sanitize(profile?.hip, 74, 145, 98);
  const height = sanitize(profile?.height, 140, 205, 165);
  const weight = sanitize(profile?.weight, 35, 160, 60);
  const fitPreference = profile?.fitPreference || 'padrao';

  if (waist >= bust - 2) warnings.push('A cintura informada é próxima ou maior que o busto. Confira a fita na parte mais estreita do tronco.');
  if (waist >= hip - 4) warnings.push('A cintura informada está muito próxima do quadril. Revise a medida da cintura.');
  if (bust - waist < 6) warnings.push('A diferença entre busto e cintura é pequena — pode ser uma modelagem reta; o caimento ainda é calculado pela tabela.');

  const bmiRaw = weight / (height / 100) ** 2;
  const bmi = Number.isFinite(bmiRaw) ? Number(bmiRaw.toFixed(1)) : null;
  if (bmi && (bmi < 17 || bmi > 35)) {
    warnings.push('Altura e peso estão fora da faixa usual da tabela; se possível, refaça as medidas com fita métrica para maior segurança.');
  }

  const offset = fitPreference === 'justo' ? -2 : fitPreference === 'solto' ? 3 : 0;
  const targetBust = Math.round(bust + offset);
  const targetWaist = Math.round(waist + offset);
  const targetHip = Math.round(hip + offset);

  const elastic = ELASTIC_HINTS.some((hint) => `${product?.fabric || ''} ${product?.name || ''}`.toLowerCase().includes(hint));
  const weights = categoryWeights(product?.category);
  const bodyType = bodyTypeFor(bust, waist, hip);

  /* ------------------- Peça tamanho único (elástica) ------------------- */
  const oneSize = product?.sizes?.find((size) => /único|unico|onesize|one size|ÚNICO/i.test(size));
  if (oneSize) {
    const areaFor = (key: 'bust' | 'waist' | 'hip', label: string, measured: number, min: number, max: number): AreaFit => {
      const classification = classifyArea(measured, min, max);
      return {
        key,
        label,
        measured,
        garmentMin: min,
        garmentMax: max,
        ease: Number(((min + max) / 2 - measured).toFixed(1)),
        ...classification,
        note: areaNote(label.toLowerCase(), classification.status, classification.delta)
      };
    };
    const areas = {
      bust: areaFor('bust', 'Busto', bust, 78, 108),
      waist: areaFor('waist', 'Cintura', waist, 60, 100),
      hip: areaFor('hip', 'Quadril', hip, 86, 122)
    };
    const insideCount = Object.values(areas).filter((entry) => entry.inside).length;
    const adherence = Math.round((insideCount / 3) * 100);
    const tense = Object.values(areas).filter((entry) => entry.status === 'justo' || entry.status === 'ajustado').length;
    const garment = { bust: 92, waist: 74, hip: 100, length: product?.category === 'Vestidos' ? 128 : 62 };
    if (tense > 0) warnings.push('Esta peça única é elástica, mas o seu quadril/busto fica no limite da maleabilidade — vale confirmar o caimento com o atelier.');

    return {
      recommendedSize: oneSize,
      numericSize: 'Único',
      availableSizes: product?.sizes || [oneSize],
      inStock: Number(product?.totalStock ?? 1) > 0,
      adherence,
      insideCount,
      adherenceLabel: insideCount === 3 ? 'Todas as medidas na faixa' : `${insideCount} de 3 medidas na faixa`,
      bodyType: bodyType.type,
      bodyTypeNote: bodyType.note,
      overallFitLabel: tense ? 'Ajustado ao corpo pelo elastano' : 'Abraça o corpo com conforto',
      summary: `Tamanho único com elastano: veste ${bust} cm de busto, ${waist} cm de cintura e ${hip} cm de quadril.`,
      explanation: 'A modelagem em malha elástica acompanha o corpo sem marcações. Por ser única, não há variação de numeração.',
      areas,
      warnings,
      bmi,
      garment,
      confidence: adherence,
      bustFit: areas.bust.status,
      waistFit: areas.waist.status,
      hipFit: areas.hip.status,
      garmentDimensions: garment
    };
  }

  /* --------------------- Tamanhos realmente vendidos --------------------- */
  const productSizes = product?.sizes?.length ? product.sizes : SIZE_KEYS;
  const soldKeys = productSizes
    .map((size) => normalizeSizeLabel(size))
    .filter((key): key is SizeKey => Boolean(key));

  const availableSizes = productSizes.filter((size) => soldKeys.includes(normalizeSizeLabel(size) as SizeKey));
  const candidateKeys = soldKeys.length ? soldKeys : SIZE_KEYS;
  const constrainedByProduct = Boolean(product?.sizes?.length) && soldKeys.length > 0;

  if (product?.sizes?.length && soldKeys.length === 0) {
    warnings.push('As opções desta peça não seguem a tabela padrão (PP–GG). A recomendação usa a tabela de referência.');
  }

  /* ----------------------------- Pontuação ----------------------------- */
  const scored = candidateKeys.map((key) => {
    const data = STANDARD_MEASUREMENTS[key];
    const score =
      distanceToRange(targetBust, data.minBust, data.maxBust) * weights.bust +
      distanceToRange(targetWaist, data.minWaist, data.maxWaist) * weights.waist +
      distanceToRange(targetHip, data.minHip, data.maxHip) * weights.hip;

    const inside = [
      bust >= data.minBust && bust <= data.maxBust,
      waist >= data.minWaist && waist <= data.maxWaist,
      hip >= data.minHip && hip <= data.maxHip
    ].filter(Boolean).length;

    return { key, data, score, inside };
  });

  scored.sort((a, b) => {
    if (Math.abs(a.score - b.score) < 0.6) {
      // empate técnico: respeita a preferência de caimento
      const order = SIZE_KEYS.indexOf(a.key) - SIZE_KEYS.indexOf(b.key);
      return fitPreference === 'solto' ? -order : order;
    }
    return a.score - b.score;
  });

  const best = scored[0];
  const numericPreferred = Boolean(product?.sizes?.some((size) => /^\d{2}$/.test(size)));
  const labelFor = (key: SizeKey) => (numericPreferred ? STANDARD_MEASUREMENTS[key].number : key);
  const recommendedSize = labelFor(best.key);

  /* ------------------------- Alternativa próxima ------------------------- */
  const alternatives = scored.slice(1);
  const alternative = alternatives.find((entry) => SIZE_KEYS.indexOf(entry.key) > SIZE_KEYS.indexOf(best.key)) || alternatives[0];
  const alternativeSize = alternative ? labelFor(alternative.key) : undefined;

  const lowStock = scored.length === 1 && !constrainedByProduct;
  if (lowStock) warnings.push('A peça possui poucas opções de tamanho — a recomendação considera a tabela padrão.');

  /* ------------------------------ Estoque ------------------------------ */
  const inventory = product?.inventory || {};
  const hasStock = (sizeLabel: string) =>
    Object.entries(inventory).some(([key, value]) => key.startsWith(`${sizeLabel}-`) && Number(value) > 0);
  const inStock = product ? hasStock(recommendedSize) : false;

  if (product && !inStock) {
    const alternativeInStock = availableSizes.find((size) => hasStock(size) && size !== recommendedSize);
    if (alternativeInStock) warnings.push(`O tamanho ${recommendedSize} está esgotado; o ${alternativeInStock} está disponível.`);
    else warnings.push('Nenhum tamanho desta peça está disponível neste momento.');
  }

  if (constrainedByProduct && !availableSizes.includes(recommendedSize) && !numericPreferred) {
    warnings.push(`O tamanho ${recommendedSize} não é vendido nesta peça — a recomendação foi limitada às opções disponíveis.`);
  }

  /* ----------------------------- Regiões ----------------------------- */
  const area = (
    key: 'bust' | 'waist' | 'hip',
    label: string,
    measured: number,
    min: number,
    max: number
  ): AreaFit => {
    const classification = classifyArea(measured, min, max);
    return {
      key,
      label,
      measured,
      garmentMin: min,
      garmentMax: max,
      ease: Number(((min + max) / 2 - measured).toFixed(1)),
      ...classification,
      note: areaNote(label.toLowerCase(), classification.status, classification.delta)
    };
  };

  const areas = {
    bust: area('bust', 'Busto', bust, best.data.minBust, best.data.maxBust),
    waist: area('waist', 'Cintura', waist, best.data.minWaist, best.data.maxWaist),
    hip: area('hip', 'Quadril', hip, best.data.minHip, best.data.maxHip)
  };

  Object.values(areas)
    .filter((entry) => entry.status === 'justo')
    .forEach((entry) =>
      warnings.push(
        `${entry.label}: ${entry.delta.toFixed(1).replace('.', ',')} cm acima da faixa do tamanho ${recommendedSize} — considere o tamanho acima.`
      )
    );

  /* --------------------------- Aderência real --------------------------- */
  const insideCount = [areas.bust, areas.waist, areas.hip].filter((entry) => entry.inside).length;
  const adherence = Math.round((insideCount / 3) * 100);
  const adherenceLabel =
    insideCount === 3
      ? 'Todas as medidas dentro da faixa'
      : insideCount === 2
        ? 'Duas medidas dentro da faixa'
        : insideCount === 1
          ? 'Uma medida dentro da faixa'
          : 'Nenhuma medida dentro da faixa';

  /* ----------------------------- Comprimento ----------------------------- */
  const lengthMap: Record<string, number> = {
    Vestidos: 138,
    Saias: 78,
    'Calças & Jeans': 102,
    Alfaiataria: 100,
    'Blusas & Camisas': 62,
    Tricots: 64,
    Conjuntos: 70
  };
  const baseLength = lengthMap[product?.category || ''] ?? 70;
  const lengthAdjust = Math.round((height - 165) * 0.28);
  const length = clamp(baseLength + lengthAdjust, 40, 155);
  if (height >= 178 && product?.category === 'Vestidos') {
    warnings.push('Com 1,78 m ou mais, o comprimento do vestido tende a ficar acima do tornozelo.');
  }

  const garment = {
    bust: Math.round((best.data.minBust + best.data.maxBust) / 2 + (elastic ? 1 : 3)),
    waist: Math.round((best.data.minWaist + best.data.maxWaist) / 2 + (elastic ? 1 : 2)),
    hip: Math.round((best.data.minHip + best.data.maxHip) / 2 + (elastic ? 1 : 4)),
    length
  };

  /* ------------------------------ Resumo ------------------------------ */
  const tense = [areas.bust, areas.waist, areas.hip].filter((entry) => entry.status === 'justo').length;
  const loose = [areas.bust, areas.waist, areas.hip].filter((entry) => entry.status === 'folgado' || entry.status === 'muito folgado').length;

  let overallFitLabel = 'Caimento equilibrado';
  if (tense > 0) overallFitLabel = 'Modelagem mais ajustada ao corpo';
  else if (loose >= 2) overallFitLabel = 'Modelagem fluida e esvoaçante';

  const summary = `Tamanho ${recommendedSize} para ${bust} cm de busto, ${waist} cm de cintura e ${hip} cm de quadril.`;

  const parts = [
    `Seu corpo foi classificado como ${bodyType.type.toLowerCase()} e a tabela indica o tamanho ${recommendedSize} (${STANDARD_MEASUREMENTS[best.key].number}).`,
    `${insideCount} de 3 medidas estão dentro da faixa corporal deste tamanho.`,
    areas.bust.inside ? 'O busto assenta na faixa.' : `No busto, ${areas.bust.note.charAt(0).toLowerCase()}${areas.bust.note.slice(1)}`,
    areas.waist.inside ? 'A cintura assenta na faixa.' : `Na cintura, ${areas.waist.note.charAt(0).toLowerCase()}${areas.waist.note.slice(1)}`,
    areas.hip.inside ? 'O quadril assenta na faixa.' : `No quadril, ${areas.hip.note.charAt(0).toLowerCase()}${areas.hip.note.slice(1)}`
  ];
  if (product?.fabric) parts.push(`Tecido: ${product.fabric.split('(')[0].trim()}.`);
  if (fitPreference !== 'padrao') {
    parts.push(fitPreference === 'justo' ? 'Você prefere caimento justo, então priorizamos a modelagem mais rente.' : 'Você prefere caimento fluido, então a recomendação já considera um pouco mais de folga.');
  }

  return {
    recommendedSize,
    numericSize: STANDARD_MEASUREMENTS[best.key].number,
    alternativeSize,
    availableSizes,
    inStock,
    adherence,
    insideCount,
    adherenceLabel,
    bodyType: bodyType.type,
    bodyTypeNote: bodyType.note,
    overallFitLabel,
    summary,
    explanation: parts.join(' '),
    areas,
    warnings,
    bmi,
    garment,
    confidence: adherence,
    bustFit: areas.bust.status,
    waistFit: areas.waist.status,
    hipFit: areas.hip.status,
    garmentDimensions: garment
  };
}
