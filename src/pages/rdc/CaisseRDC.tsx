/**
 * ÉCRAN 3/5 — Caisse "en un écran" (brief RDC 3.3)
 * - actes cochés, totaux FC + USD simultanés (taux paramétrable) ;
 * - mutuelle : % de couverture -> part prise en charge + ticket
 *   modérateur (brief RDC 1.3) ;
 * - boutons rapides : Payé totalité / Acompte / Exonéré /
 *   Urgence vitale (motif OBLIGATOIRE + badge "Prise en charge
 *   autorisée" — arrêté n°1250/2025, paiement différé tracé) ;
 * - reçu imprimable immédiatement (Arial, A4).
 */

import { useEffect, useMemo, useState } from 'react';
import { Button, InputNumber, Modal, message } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './rdc.module.scss';
import { EnTeteRDC, ModalApercu, MoneyDual, RecherchePatient } from './components';
import { useRdcState, registerMouvement } from './data/rdcStore';
import { formatFc, getTaux, setTaux, usdToFc } from './data/money';
import type { ModePaiement, ModeRecouvrement, MouvementCaisse, Patient } from './data/types';
import { RecuFacture } from './printDocuments';

const UTILISATEUR_DEFAUT = 'Caissier de service';

export default function CaisseRDC() {
  const navigate = useNavigate();
  const state = useRdcState();
  const [searchParams, setSearchParams] = useSearchParams();
  const patientId = searchParams.get('patient');

  const [taux, setTauxLocal] = useState<number>(() => getTaux());
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const [appliquerMutuelle, setAppliquerMutuelle] = useState(true);

  // Modal acompte
  const [acompteOuvert, setAcompteOuvert] = useState(false);
  const [montantAcompte, setMontantAcompte] = useState<number>(0);
  const [modePaiement, setModePaiement] = useState<ModePaiement>('especes_fc');

  // Modal exception (exonéré / urgence vitale)
  const [exceptionMode, setExceptionMode] = useState<Extract<ModeRecouvrement, 'exonere' | 'urgence_vitale'> | null>(null);
  const [motifException, setMotifException] = useState('');
  const [autorisePar, setAutorisePar] = useState(UTILISATEUR_DEFAUT);

  // Reçu généré
  const [mouvementCree, setMouvementCree] = useState<MouvementCaisse | null>(null);

  const patient: Patient | null = useMemo(
    () => state.patients.find((p) => p.id === patientId) ?? null,
    [state.patients, patientId],
  );

  // Changement de patient : on repart d'une liste vierge.
  useEffect(() => {
    setCoches(new Set());
    setMouvementCree(null);
    setAppliquerMutuelle(Boolean(patient?.mutuelle));
  }, [patient]);

  const lignes = useMemo(
    () => state.actes.filter((a) => coches.has(a.id)),
    [state.actes, coches],
  );
  const totalUsd = lignes.reduce((s, a) => s + a.prixUsd, 0);
  const partMutuelleUsd = appliquerMutuelle && patient?.mutuelle
    ? Math.round(totalUsd * patient.mutuelle.couverturePct) / 100
    : 0;
  const ticketModerateurUsd = Math.max(0, totalUsd - partMutuelleUsd);

  const pretPourPaiement = patient !== null && lignes.length > 0;

  function majTaux(v: number | null) {
    const t = v && v > 0 ? v : getTaux();
    setTauxLocal(t);
    setTaux(t);
  }

  function toggleActe(id: string) {
    setCoches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function enregistrer(
    mode: ModeRecouvrement,
    montantPayeUsd: number,
    extra?: { motifExoneration?: string; autorisePar?: string },
  ) {
    if (!patient) return;
    const mv = registerMouvement({
      patientId: patient.id,
      dateIso: new Date().toISOString(),
      lignes: lignes.map((l) => ({ acteId: l.id, libelle: l.libelle, montantUsd: l.prixUsd })),
      totalUsd,
      partMutuelleUsd,
      ticketModerateurUsd,
      mode,
      montantPayeUsd,
      soldeUsd: Math.max(0, ticketModerateurUsd - montantPayeUsd),
      tauxFcUsd: taux,
      mutuelle: appliquerMutuelle ? patient.mutuelle : undefined,
      modePaiement: mode === 'totalite' || mode === 'acompte' ? modePaiement : undefined,
      ...extra,
    });
    setMouvementCree(mv);
    setAcompteOuvert(false);
    setExceptionMode(null);
    setMotifException('');
    if (mode === 'exonere' || mode === 'urgence_vitale') {
      message.success('✅ Prise en charge autorisée — trace enregistrée (autorité, motif, montant dû).');
    } else {
      message.success(`Paiement enregistré — reçu ${mv.reference}`);
    }
  }

  const exceptionValide = motifException.trim().length >= 5 && autorisePar.trim().length >= 3;

  return (
    <main className={styles.page}>
      <EnTeteRDC
        titre="Caisse"
        sousTitre="Sélectionner les actes, encaisser en FC et/ou USD, imprimer le reçu"
      />

      {patient ? (
        <div className={styles.row} style={{ marginBottom: 12 }}>
          <span className={styles.badge + ' ' + styles.info}>Patient</span>
          <strong>{patient.nom} {patient.prenom}</strong>
          <span className={styles.dossier}>{patient.id}</span>
          {patient.mutuelle && appliquerMutuelle ? (
            <span className={styles.badge + ' ' + styles.ok}>
              Mutuelle {patient.mutuelle.organisme} — {patient.mutuelle.couverturePct} %
            </span>
          ) : null}
          <div className={styles.spacer} />
          <Button size="small" onClick={() => setSearchParams({})}>Changer de patient</Button>
        </div>
      ) : (
        <div className={styles.card} style={{ marginBottom: 16 }}>
          <h2 className={styles.cardTitle}>1. Sélectionner le patient</h2>
          <RecherchePatient
            patients={state.patients}
            onSelect={(p) => setSearchParams({ patient: p.id })}
            onCreer={(q) => navigate(`/rdc/patients?q=${encodeURIComponent(q)}`)}
            placeholder="Nom, prénom, téléphone ou n° dossier…"
          />
        </div>
      )}

      <div className={styles.caisseGrid}>
        {/* ---------- ACTES ---------- */}
        <section className={styles.card} aria-label="Actes à payer">
          <h2 className={styles.cardTitle}>2. Actes à payer (cocher)</h2>
          {(['Consultation', 'Laboratoire', 'Imagerie', 'Séjour', 'Soins'] as const).map((cat) => (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div className="text-overline" style={{ marginBottom: 4 }}>{cat}</div>
              {state.actes.filter((a) => a.categorie === cat).map((a) => (
                <label key={a.id} className={styles.acteLigne}>
                  <input
                    type="checkbox"
                    checked={coches.has(a.id)}
                    onChange={() => toggleActe(a.id)}
                    style={{ width: 22, height: 22 }}
                  />
                  <span>{a.libelle}</span>
                  <span className={styles.prix}>
                    <MoneyDual usd={a.prixUsd} taux={taux} />
                  </span>
                </label>
              ))}
            </div>
          ))}

          {/* Mutuelle */}
          {patient?.mutuelle ? (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <input
                type="checkbox"
                checked={appliquerMutuelle}
                onChange={(e) => setAppliquerMutuelle(e.target.checked)}
                style={{ width: 20, height: 20 }}
              />
              <span>
                Appliquer la mutuelle : <strong>{patient.mutuelle.organisme}</strong>{' '}
                ({patient.mutuelle.couverturePct} % de couverture, adhérent n° {patient.mutuelle.numeroAdherent})
              </span>
            </label>
          ) : null}
        </section>

        {/* ---------- RÉCAPITULATIF STICKY ---------- */}
        <aside className={styles.recap}>
          <section className={styles.card} aria-label="Total à payer">
            <h2 className={styles.cardTitle}>3. Encaisser</h2>

            <label style={{ display: 'block', marginBottom: 12 }}>
              Taux du jour : 1 USD =
              <InputNumber
                min={1}
                step={10}
                value={taux}
                onChange={majTaux}
                style={{ width: 120, margin: '0 8px' }}
                addonAfter="FC"
              />
              <span className={styles.autosave}>(paramétrable, persisté)</span>
            </label>

            <div className={styles.totalLigne}>
              <span className={styles.label}>Total des actes</span>
              <MoneyDual usd={totalUsd} taux={taux} fort />
            </div>
            {partMutuelleUsd > 0 ? (
              <div className={styles.totalLigne}>
                <span className={styles.label}>Prise en charge mutuelle</span>
                <span className={styles.amount}>- <MoneyDual usd={partMutuelleUsd} taux={taux} /></span>
              </div>
            ) : null}
            <div className={styles.totalLigne}>
              <span className={styles.label}>Ticket modérateur (patient)</span>
              <MoneyDual usd={ticketModerateurUsd} taux={taux} fort />
            </div>

            <div className={styles.boutonsPaiement}>
              <Button
                type="primary"
                size="large"
                disabled={!pretPourPaiement}
                onClick={() => enregistrer('totalite', ticketModerateurUsd)}
              >
                ✅ Payé totalité
              </Button>
              <Button
                size="large"
                disabled={!pretPourPaiement}
                onClick={() => { setMontantAcompte(Math.round(ticketModerateurUsd / 2 * 100) / 100); setAcompteOuvert(true); }}
              >
                💵 Acompte…
              </Button>
              <Button
                size="large"
                disabled={!pretPourPaiement}
                onClick={() => setExceptionMode('exonere')}
              >
                🏷️ Exonéré…
              </Button>
              <Button
                size="large"
                danger
                disabled={!pretPourPaiement}
                onClick={() => setExceptionMode('urgence_vitale')}
              >
                🚨 Urgence vitale…
              </Button>
            </div>

            <p className={styles.autosave} style={{ marginTop: 8 }}>
              Espèces FC / USD ou mobile money. Exonération et urgence vitale exigent un motif + une autorité tracés.
            </p>
          </section>
        </aside>
      </div>

      {/* ---------- MODAL ACOMPTE ---------- */}
      <Modal
        open={acompteOuvert}
        title="Acompte (paiement fractionné)"
        onCancel={() => setAcompteOuvert(false)}
        okText="Enregistrer l'acompte"
        onOk={() => enregistrer('acompte', Math.min(montantAcompte, ticketModerateurUsd))}
        okButtonProps={{ disabled: montantAcompte <= 0 }}
      >
        <div className={styles.stack}>
          <p>Le solde sera à régler à la sortie (brief RDC 1.3 : paiement fractionné fréquent).</p>
          <label>
            Montant de l'acompte (USD)
            <InputNumber
              min={0.01}
              max={ticketModerateurUsd}
              step={0.5}
              value={montantAcompte}
              onChange={(v) => setMontantAcompte(v ?? 0)}
              style={{ width: '100%' }}
              addonAfter="$"
            />
            <div className={styles.amount} style={{ marginTop: 6 }}>
              = {formatFc(usdToFc(montantAcompte, taux))} — restera dû {formatFc(usdToFc(Math.max(0, ticketModerateurUsd - montantAcompte), taux))}
            </div>
          </label>
          <label>
            Mode de paiement
            <select
              className={styles.rechercheInput}
              style={{ minHeight: 48, marginTop: 4 }}
              value={modePaiement}
              onChange={(e) => setModePaiement(e.target.value as ModePaiement)}
            >
              <option value="especes_fc">Espèces (FC)</option>
              <option value="especes_usd">Espèces (USD)</option>
              <option value="mobile_money">Mobile money / Illlicocash</option>
            </select>
          </label>
        </div>
      </Modal>

      {/* ---------- MODAL EXCEPTION (exonéré / urgence vitale) ---------- */}
      <Modal
        open={exceptionMode !== null}
        title={exceptionMode === 'urgence_vitale'
          ? '🚨 Urgence vitale — paiement différé (arrêté n°1250/2025)'
          : '🏷️ Exonération / indigent'}
        onCancel={() => setExceptionMode(null)}
        okText="Autoriser la prise en charge"
        onOk={() => exceptionMode && enregistrer(exceptionMode, 0, { motifExoneration: motifException.trim(), autorisePar: autorisePar.trim() })}
        okButtonProps={{ disabled: !exceptionValide }}
      >
        <div className={styles.stack}>
          <p>
            Le patient est pris en charge <strong>sans paiement préalable</strong>.
            L'exception est tracée : autorité, motif, montant dû ({formatFc(usdToFc(ticketModerateurUsd, taux))}).
          </p>
          <label>
            Autorisé par&nbsp;*
            <input
              className={styles.rechercheInput}
              style={{ minHeight: 48, marginTop: 4 }}
              value={autorisePar}
              onChange={(e) => setAutorisePar(e.target.value)}
            />
          </label>
          <label>
            Motif (obligatoire)&nbsp;*
            <textarea
              className={styles.rechercheInput}
              style={{ minHeight: 80, paddingTop: 10, paddingBottom: 10, marginTop: 4 }}
              value={motifException}
              onChange={(e) => setMotifException(e.target.value)}
              placeholder={exceptionMode === 'urgence_vitale'
                ? 'Ex. : polytraumatisé, régularisation par la famille dès son arrivée'
                : 'Ex. : patient indigent — Fond Social / prise en charge sociale'}
            />
          </label>
        </div>
      </Modal>

      {/* ---------- REÇU ---------- */}
      <ModalApercu
        ouvert={mouvementCree !== null}
        titre={`Reçu ${mouvementCree?.reference ?? ''}`}
        onFermer={() => setMouvementCree(null)}
      >
        {mouvementCree ? <RecuFacture mouvement={mouvementCree} patient={patient ?? undefined} /> : null}
      </ModalApercu>
    </main>
  );
}
