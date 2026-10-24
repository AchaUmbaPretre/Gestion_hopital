/**
 * ÉCRAN 2/5 — Recherche patient "instantanée" + création rapide
 * (brief RDC 3.2) : autocomplete dès 2 caractères (debounce 250 ms,
 * recherche par nom / prénom / téléphone / n° dossier, insensible
 * aux accents), bouton "Créer ce patient" DANS la dropdown, fiche
 * synthétique imprimable pour le carnet papier (brief 1.4).
 * PAS d'email ni smartphone supposé.
 *
 * PHASE 2 — branchement API réelle (plan de migration v2) :
 *  - la liste de travail = fusion store local (journée, offline) ∪
 *    serveur (GET /api/patient via React Query), dédup par identité ;
 *  - la création rapide écrit localement (instantané, hors ligne OK)
 *    + trace outbox → rejeu immédiat si en ligne (lancerSynchronisation) ;
 *  - fiche 360° : historique des passages (consultations + factures
 *    serveur, actes locaux du jour) ;
 *  - impression carnet alimentée par les données mappées réelles.
 */

import { useEffect, useMemo, useState } from 'react';
import { Button, message } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './rdc.module.scss';
import { EnTeteRDC, ModalApercu, RecherchePatient, MoneyDual } from './components';
import { FormulaireCreationRapide } from './components';
import { updatePatient } from './data/rdcStore';
import { useHistoriquePatient, useListePatients, useTypesPatient } from './data/usePatients';
import { useMutuellesRdc } from './data/usePharmacie';
import type { Patient } from './data/types';
import type { Passage } from '../../services/patientsApi';
import { getTaux } from './data/money';
import { lancerSynchronisation } from '../../offline/syncEngine';
import { FicheCarnet } from './printDocuments';

