/**
 * ÉCRAN 1/5 — Accueil / Triage « 3 boutons » (brief RDC 3.1)
 * 3 boutons géants (>= 64px, réellement 140px) : URGENCE,
 * CONSULTATION, PHARMACIE. Le bouton URGENCE ouvre le triage
 * simplifié (4 niveaux + urgence vitale sans paiement préalable,
 * tracée conformément à l'arrêté n°1250/2025).
 * KPI fixes (pas de widgets drag & drop) + alertes pharmacie.
 */

import { useMemo, useState } from 'react';
import { Button, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import styles from './rdc.module.scss';
import { EnTeteRDC, RecherchePatient } from './components';
import { useRdcState, statutStock } from './data/rdcStore';
import { SERVICES_HGR, libelleTriage, type NiveauTriage, type Patient } from './data/types';
import { getTaux, formatBidevise } from './data/money';
import { addTriage } from './data/rdcStore';
import { useHorloge } from './hooks';

const UTILISATEUR_DEFAUT = 'Dr. Kabongo (chef de garde)';

export default function AccueilRDC() {
  const navigate = useNavigate();
  const state = useRdcState();
  const horloge = useHorloge();
  const taux = getTaux();

  const [triageOuvert, setTriageOuvert] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [motif, setMotif] = useState('');
  const [niveau, setNiveau] = useState<NiveauTriage>('orange');
  const [orientation, setOrientation] = useState<string>(SERVICES_HGR[0] ?? 'Urgences / Déchocage');
  const [urgenceVitale, setUrgenceVitale] = useState(false);
  const [autorisePar, setAutorisePar] = useState(UTILISATEUR_DEFAUT);
  const [motifAutorisation, setMotifAutorisation] = useState('');

  const alertes = useMemo(() => {
    const rupture = state.medicaments.filter((m) => statutStock(m) === 'rupture');
    const bas = state.medicaments.filter((m) => statutStock(m) === 'bas');
    return { rupture, bas };
  }, [state.medicaments]);

  const recettesJour = useMemo(
    () => state.mouvements.reduce((sum, m) => sum + m.montantPayeUsd, 0),
    [state.mouvements],
  );
  const enAttentePharma = state.ordonnances.filter((o) => o.statut === 'en_attente').length;

  const triageValide = patient !== null && motif.trim().length >= 3
    && (!urgenceVitale || (autorisePar.trim().length >= 3 && motifAutorisation.trim().length >= 5));

  function demarrerPriseEnCharge() {
    if (!patient || !triageValide) return;
    addTriage({
      patientId: patient.id,
      niveau,
      motif: motif.trim(),
      orientation,
      urgenceVitale,
      autorisePar: urgenceVitale ? autorisePar.trim() : undefined,
      motifAutorisation: urgenceVitale ? motifAutorisation.trim() : undefined,
      montantDuUsd: 0,
      dateIso: new Date().toISOString(),
    });
    if (urgenceVitale) {
      message.success(`Prise en charge autorisée sans paiement — patient ${patient.nom} ${patient.prenom} orienté vers ${orientation}. Trace enregistrée.`);
    } else {
      message.success(`Triage ${libelleTriage(niveau)} enregistré — ${patient.nom} ${patient.prenom} orienté vers ${orientation}.`);
    }
    // Reset panneau
    setPatient(null); setMotif(''); setUrgenceVitale(false); setMotifAutorisation('');
    setTriageOuvert(false);
  }

  return (
    <main className={styles.page}>
      <EnTeteRDC
        titre="Accueil — Accueil / Triage"
        sousTitre={horloge.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      />

      {/* ---------- 3 BOUTONS GÉANTS ---------- */}
      <div className={styles.troisBoutons}>
        <button
          type="button"
          className={`${styles.boutonGeant} ${styles.urgence}`}
          onClick={() => setTriageOuvert((v) => !v)}
          aria-expanded={triageOuvert}
        >
          <span className={styles.emoji} aria-hidden>🚨</span>
          URGENCE
          <span className={styles.sousLibelle}>Triage 4 niveaux · prise en charge immédiate</span>
        </button>
        <button
          type="button"
          className={`${styles.boutonGeant} ${styles.consultation}`}
          onClick={() => navigate('/rdc/patients')}
        >
          <span className={styles.emoji} aria-hidden>👤</span>
          CONSULTATION
          <span className={styles.sousLibelle}>Rechercher un patient · démarrer une consultation</span>
        </button>
        <button
          type="button"
          className={`${styles.boutonGeant} ${styles.pharmacie}`}
          onClick={() => navigate('/rdc/pharmacie')}
        >
          <span className={styles.emoji} aria-hidden>💊</span>
          PHARMACIE
          <span className={styles.sousLibelle}>Délivrer une ordonnance · vente directe</span>
        </button>
      </div>

      {/* ---------- TRIAGE SIMPLIFIÉ ---------- */}
      {triageOuvert ? (
        <section className={`${styles.card} ${styles.sectionTriage}`} aria-label="Triage des urgences">
          <h2 className={styles.cardTitle}>Triage simplifié — 4 niveaux</h2>

          <div className={styles.stack}>
            {patient ? (
              <div className={styles.row}>
                <span className={styles.badge + ' ' + styles.info}>Patient sélectionné</span>
                <strong>{patient.nom} {patient.prenom}</strong>
                <span className={styles.dossier}>{patient.id}</span>
                <Button size="small" onClick={() => setPatient(null)}>Changer</Button>
              </div>
            ) : (
              <RecherchePatient
                patients={state.patients}
                onSelect={setPatient}
                onCreer={(requete) => navigate(`/rdc/patients?q=${encodeURIComponent(requete)}`)}
                placeholder="Patient existant ? Nom, prénom, téléphone ou n° dossier…"
              />
            )}

            <label style={{ display: 'block' }}>
              Motif d'admission&nbsp;*
              <textarea
                className={styles.rechercheInput}
                style={{ minHeight: 64, paddingTop: 12, paddingBottom: 12, marginTop: 4 }}
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex. : fièvre 3 jours, paludisme suspecté…"
              />
            </label>

            <div>
              <span style={{ fontWeight: 600 }}>Niveau de triage&nbsp;*</span>
              <div className={styles.niveauxTriage} role="radiogroup" aria-label="Niveau de triage">
                {(
                  [
                    { n: 'rouge' as const, l: '🔴 Rouge', d: 'immédiat' },
                    { n: 'orange' as const, l: '🟠 Orange', d: '≤ 30 min' },
                    { n: 'jaune' as const, l: '🟡 Jaune', d: '≤ 2 h' },
                    { n: 'vert' as const, l: '🟢 Vert', d: 'différable' },
                  ]
                ).map((t) => (
                  <button
                    key={t.n}
                    type="button"
                    role="radio"
                    aria-checked={niveau === t.n}
                    className={`${styles.niveauBtn} ${styles[t.n]} ${niveau === t.n ? styles.selectionne : ''}`}
                    onClick={() => setNiveau(t.n)}
                  >
                    {t.l}
                    <span className={styles.delai}>{t.d}</span>
                  </button>
                ))}
              </div>
            </div>

            <label style={{ display: 'block' }}>
              Orientation&nbsp;*
              <select
                className={styles.rechercheInput}
                style={{ minHeight: 48, marginTop: 4 }}
                value={orientation}
                onChange={(e) => setOrientation(e.target.value)}
              >
                {SERVICES_HGR.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <input
                type="checkbox"
                checked={urgenceVitale}
                onChange={(e) => setUrgenceVitale(e.target.checked)}
                style={{ width: 20, height: 20, marginTop: 2 }}
              />
              <span>
                <strong>Urgence vitale — démarrer la prise en charge SANS paiement préalable</strong>
                <span style={{ display: 'block', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-body-sm)' }}>
                  Arrêté ministériel n°1250/2025 : aucun patient en urgence vitale ne peut se voir refuser les soins pour motif financier.
                  L'exception est tracée (autorité, motif, montant dû) et régularisée a posteriori.
                </span>
              </span>
            </label>

            {urgenceVitale ? (
              <div className={styles.stack}>
                <label style={{ display: 'block' }}>
                  Autorisé par&nbsp;*
                  <input
                    className={styles.rechercheInput}
                    style={{ minHeight: 48, marginTop: 4 }}
                    value={autorisePar}
                    onChange={(e) => setAutorisePar(e.target.value)}
                  />
                </label>
                <label style={{ display: 'block' }}>
                  Motif de l'exception&nbsp;*
                  <input
                    className={styles.rechercheInput}
                    style={{ minHeight: 48, marginTop: 4 }}
                    value={motifAutorisation}
                    onChange={(e) => setMotifAutorisation(e.target.value)}
                    placeholder="Ex. : détresse respiratoire, régularisation par la famille dès que possible"
                  />
                </label>
              </div>
            ) : null}

            <div className={styles.actionsBas}>
              <Button type="primary" danger size="large" disabled={!triageValide} onClick={demarrerPriseEnCharge}>
                {urgenceVitale ? '🚨 Démarrer la prise en charge (sans paiement)' : 'Démarrer la prise en charge'}
              </Button>
              <Button size="large" onClick={() => setTriageOuvert(false)}>Fermer</Button>
            </div>
          </div>
        </section>
      ) : null}

      {/* ---------- KPI FIXES + ALERTES ---------- */}
      <div className={styles.caisseGrid}>
        <section className={styles.card} aria-label="Aujourd'hui">
          <h2 className={styles.cardTitle}>Aujourd'hui</h2>
          <div className={styles.kpiGrid}>
            <div className={styles.kpi}>
              <div className={styles.valeur}>{state.triages.length}</div>
              <div className={styles.libelle}>Urgences triées</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.valeur}>{enAttentePharma}</div>
              <div className={styles.libelle}>Ordonnances en attente</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.valeur}>{state.patients.length}</div>
              <div className={styles.libelle}>Patients au fichier</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.valeur}>{formatBidevise(recettesJour, taux)}</div>
              <div className={styles.libelle}>Recettes encaissées</div>
            </div>
          </div>
        </section>

        <section
          className={`${styles.card} ${alertes.rupture.length > 0 ? styles.alerteBarRouge : ''}`}
          aria-label="Alertes pharmacie"
        >
          <h2 className={styles.cardTitle}>⚠️ Alertes pharmacie</h2>
          {alertes.rupture.length === 0 && alertes.bas.length === 0 ? (
            <p style={{ margin: 0 }}>Aucune alerte de stock.</p>
          ) : (
            <div className={styles.stack}>
              {alertes.rupture.length > 0 ? (
                <div className={`${styles.alerteBar} ${styles.alerteBarRouge}`}>
                  🔴 {alertes.rupture.length} rupture{alertes.rupture.length > 1 ? 's' : ''} de stock :
                  {' '}{alertes.rupture.map((m) => m.nom).join(', ')}
                </div>
              ) : null}
              {alertes.bas.length > 0 ? (
                <div className={styles.alerteBar}>
                  🟠 {alertes.bas.length} stock{alertes.bas.length > 1 ? 's' : ''} bas :
                  {' '}{alertes.bas.map((m) => `${m.nom} (${m.stock})`).join(', ')}
                </div>
              ) : null}
              <Button onClick={() => navigate('/rdc/pharmacie')}>Ouvrir la pharmacie</Button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/** Exposé pour les tests : libellé normalisé du badge autorisation. */
export { libelleTriage };
