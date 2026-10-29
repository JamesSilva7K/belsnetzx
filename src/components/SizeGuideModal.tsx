import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, CircleAlert, Info, RotateCcw, ShieldCheck, Store, TriangleAlert } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { calculateProductFit, STANDARD_MEASUREMENTS } from '../utils/fittingAlgorithm';
import type { FitStatus } from '../utils/fittingAlgorithm';
import { ModalShell, ModalStep, ModalTab } from './ui/ModalShell';
import { BodySilhouette, FitPreferenceGlyph, IconHanger, IconRulerScale, IconSilhouette, IconTapeMeasure, MeasureIllustration } from './ui/vector';

/* ------------------------------------------------------------------ *
 * Peças de interface locais
 * ------------------------------------------------------------------ */

const PRIMARY = 'var(--color-primary, #DC7898)';

const STATUS_STYLE: Record<FitStatus, { label: string; className: string }> = {
  justo: { label: 'Justo', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  ajustado: { label: 'Ajustado', className: 'bg-rose-50 text-rose-800 border-rose-200' },
  perfeito: { label: 'Perfeito', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  folgado: { label: 'Folgado', className: 'bg-sky-50 text-sky-800 border-sky-200' },
  'muito folgado': { label: 'Amplo', className: 'bg-stone-100 text-stone-700 border-stone-200' }
};

const MeasurementControl: React.FC<{
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  ticks: string[];
  accent: string;
  onChange: (value: number) => void;
}> = ({ label, hint, value, min, max, ticks, accent, onChange }) => {
  const progress = ((value - min) / (max - min)) * 100;

  return (
    <div className="rounded-2xl border border-rose-100 bg-white p-3.5 shadow-[0_2px_10px_-8px_rgba(198,99,130,0.6)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-stone-800">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
            {label}
          </p>
          <p className="mt-0.5 text-[10px] font-light text-stone-400">{hint}</p>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-rose-100 bg-rose-50/60 px-2 py-1">
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={Number.isFinite(value) ? Math.round(value) : ''}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next)) return;
              onChange(Math.min(max, Math.max(min, Math.round(next))));
            }}
            aria-label={`${label} em centímetros`}
            className="w-11 bg-transparent text-right font-mono text-[13px] font-bold text-stone-900 outline-none"
          />
          <span className="text-[10px] font-medium text-stone-400">cm</span>
        </div>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        value={Math.min(max, Math.max(min, value))}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={`Ajustar ${label}`}
        className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[var(--color-primary,#DC7898)] [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(157,60,90,0.4)]"
        style={{ background: `linear-gradient(to right, ${accent} 0%, ${accent} ${progress}%, #F5E7EB ${progress}%, #F5E7EB 100%)` }}
      />

      <div className="mt-1.5 flex justify-between font-mono text-[9px] text-stone-400">
        {ticks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </div>
  );
};

const AreaRow: React.FC<{
  label: string;
  measured: number;
  delta: number;
  inside: boolean;
  status: FitStatus;
  range: [number, number];
}> = ({ label, measured, delta, inside, status, range }) => {
  const style = STATUS_STYLE[status];
  const span = range[1] - range[0];
  const domain = span + 24;
  const bandLeft = (12 / domain) * 100;
  const markerPosition = Math.min(98, Math.max(2, ((measured - (range[0] - 12)) / domain) * 100));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-stone-700">{label}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${style.className}`}>{style.label}</span>
      </div>

      <div className="relative h-2 rounded-full bg-stone-100">
        <div
          className="absolute inset-y-0 rounded-full bg-emerald-200/80"
          style={{ left: `${bandLeft}%`, width: `${(span / domain) * 100}%` }}
        />
        <span
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${markerPosition}%`, backgroundColor: PRIMARY }}
        />
      </div>

      <p className="text-[10px] font-light text-stone-500">
        {measured} cm · faixa {range[0]}–{range[1]} cm ·{' '}
        <strong className={inside ? 'text-emerald-700' : delta > 0 ? 'text-amber-700' : 'text-sky-700'}>
          {inside
            ? 'dentro da faixa'
            : delta > 0
              ? `${delta.toFixed(1).replace('.', ',')} cm acima`
              : `${Math.abs(delta).toFixed(1).replace('.', ',')} cm abaixo`}
        </strong>
      </p>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Provador
 * ------------------------------------------------------------------ */

type Tab = 'provador' | 'tabela' | 'como_medir';

export const SizeGuideModal: React.FC = () => {
  const {
    isSizeGuideOpen,
    setIsSizeGuideOpen,
    selectedProductDetail,
    provadorTargetProduct,
    products,
    userBodyProfile,
    setUserBodyProfile,
    setAppliedSizeFromProvador
  } = useStore();

  const activeProduct = provadorTargetProduct || selectedProductDetail || null;

  const [tab, setTab] = useState<Tab>('provador');
  const [height, setHeight] = useState(userBodyProfile?.height ?? 165);
  const [weight, setWeight] = useState(userBodyProfile?.weight ?? 60);
  const [bust, setBust] = useState(userBodyProfile?.bust ?? 90);
  const [waist, setWaist] = useState(userBodyProfile?.waist ?? 72);
  const [hip, setHip] = useState(userBodyProfile?.hip ?? 98);
  const [fitPreference, setFitPreference] = useState<'justo' | 'padrao' | 'solto'>(userBodyProfile?.fitPreference ?? 'padrao');
  const [applied, setApplied] = useState(false);

  // Ao abrir, sincroniza com o perfil salvo (pode ter mudado em outra sessão)
  useEffect(() => {
    if (!isSizeGuideOpen) return;
    setTab('provador');
    setApplied(false);
    if (userBodyProfile) {
      setHeight(userBodyProfile.height);
      setWeight(userBodyProfile.weight);
      setBust(userBodyProfile.bust);
      setWaist(userBodyProfile.waist);
      setHip(userBodyProfile.hip);
      setFitPreference(userBodyProfile.fitPreference);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSizeGuideOpen]);

  // Salvamento automático das medidas (o texto "fica salvo" passa a ser verdade)
  useEffect(() => {
    if (!isSizeGuideOpen) return undefined;
    const timer = setTimeout(() => {
      setUserBodyProfile({ height, weight, bust, waist, hip, fitPreference });
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, weight, bust, waist, hip, fitPreference, isSizeGuideOpen]);

  const fit = useMemo(
    () => calculateProductFit({ height, weight, bust, waist, hip, fitPreference }, activeProduct),
    [height, weight, bust, waist, hip, fitPreference, activeProduct]
  );

  const recommendedAvailable = activeProduct ? fit.availableSizes.includes(fit.recommendedSize) : true;
  const canApply = Boolean(activeProduct) && fit.inStock && recommendedAvailable;

  const handleApply = () => {
    setUserBodyProfile({ height, weight, bust, waist, hip, fitPreference });

    if (canApply) {
      setAppliedSizeFromProvador(fit.recommendedSize);
      setApplied(true);
      setTimeout(() => {
        setApplied(false);
        setIsSizeGuideOpen(false);
      }, 1100);
      return;
    }

    // Sem peça selecionada (ou tamanho indisponível): apenas confirma o salvamento
    setApplied(true);
    setTimeout(() => setApplied(false), 1600);
  };

  const handleReset = () => {
    setHeight(165);
    setWeight(60);
    setBust(90);
    setWaist(72);
    setHip(98);
    setFitPreference('padrao');
  };

  const similarProduct = !activeProduct && products.length > 0 ? products[0] : null;

  return (
    <ModalShell
      open={isSizeGuideOpen}
      onClose={() => setIsSizeGuideOpen(false)}
      icon={<IconTapeMeasure size={22} />}
      eyebrow="Ateliê · modelagem própria"
      title="Provador Virtual & Guia de Medidas"
      subtitle={
        activeProduct
          ? `Análise de caimento para ${activeProduct.name}`
          : similarProduct
            ? 'Defina suas medidas e veja o caimento na tabela da boutique'
            : 'Defina suas medidas para receber uma recomendação'
      }
      badge={
        <span className="rounded-full border border-rose-200 bg-white/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#B65C7B]">
          Tabela Aura Rosa
        </span>
      }
      size="xl"
      tabs={
        <div className="flex gap-1.5">
          <ModalTab active={tab === 'provador'} onClick={() => setTab('provador')} icon={<IconSilhouette size={15} />}>
            Provador
          </ModalTab>
          <ModalTab active={tab === 'tabela'} onClick={() => setTab('tabela')} icon={<IconRulerScale size={15} />}>
            Tabela de medidas
          </ModalTab>
          <ModalTab active={tab === 'como_medir'} onClick={() => setTab('como_medir')} icon={<IconHanger size={15} />}>
            Como medir
          </ModalTab>
        </div>
      }
    >
      {tab === 'provador' && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* ------------------------------ Coluna esquerda ------------------------------ */}
          <div className="space-y-5 lg:col-span-7">
            {activeProduct ? (
              <div className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-gradient-to-r from-rose-50/80 to-white p-3">
                <img
                  src={activeProduct.images?.[0]}
                  alt={activeProduct.name}
                  className="h-14 w-12 rounded-xl border border-rose-100 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#B65C7B]">Peça em análise</p>
                  <p className="truncate font-serif text-sm text-stone-900">{activeProduct.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {activeProduct.sizes.map((size) => {
                      const soldOut = !Object.entries(activeProduct.inventory || {}).some(
                        ([key, value]) => key.startsWith(`${size}-`) && Number(value) > 0
                      );
                      return (
                        <span
                          key={size}
                          className={`rounded-md border px-1.5 py-0.5 font-mono text-[9px] ${
                            soldOut
                              ? 'border-stone-200 bg-stone-50 text-stone-400 line-through'
                              : size === fit.recommendedSize
                                ? 'border-[#DC7898] bg-[#DC7898] text-white'
                                : 'border-rose-200 bg-white text-stone-600'
                          }`}
                        >
                          {size}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1 rounded-full border border-rose-200 px-2.5 py-1 text-[10px] font-medium text-stone-500 transition-colors hover:border-rose-300 hover:text-stone-800"
                >
                  <RotateCcw className="h-3 w-3" /> padrão
                </button>
              </div>
            ) : null}

            <div className="space-y-3">
              <ModalStep index={1}>Suas medidas corporais</ModalStep>
              <MeasurementControl
                label="Busto"
                hint="Na parte mais saliente, com a fita na horizontal"
                value={bust}
                min={70}
                max={135}
                ticks={['70', '85', '100', '120', '135']}
                accent="#DC7898"
                onChange={setBust}
              />
              <MeasurementControl
                label="Cintura"
                hint="Na parte mais estreita do tronco, sem apertar"
                value={waist}
                min={52}
                max={125}
                ticks={['52', '70', '85', '105', '125']}
                accent="#C66382"
                onChange={setWaist}
              />
              <MeasurementControl
                label="Quadril"
                hint="Na região de maior volume, cerca de 20 cm abaixo da cintura"
                value={hip}
                min={74}
                max={145}
                ticks={['74', '95', '110', '130', '145']}
                accent="#9F4E6A"
                onChange={setHip}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-rose-100 bg-white p-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-stone-700">Altura</span>
                  <span className="font-mono font-bold text-stone-900">{height} cm</span>
                </div>
                <input
                  type="range"
                  min={140}
                  max={205}
                  value={height}
                  onChange={(event) => setHeight(Number(event.target.value))}
                  aria-label="Altura"
                  className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-rose-100 outline-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#DC7898] [&::-webkit-slider-thumb]:shadow"
                />
              </div>
              <div className="rounded-2xl border border-rose-100 bg-white p-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-stone-700">Peso</span>
                  <span className="font-mono font-bold text-stone-900">{weight} kg</span>
                </div>
                <input
                  type="range"
                  min={35}
                  max={160}
                  value={weight}
                  onChange={(event) => setWeight(Number(event.target.value))}
                  aria-label="Peso"
                  className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-rose-100 outline-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#DC7898] [&::-webkit-slider-thumb]:shadow"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <ModalStep index={2}>Como você prefere o caimento?</ModalStep>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'justo', title: 'Justo', hint: 'Acinturado', variant: 'justo' as const },
                  { key: 'padrao', title: 'Padrão', hint: 'Elegante', variant: 'padrao' as const },
                  { key: 'solto', title: 'Fluido', hint: 'Esvoaçante', variant: 'solto' as const }
                ] as const).map((option) => {
                  const active = fitPreference === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setFitPreference(option.key)}
                      aria-pressed={active}
                      className={`rounded-2xl border p-2.5 text-center transition-all ${
                        active
                          ? 'border-[#DC7898] bg-rose-50/80 shadow-[0_6px_18px_-12px_rgba(198,99,130,0.9)]'
                          : 'border-stone-200 bg-white hover:border-rose-200'
                      }`}
                    >
                      <FitPreferenceGlyph variant={option.variant} className={`mx-auto h-9 w-9 ${active ? 'text-[#C66382]' : 'text-stone-400'}`} />
                      <span className="mt-1 block text-[11px] font-semibold text-stone-800">{option.title}</span>
                      <span className={`block text-[9px] ${active ? 'font-semibold text-[#B65C7B]' : 'text-stone-400'}`}>{option.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ------------------------------ Coluna direita ------------------------------ */}
          <div className="space-y-4 lg:col-span-5">
            <div
              className="relative overflow-hidden rounded-3xl p-5 text-white shadow-[0_20px_60px_-25px_rgba(120,35,60,0.85)]"
              style={{ backgroundImage: 'linear-gradient(155deg, #D97C97 0%, #B85B79 48%, #7A324C 100%)' }}
            >
              <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/85">Tamanho recomendado</span>
                  <span className="rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[9px] font-bold backdrop-blur-sm">
                    {fit.insideCount} de 3 medidas na faixa
                  </span>
                </div>

                <div className="mt-2 flex items-end gap-3">
                  <span className="font-serif text-[52px] leading-none drop-shadow-sm">{fit.recommendedSize}</span>
                  <div className="pb-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-white/75">manequim BR</p>
                    <p className="font-mono text-sm font-semibold text-white">{fit.numericSize}</p>
                  </div>
                </div>

                <p className="mt-1.5 text-[11px] font-semibold text-white">{fit.overallFitLabel}</p>
                <p className="mt-2 border-t border-white/25 pt-2 text-[10.5px] font-light leading-relaxed text-white/90">{fit.summary}</p>

                {fit.alternativeSize ? (
                  <p className="mt-1.5 text-[10px] font-light text-white/80">
                    Alternativa: <strong className="font-semibold text-white">{fit.alternativeSize}</strong> para outra intenção de caimento.
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={handleApply}
                  disabled={Boolean(activeProduct) && !canApply}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[#7A324C] shadow-lg transition-all hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {applied ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> {canApply ? 'Tamanho aplicado' : 'Medidas salvas'}
                    </>
                  ) : activeProduct && !canApply ? (
                    <>
                      <TriangleAlert className="h-3.5 w-3.5" />
                      {fit.inStock ? 'Tamanho indisponível' : 'Sem estoque neste tamanho'}
                    </>
                  ) : (
                    <>
                      {activeProduct ? `Aplicar tamanho ${fit.recommendedSize}` : 'Salvar minhas medidas'}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>

                {!activeProduct ? (
                  <p className="mt-2 text-center text-[9px] text-white/75">Abra uma peça para aplicar o tamanho direto na sacola.</p>
                ) : null}

                {activeProduct && !activeProduct.sizes.includes(fit.recommendedSize) && !/único/i.test(activeProduct.sizes.join(' ')) ? (
                  <p className="mt-2 text-center text-[9px] text-white/75">Peça limitada aos tamanhos disponíveis nesta coleção.</p>
                ) : null}
              </div>
            </div>

            {/* Silhueta proporcional */}
            <div className="rounded-3xl border border-rose-100 bg-white p-4">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">Sua proporção</p>
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-semibold text-[#B65C7B]">{fit.bodyType}</span>
              </div>
              <BodySilhouette bust={bust} waist={waist} hip={hip} className="mx-auto h-52 w-auto text-[#C66382]" />
              <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                {[
                  { label: 'Busto', value: bust },
                  { label: 'Cintura', value: waist },
                  { label: 'Quadril', value: hip }
                ].map((entry) => (
                  <div key={entry.label}>
                    <p className="font-mono text-[11px] font-bold text-stone-800">{entry.value}</p>
                    <p className="text-[8px] uppercase tracking-wider text-stone-400">{entry.label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-center text-[9px] font-light leading-relaxed text-stone-500">{fit.bodyTypeNote}</p>
            </div>

            {/* Caimento por região */}
            <div className="rounded-3xl border border-rose-100 bg-white p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">Caimento no tamanho {fit.recommendedSize}</p>
              <div className="space-y-3">
                <AreaRow
                  label="Busto"
                  measured={bust}
                  delta={fit.areas.bust.delta}
                  inside={fit.areas.bust.inside}
                  status={fit.areas.bust.status}
                  range={[fit.areas.bust.garmentMin, fit.areas.bust.garmentMax]}
                />
                <AreaRow
                  label="Cintura"
                  measured={waist}
                  delta={fit.areas.waist.delta}
                  inside={fit.areas.waist.inside}
                  status={fit.areas.waist.status}
                  range={[fit.areas.waist.garmentMin, fit.areas.waist.garmentMax]}
                />
                <AreaRow
                  label="Quadril"
                  measured={hip}
                  delta={fit.areas.hip.delta}
                  inside={fit.areas.hip.inside}
                  status={fit.areas.hip.status}
                  range={[fit.areas.hip.garmentMin, fit.areas.hip.garmentMax]}
                />
              </div>
              <p className="mt-2.5 flex items-start gap-1 text-[9px] font-light leading-relaxed text-stone-400">
                <Info className="mt-px h-2.5 w-2.5 flex-shrink-0" />
                A faixa verde é a medida corporal que a tabela aceita para este tamanho. Fora dela, a peça marca ou sobra.
              </p>
            </div>

            {fit.warnings.length > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  <CircleAlert className="h-3 w-3" /> Pontos de atenção
                </p>
                <ul className="mt-1.5 space-y-1">
                  {fit.warnings.slice(0, 4).map((warning) => (
                    <li key={warning} className="flex gap-1.5 text-[10px] font-light leading-relaxed text-amber-900">
                      <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-amber-500" />
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50/50 p-3 text-[10px] font-light leading-relaxed text-stone-600">
              <ShieldCheck className="h-4 w-4 flex-shrink-0 text-[#C66382]" />
              <span>
                Recomendação baseada na tabela de modelagem da boutique e nas medidas que você informar. Em dúvida entre dois tamanhos, fale com o atelier.
              </span>
            </div>
          </div>
        </div>
      )}

      {tab === 'tabela' && (
        <div className="space-y-4">
          <div>
            <h3 className="font-serif text-lg text-stone-900">Tabela de modelagem Aura Rosa</h3>
            <p className="mt-0.5 text-[11px] font-light text-stone-500">
              Faixas corporais de referência em centímetros. A linha destacada é o tamanho calculado para as suas medidas.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-rose-100">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-rose-50/80 text-[9px] uppercase tracking-wider text-[#8E4460]">
                <tr>
                  <th className="px-3 py-2.5 font-bold">Tamanho</th>
                  <th className="px-3 py-2.5 font-bold">BR</th>
                  <th className="px-3 py-2.5 font-bold">Busto</th>
                  <th className="px-3 py-2.5 font-bold">Cintura</th>
                  <th className="px-3 py-2.5 font-bold">Quadril</th>
                  <th className="px-3 py-2.5 font-bold">Nesta peça</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-50">
                {Object.entries(STANDARD_MEASUREMENTS).map(([key, data]) => {
                  const isRecommended = fit.recommendedSize === key || fit.recommendedSize === data.number;
                  const sold = !activeProduct || activeProduct.sizes.includes(key) || activeProduct.sizes.includes(data.number);
                  return (
                    <tr key={key} className={isRecommended ? 'bg-rose-50/70' : 'bg-white'}>
                      <td className="px-3 py-2.5">
                        <span className={`font-bold ${isRecommended ? 'text-[#B65C7B]' : 'text-stone-700'}`}>{key}</span>
                        {isRecommended ? <span className="ml-1.5 rounded-full bg-[#DC7898] px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">seu</span> : null}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-stone-500">{data.number}</td>
                      <td className="px-3 py-2.5 text-stone-600">{data.minBust}–{data.maxBust}</td>
                      <td className="px-3 py-2.5 text-stone-600">{data.minWaist}–{data.maxWaist}</td>
                      <td className="px-3 py-2.5 text-stone-600">{data.minHip}–{data.maxHip}</td>
                      <td className="px-3 py-2.5">
                        {!activeProduct ? (
                          <span className="text-[9px] font-medium text-stone-400">selecione uma peça</span>
                        ) : sold ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                            <Store className="h-2.5 w-2.5" /> disponível
                          </span>
                        ) : (
                          <span className="text-[9px] font-medium text-stone-400">não vendido</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-3.5 text-[10.5px] font-light leading-relaxed text-stone-600">
            <strong className="font-semibold text-stone-800">Tecidos sem elastano</strong> (linho, crepe, alfaiataria) pedem o tamanho maior quando suas
            medidas ficam entre duas faixas. Malhas caneladas e tricots acomodam até 3 cm a menos sem marcar.
          </div>
        </div>
      )}

      {tab === 'como_medir' && (
        <div className="space-y-5">
          <div className="text-center">
            <h3 className="font-serif text-xl text-stone-900">Como tirar suas medidas</h3>
            <p className="mx-auto mt-1 max-w-md text-[11px] font-light text-stone-500">
              Use fita métrica maleável, roupa justa e fique relaxada. A fita deve ficar rente ao corpo, sem apertar.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {([
              { area: 'busto', title: 'Busto', text: 'Passe a fita na parte mais saliente do busto, contornando as costas na mesma altura.' },
              { area: 'cintura', title: 'Cintura', text: 'Meça a parte mais estreita do tronco, cerca de dois dedos acima do umbigo.' },
              { area: 'quadril', title: 'Quadril', text: 'Com os pés juntos, contorne a região de maior volume do quadril.' }
            ] as const).map((step, index) => (
              <div key={step.area} className="rounded-2xl border border-rose-100 bg-white p-4 text-center">
                <div className="mb-2 flex items-center justify-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 font-mono text-[10px] font-bold text-[#B65C7B]">
                    {index + 1}
                  </span>
                  <span className="text-[11px] font-semibold text-stone-800">{step.title}</span>
                </div>
                <div className="mx-auto mb-2 flex h-40 w-full items-center justify-center rounded-xl bg-gradient-to-b from-rose-50/70 to-white">
                  <MeasureIllustration area={step.area} className="h-36 w-auto text-[#C66382]" />
                </div>
                <p className="mt-1 text-[10px] font-light leading-relaxed text-stone-500">{step.text}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5">
            <span className="text-[10.5px] font-light text-emerald-900">Suas medidas são salvas automaticamente neste dispositivo.</span>
            <button
              type="button"
              onClick={() => setTab('provador')}
              className="rounded-full bg-emerald-700 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-emerald-800"
            >
              Testar no provador
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
};