/** Date ISO -> "24 fév. 2026" (ou — si inconnue). */
function formatDate(iso: string): string {
  if (iso === '') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const LIBELLE_TYPE_PASSAGE: Record<Passage['type'], string> = {
  consultation: 'Consultation',
  facture: 'Facture',
  caisse_locale: 'Caisse (jour)',
  ordonnance_locale: 'Ordonnance (jour)',
  triage_locale: 'Triage (jour)',
};

/**
 * Historique des passages (fiche 360° — phase 2, item 3) :
 * actes du jour (store local, disponibles hors ligne) + historique
 * serveur (consultations + factures). 20 entrées max : la fiche reste
 * lisible d'un coup d'œil (le détail complet reste dans le carnet).
 */
function HistoriquePassages({ patientId }: { patientId: string }) {
  const { passages, enChargement, erreurServeur } = useHistoriquePatient(patientId);
  const taux = getTaux();

  return (
    <section className={styles.card} style={{ marginTop: 16 }} aria-label="Historique des passages">
      <h3 className={styles.cardTitle}>Historique des passages</h3>
      {erreurServeur ? (
        <p className={styles.meta} role="status">
          Serveur injoignable — seuls les passages de cette session sont affichés. Ils se
          synchroniseront au retour du réseau.
        </p>
      ) : null}
      {enChargement ? <p className={styles.meta}>Chargement de l'historique serveur…</p> : null}
      {!enChargement && passages.length === 0 ? (
        <p className={styles.meta}>Aucun passage antérieur enregistré.</p>
      ) : null}
      <ul className={styles.listePassages}>
        {passages.slice(0, 20).map((p, i) => (
          <li
            key={`${p.type}-${p.dateIso}-${i}`}
            className={styles.passageItem}
          >
            <span className={styles.passageDate}>{formatDate(p.dateIso)}</span>
            <span className={styles.passageCorps}>
              <span className={styles.passageLibelle}>{p.libelle}</span>
              {p.detail ? <span className={styles.meta}>{p.detail}</span> : null}
            </span>
            {p.statut ? <span className={styles.badge}>{p.statut}</span> : null}
            <span className={styles.passageType}>{LIBELLE_TYPE_PASSAGE[p.type]}</span>
            {typeof p.montantUsd === 'number' ? (
              <MoneyDual usd={p.montantUsd} taux={taux} />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function PatientsRDC() {
  const navigate = useNavigate();
  const liste = useListePatients();
  const typesPatient = useTypesPatient();
  const [searchParams, setSearchParams] = useSearchParams();

  const patientId = searchParams.get('patient');
  const queryCreer = searchParams.get('q');
  const [formOuvert, setFormOuvert] = useState(false);
  const [requeteInitiale, setRequeteInitiale] = useState('');
  const [apercuCarnet, setApercuCarnet] = useState(false);

  // FK typePatient par défaut pour le POST /api/patient (phase 2).
  const typePatientDefaut: number | null = typesPatient[0]?.id ?? null;

  // Mutuelles actives du serveur (datalist — phase 5 B3) : la saisie
  // reste libre (200+ organismes, liste jamais bloquante), le serveur
  // SUGGÈRE les noms et % de couverture officiels.
  const { mutuelles: mutuellesServeur } = useMutuellesRdc();

  // Mutuelle (édition inline)
  const [mutoOrganisme, setMutoOrganisme] = useState('');
  const [mutoPct, setMutoPct] = useState<number>(0);
  const [mutoNumero, setMutoNumero] = useState('');

  // Fiche : cherche d'abord dans la liste fusionnée (local ∪ serveur).
  const patient: Patient | null = useMemo(
    () => liste.patients.find((p) => p.id === patientId) ?? null,
    [liste.patients, patientId],
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

      {/* Liste partielle ? Le personnel doit savoir que le serveur
          n'a pas répondu (jamais d'écran qui prétend tout afficher). */}
      {liste.erreurServeur ? (
        <p className={styles.meta} role="status" style={{ marginTop: 8 }}>
          Serveur injoignable — seuls les patients de cette session sont affichés.
          <Button type="link" onClick={liste.recharger}>Réessayer</Button>
        </p>
      ) : null}

      <RecherchePatient
        patients={liste.patients}
        onSelect={selectionner}
        onCreer={(requete) => { setFormOuvert(true); setRequeteInitiale(requete); }}
      />

      {formOuvert ? (
        <div style={{ marginTop: 16 }}>
          <FormulaireCreationRapide
            requeteInitiale={requeteInitiale}
            typePatientDefaut={typePatientDefaut}
            onCree={(p) => {
              setFormOuvert(false);
              // Sync immédiate si en ligne : le POST /api/patient part
              // dans la foulée (hors ligne, l'outbox rejettera au retour
              // réseau — badge « en attente » visible).
              void lancerSynchronisation();
              message.success(`Patient créé — dossier ${p.id}. L'adresse et le téléphone sont modifiables plus tard.`);
              setSearchParams({ patient: p.id });
            }}
            onAnnule={() => setFormOuvert(false)}
          />
        </div>
      ) : null}

      {/* ---------- FICHE PATIENT ---------- */}
      {patient && !formOuvert ? (
        <>
          <section className={styles.card} style={{ marginTop: 16 }} aria-label="Fiche patient">
            <div className={styles.row} style={{ marginBottom: 12 }}>
              <h2 className={styles.cardTitle} style={{ margin: 0 }}>
                {patient.nom} {patient.prenom}
              </h2>
              <span className={styles.badge + ' ' + styles.info}>
                Dossier <span className={styles.dossier}>{patient.id}</span>
              </span>
              {patient.source === 'api' ? (
                <span className={styles.badge}>Fiche serveur</span>
              ) : null}
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
                    list="rdc-mutuelles"
                  />
                  <datalist id="rdc-mutuelles">
                    {mutuellesServeur.map((m) => (
                      <option key={m.id} value={m.nomOrganisme}>
                        {`Couverture ${m.tauxCouverture} %`}
                      </option>
                    ))}
                  </datalist>
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

          {/* Fiche 360° — historique des passages (phase 2, item 3) */}
          <HistoriquePassages patientId={patient.id} />
        </>
      ) : null}

      {/* ---------- PATIENTS RÉCENTS ---------- */}
      {!patient && !formOuvert ? (
        <section className={styles.card} style={{ marginTop: 16 }} aria-label="Patients récents">
          <h2 className={styles.cardTitle}>Patients récents</h2>
          {liste.patients.slice(0, 8).map((p) => (
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
