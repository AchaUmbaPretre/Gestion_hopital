/**
 * ÉCRAN 2/5 — Recherche patient "instantanée" + création rapide
 * (brief RDC 3.2) : autocomplete dès 2 caractères (debounce 250 ms,
 * recherche par nom / prénom / téléphone / n° dossier, insensible
 * aux accents), bouton "Créer ce patient" DANS la dropdown, fiche
 * synthétique imprimable pour le carnet papier (brief 1.4).
 * PAS d'email ni smartphone supposé.
 */

import { useEffect, useMemo, useState } from 'react';
import { Button, message } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './rdc.module.scss';
import { EnTeteRDC, ModalApercu, RecherchePatient } from './components';
import { FormulaireCreationRapide } from './components';
import { useRdcState, updatePatient } from './data/rdcStore';
import type { Patient } from './data/types';
import { FicheCarnet } from './printDocuments';

export default function PatientsRDC() {
  const navigate = useNavigate();
  const state = useRdcState();
  const [searchParams, setSearchParams] = useSearchParams();

  const patientId = searchParams.get('patient');
  const queryCreer = searchParams.get('q');
  const [formOuvert, setFormOuvert] = useState(false);
  const [requeteInitiale, setRequeteInitiale] = useState('');
  const [apercuCarnet, setApercuCarnet] = useState(false);

  // Mutuelle (édition inline)
  const [mutoOrganisme, setMutoOrganisme] = useState('');
  const [mutoPct, setMutoPct] = useState<number>(0);
  const [mutoNumero, setMutoNumero] = useState('');

  const patient: Patient | null = useMemo(
    () => state.patients.find((p) => p.id === patientId) ?? null,
    [state.patients, patientId],
  );

  // ?q=... arrive depuis une autre recherche -> formulaire pré-rempli
  useEffect(() => {
    if (queryCreer) {
      setFormOuvert(true);
      setRequeteInitiale(queryCreer);
      setSearchParams({}, { replace: true });
    }
  }, [queryCreer, setSearchParams]);

  // Synchronisation du formulaire mutuelle avec le patient sélectionné
  useEffect(() => {
    setMutoOrganisme(patient?.mutuelle?.organisme ?? '');
    setMutoPct(patient?.mutuelle?.couverturePct ?? 0);
    setMutoNumero(patient?.mutuelle?.numeroAdherent ?? '');
  }, [patient]);

  function selectionner(p: Patient) {
    setSearchParams({ patient: p.id });
    setFormOuvert(false);
  }

  const mutuelleValide = mutoOrganisme.trim().length >= 2 && mutoPct >= 0 && mutoPct <= 100;

  return (
    <main className={styles.page}>
      <EnTeteRDC
        titre="Patients"
        sousTitre="Recherche instantanée — nom, prénom, téléphone ou n° de dossier"
      />

      <RecherchePatient
        patients={state.patients}
        onSelect={selectionner}
        onCreer={(requete) => { setFormOuvert(true); setRequeteInitiale(requete); }}
      />

      {formOuvert ? (
        <div style={{ marginTop: 16 }}>
          <FormulaireCreationRapide
            requeteInitiale={requeteInitiale}
            onCree={(p) => {
              setFormOuvert(false);
              message.success(`Patient créé — dossier ${p.id}. L'adresse et le téléphone sont modifiables plus tard.`);
              setSearchParams({ patient: p.id });
            }}
            onAnnule={() => setFormOuvert(false)}
          />
        </div>
      ) : null}

      {/* ---------- FICHE PATIENT ---------- */}
      {patient && !formOuvert ? (
        <section className={styles.card} style={{ marginTop: 16 }} aria-label="Fiche patient">
          <div className={styles.row} style={{ marginBottom: 12 }}>
            <h2 className={styles.cardTitle} style={{ margin: 0 }}>
              {patient.nom} {patient.prenom}
            </h2>
            <span className={styles.badge + ' ' + styles.info}>
              Dossier <span className={styles.dossier}>{patient.id}</span>
            </span>
            {patient.refere ? <span className={styles.badge + ' ' + styles.danger}>Référé (centre de santé)</span> : null}
            {patient.exonere ? <span className={styles.badge + ' ' + styles.bas}>Exonéré / FSS</span> : null}
            <div className={styles.spacer} />
            <Button size="small" onClick={() => setSearchParams({})}>Fermer la fiche</Button>
          </div>

          <dl className={styles.ficheIdentite}>
            <div><dt>Sexe</dt><dd>{patient.sexe === 'F' ? 'Féminin' : 'Masculin'}</dd></div>
            <div><dt>Âge estimé</dt><dd>{patient.ageEstime} an{patient.ageEstime > 1 ? 's' : ''}</dd></div>
            <div><dt>Téléphone</dt><dd>{patient.telephone || '—'}</dd></div>
            <div><dt>Adresse</dt><dd>{patient.adresse || '—'}</dd></div>
            <div><dt>Mutuelle</dt><dd>{patient.mutuelle ? `${patient.mutuelle.organisme} — ${patient.mutuelle.couverturePct} %` : '—'}</dd></div>
          </dl>

          {/* Actions critiques : 1 clic chacune */}
          <div className={styles.actionsBas}>
            <Button type="primary" size="large" onClick={() => navigate(`/rdc/consultation?patient=${encodeURIComponent(patient.id)}`)}>
              🩺 Démarrer une consultation
            </Button>
            <Button size="large" onClick={() => navigate(`/rdc/caisse?patient=${encodeURIComponent(patient.id)}`)}>
              💰 Aller à la caisse
            </Button>
            <Button size="large" onClick={() => setApercuCarnet(true)}>
              🖨️ Imprimer la fiche carnet
            </Button>
          </div>

          {/* Mutuelle / exonération */}
          <div style={{ marginTop: 24 }}>
            <h3 className={styles.cardTitle}>Prise en charge mutuelle / exonération</h3>
            <div className={styles.row}>
              <label>
                Organisme
                <input
                  className={styles.rechercheInput}
                  style={{ minHeight: 48, marginTop: 4 }}
                  value={mutoOrganisme}
                  onChange={(e) => setMutoOrganisme(e.target.value)}
                  placeholder="Ex. : Mutuelle Santé Lubumbashi"
                />
              </label>
              <label>
                Couverture (%)
                <input
                  className={styles.rechercheInput}
                  style={{ minHeight: 48, marginTop: 4, maxWidth: 140 }}
                  type="number"
                  min={0}
                  max={100}
                  value={mutoPct}
                  onChange={(e) => setMutoPct(Number(e.target.value) || 0)}
                />
              </label>
              <label>
                N° adhérent
                <input
                  className={styles.rechercheInput}
                  style={{ minHeight: 48, marginTop: 4 }}
                  value={mutoNumero}
                  onChange={(e) => setMutoNumero(e.target.value)}
                  placeholder="MSL-00000"
                />
              </label>
            </div>
            <div className={styles.actionsBas}>
              <Button
                type="primary"
                disabled={!mutuelleValide}
                onClick={() => {
                  updatePatient(patient.id, {
                    mutuelle: mutuelleValide ? { organisme: mutoOrganisme.trim(), couverturePct: mutoPct, numeroAdherent: mutoNumero.trim() } : undefined,
                  });
                  message.success('Prise en charge mutuelle enregistrée.');
                }}
              >
                Enregistrer la mutuelle
              </Button>
              <Button
                onClick={() => {
                  updatePatient(patient.id, { exonere: !patient.exonere });
                  message.info(patient.exonere ? 'Statut exonération retiré.' : 'Patient marqué exonéré / indigent (FSS, aide sociale).');
                }}
              >
                {patient.exonere ? 'Retirer le statut exonéré' : 'Marquer exonéré / indigent'}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {/* ---------- PATIENTS RÉCENTS ---------- */}
      {!patient && !formOuvert ? (
        <section className={styles.card} style={{ marginTop: 16 }} aria-label="Patients récents">
          <h2 className={styles.cardTitle}>Patients récents</h2>
          {state.patients.slice(0, 8).map((p) => (
            <button key={p.id} type="button" className={styles.resultatItem} onClick={() => selectionner(p)}>
              <span className={styles.nomPrenom}>{p.nom} {p.prenom}</span>
              <span className={styles.meta}>{p.sexe === 'M' ? 'Homme' : 'Femme'} · {p.ageEstime} an{p.ageEstime > 1 ? 's' : ''}</span>
              {p.telephone ? <span className={styles.meta}>{p.telephone}</span> : null}
              <span className={styles.dossier}>{p.id}</span>
            </button>
          ))}
        </section>
      ) : null}

      <ModalApercu ouvert={apercuCarnet} titre="Fiche carnet (A4)" onFermer={() => setApercuCarnet(false)}>
        {patient ? <FicheCarnet patient={patient} /> : null}
      </ModalApercu>
    </main>
  );
}
