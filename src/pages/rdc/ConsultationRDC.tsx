/**
 * ÉCRAN 4/5 — Consultation « mode crayon » (brief RDC 3.4)
 * - formulaire structuré en sections PLIABLES : Motif /
 *   Antécédents / Examen clinique / Diagnostic / Prescriptions ;
 * - prescription avec STOCK TEMPS RÉEL affiché (vert/orange/rouge)
 *   + alternative thérapeutique de même classe si rupture ;
 * - auto-save localStorage toutes les 30 s (coupures d'électricité)
 *   avec proposition de restauration au retour ;
 * - "Enregistrer et imprimer l'ordonnance" EN UN CLIC : l'ordonnance
 *   part dans la file pharmacie + aperçu imprimable A5.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Collapse, InputNumber, Modal, message } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './rdc.module.scss';
import { EnTeteRDC, ModalApercu, RecherchePatient, StockBadge } from './components';
import { useRdcState, addOrdonnance, trouverAlternative } from './data/rdcStore';
import type { LigneOrdonnance, Ordonnance, Patient } from './data/types';
import { OrdonnanceDoc } from './printDocuments';
import { loadDraft, clearDraft, useDraftAutosave, type Draft } from './hooks';

interface BrouillonConsultation {
  motif: string;
  antecedents: string;
  examen: { temperature: string; tension: string; pouls: string; poids: string };
  examenNotes: string;
  diagnostic: string;
  prescriptions: LigneOrdonnance[];
}

const BROUILLON_VIDE: BrouillonConsultation = {
  motif: '',
  antecedents: '',
  examen: { temperature: '', tension: '', pouls: '', poids: '' },
  examenNotes: '',
  diagnostic: '',
  prescriptions: [{ medicamentId: '', quantite: 1, posologie: '', dureeJours: 5 }],
};

export default function ConsultationRDC() {
  const navigate = useNavigate();
  const state = useRdcState();
  const [searchParams, setSearchParams] = useSearchParams();
  const patientId = searchParams.get('patient');
  const patient: Patient | null = useMemo(
    () => state.patients.find((p) => p.id === patientId) ?? null,
    [state.patients, patientId],
  );

  const [draft, setDraft] = useState<BrouillonConsultation>(BROUILLON_VIDE);
  const [apercuOrdonnance, setApercuOrdonnance] = useState<Ordonnance | null>(null);
  const [propositionRestauration, setPropositionRestauration] = useState<Draft<BrouillonConsultation> | null>(null);
  const derniereRestauration = useRef<string | null>(null);

  const cleBrouillon = `rdc.draft.consultation.${patientId ?? 'sans-patient'}`;

  // Auto-save 30 s (brief RDC 3.4)
  const { lastSaved } = useDraftAutosave<BrouillonConsultation>(cleBrouillon, () => draft);

  // Proposition de restauration au chargement d'un patient
  useEffect(() => {
    if (!patient) return;
    if (derniereRestauration.current === patient.id) return;
    derniereRestauration.current = patient.id;
    const d = loadDraft<BrouillonConsultation>(`rdc.draft.consultation.${patient.id}`);
    if (d) {
      const vide = !d.data.motif && !d.data.diagnostic && (d.data.prescriptions ?? []).every((l) => !l.medicamentId);
      if (!vide) setPropositionRestauration(d);
    } else {
      setDraft(BROUILLON_VIDE);
    }
  }, [patient]);

  function majPrescription(index: number, patch: Partial<LigneOrdonnance>) {
    setDraft((d) => ({
      ...d,
      prescriptions: d.prescriptions.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));
  }

  function supprimerLigne(index: number) {
    setDraft((d) => ({ ...d, prescriptions: d.prescriptions.filter((_, i) => i !== index) }));
  }

  const lignesValides = draft.prescriptions.filter((l) => l.medicamentId && l.posologie.trim());
  const pret = patient !== null && lignesValides.length > 0;

  function enregistrer(imprimer: boolean) {
    if (!patient || !pret) return;
    const ordonnance = addOrdonnance({
      patientId: patient.id,
      medecin: 'Dr. Kabongo',
      service: 'Médecine interne',
      dateIso: new Date().toISOString(),
      lignes: lignesValides,
      statut: 'en_attente',
    });
    clearDraft(cleBrouillon);
    setDraft(BROUILLON_VIDE);
    if (imprimer) {
      setApercuOrdonnance(ordonnance);
    }
    message.success(`Ordonnance enregistrée et transmise à la file pharmacie (${ordonnance.id}).`);
  }

  const sections = [
    {
      key: 'motif',
      label: '1. Motif de consultation',
      children: (
        <textarea
          className={styles.rechercheInput}
          style={{ minHeight: 88, paddingTop: 10, paddingBottom: 10 }}
          value={draft.motif}
          onChange={(e) => setDraft((d) => ({ ...d, motif: e.target.value }))}
          placeholder="Ex. : fièvre et céphalées depuis 3 jours…"
        />
      ),
    },
    {
      key: 'antecedents',
      label: '2. Antécédents',
      children: (
        <textarea
          className={styles.rechercheInput}
          style={{ minHeight: 72, paddingTop: 10, paddingBottom: 10 }}
          value={draft.antecedents}
          onChange={(e) => setDraft((d) => ({ ...d, antecedents: e.target.value }))}
          placeholder="Ex. : paludisme récent, HTA, allergies connues…"
        />
      ),
    },
    {
      key: 'examen',
      label: '3. Examen clinique (constantes)',
      children: (
        <div>
          <div className={styles.row}>
            <label>
              T° (°C)
              <input
                className={styles.rechercheInput}
                style={{ minHeight: 48, maxWidth: 110, marginTop: 4 }}
                value={draft.examen.temperature}
                onChange={(e) => setDraft((d) => ({ ...d, examen: { ...d.examen, temperature: e.target.value } }))}
                placeholder="38.5"
              />
            </label>
            <label>
              TA (mmHg)
              <input
                className={styles.rechercheInput}
                style={{ minHeight: 48, maxWidth: 130, marginTop: 4 }}
                value={draft.examen.tension}
                onChange={(e) => setDraft((d) => ({ ...d, examen: { ...d.examen, tension: e.target.value } }))}
                placeholder="120/80"
              />
            </label>
            <label>
              Pouls (bpm)
              <input
                className={styles.rechercheInput}
                style={{ minHeight: 48, maxWidth: 110, marginTop: 4 }}
                value={draft.examen.pouls}
                onChange={(e) => setDraft((d) => ({ ...d, examen: { ...d.examen, pouls: e.target.value } }))}
                placeholder="92"
              />
            </label>
            <label>
              Poids (kg)
              <input
                className={styles.rechercheInput}
                style={{ minHeight: 48, maxWidth: 110, marginTop: 4 }}
                value={draft.examen.poids}
                onChange={(e) => setDraft((d) => ({ ...d, examen: { ...d.examen, poids: e.target.value } }))}
                placeholder="64"
              />
            </label>
          </div>
          <textarea
            className={styles.rechercheInput}
            style={{ minHeight: 72, paddingTop: 10, paddingBottom: 10, marginTop: 8 }}
            value={draft.examenNotes}
            onChange={(e) => setDraft((d) => ({ ...d, examenNotes: e.target.value }))}
            placeholder="Observations : auscultation, abdomen, signes neurologiques…"
          />
        </div>
      ),
    },
    {
      key: 'diagnostic',
      label: '4. Diagnostic',
      children: (
        <textarea
          className={styles.rechercheInput}
          style={{ minHeight: 72, paddingTop: 10, paddingBottom: 10 }}
          value={draft.diagnostic}
          onChange={(e) => setDraft((d) => ({ ...d, diagnostic: e.target.value }))}
          placeholder="Ex. : paludisme simple à P. falciparum (TDR +)"
        />
      ),
    },
    {
      key: 'prescriptions',
      label: `5. Prescriptions (${lignesValides.length} médicament${lignesValides.length > 1 ? 's' : ''})`,
      children: (
        <div className={styles.stack}>
          {draft.prescriptions.map((ligne, i) => {
            const med = state.medicaments.find((m) => m.id === ligne.medicamentId);
            const alt = ligne.medicamentId ? trouverAlternative(ligne.medicamentId) : null;
            const rupture = med ? med.stock <= 0 : false;
            return (
              <div key={i}>
                <div className={styles.prescriptionLigne}>
                  <label>
                    Médicament
                    <select
                      className={styles.rechercheInput}
                      style={{ minHeight: 48, marginTop: 4 }}
                      value={ligne.medicamentId}
                      onChange={(e) => majPrescription(i, { medicamentId: e.target.value })}
                    >
                      <option value="">— Choisir —</option>
                      {state.medicaments.map((m) => (
                        <option key={m.id} value={m.id}>{m.nom} ({m.forme})</option>
                      ))}
                    </select>
                    {med ? (
                      <span className={styles.stockInline} style={{ marginTop: 4 }}>
                        <StockBadge medicament={med} /> — {med.classe}
                      </span>
                    ) : null}
                  </label>
                  <label>
                    Quantité
                    <InputNumber
                      min={1}
                      value={ligne.quantite}
                      onChange={(v) => majPrescription(i, { quantite: v ?? 1 })}
                      style={{ width: '100%', marginTop: 4 }}
                    />
                  </label>
                  <label>
                    Durée (j)
                    <InputNumber
                      min={1}
                      value={ligne.dureeJours}
                      onChange={(v) => majPrescription(i, { dureeJours: v ?? 1 })}
                      style={{ width: '100%', marginTop: 4 }}
                    />
                  </label>
                  <label>
                    Posologie
                    <input
                      className={styles.rechercheInput}
                      style={{ minHeight: 48, marginTop: 4 }}
                      value={ligne.posologie}
                      onChange={(e) => majPrescription(i, { posologie: e.target.value })}
                      placeholder="Ex. : 1 cp x 3/jour"
                    />
                  </label>
                  <Button danger onClick={() => supprimerLigne(i)} aria-label="Supprimer la ligne">✕</Button>
                </div>
                {rupture && alt ? (
                  <div className={styles.alternative} style={{ marginTop: 6 }}>
                    🔴 {med?.nom} en rupture — alternative thérapeutique disponible (même classe)&nbsp;:
                    <Button size="small" style={{ marginLeft: 8 }} onClick={() => majPrescription(i, { medicamentId: alt.id })}>
                      Remplacer par {alt.nom}
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
          <div>
            <Button onClick={() => setDraft((d) => ({ ...d, prescriptions: [...d.prescriptions, { medicamentId: '', quantite: 1, posologie: '', dureeJours: 5 }] }))}>
              ➕ Ajouter un médicament
            </Button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <main className={styles.page}>
      <EnTeteRDC
        titre="Consultation"
        sousTitre="Sections pliables — le brouillon s'enregistre automatiquement toutes les 30 s"
        actions={
          lastSaved ? (
            <span className={styles.autosave}>💾 Brouillon enregistré à {new Date(lastSaved).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          ) : null
        }
      />

      {patient ? (
        <div className={styles.row} style={{ marginBottom: 12 }}>
          <span className={styles.badge + ' ' + styles.info}>Patient</span>
          <strong>{patient.nom} {patient.prenom}</strong>
          <span className={styles.dossier}>{patient.id}</span>
          <span className={styles.meta}>{patient.ageEstime} an{patient.ageEstime > 1 ? 's' : ''} · {patient.sexe === 'F' ? 'F' : 'M'}</span>
          <div className={styles.spacer} />
          <Button size="small" onClick={() => setSearchParams({})}>Changer</Button>
        </div>
      ) : (
        <div className={styles.card} style={{ marginBottom: 16 }}>
          <h2 className={styles.cardTitle}>Sélectionner le patient</h2>
          <RecherchePatient
            patients={state.patients}
            onSelect={(p) => setSearchParams({ patient: p.id })}
            onCreer={(q) => navigate(`/rdc/patients?q=${encodeURIComponent(q)}`)}
          />
        </div>
      )}

      <Collapse
        items={sections}
        defaultActiveKey={['motif', 'prescriptions']}
        style={{ background: 'var(--color-bg-surface)' }}
      />

      <div className={styles.actionsBas}>
        <Button type="primary" size="large" disabled={!pret} onClick={() => enregistrer(true)}>
          🖨️ Enregistrer et imprimer l'ordonnance
        </Button>
        <Button size="large" disabled={!pret} onClick={() => enregistrer(false)}>
          Enregistrer (sans imprimer)
        </Button>
      </div>

      {/* Restauration du brouillon après coupure */}
      <Modal
        open={propositionRestauration !== null}
        title="Brouillon de consultation retrouvé"
        okText="Reprendre le brouillon"
        cancelText="Recommencer à zéro"
        onOk={() => {
          if (propositionRestauration) setDraft(propositionRestauration.data);
          setPropositionRestauration(null);
        }}
        onCancel={() => {
          clearDraft(cleBrouillon);
          setDraft(BROUILLON_VIDE);
          setPropositionRestauration(null);
        }}
      >
        <p>
          Un brouillon de consultation enregistré à{' '}
          <strong>{propositionRestauration ? new Date(propositionRestauration.savedAt).toLocaleString('fr-FR') : ''}</strong>{' '}
          a été retrouvé pour ce patient (sauvegarde automatique anti-coupure d'électricité).
        </p>
      </Modal>

      {/* Aperçu imprimable */}
      <ModalApercu
        ouvert={apercuOrdonnance !== null}
        titre="Ordonnance (A5)"
        onFermer={() => setApercuOrdonnance(null)}
      >
        {apercuOrdonnance ? (
          <OrdonnanceDoc ordonnance={apercuOrdonnance} patient={patient ?? undefined} medicaments={state.medicaments} />
        ) : null}
      </ModalApercu>
    </main>
  );
}
