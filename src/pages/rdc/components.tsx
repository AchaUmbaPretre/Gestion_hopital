/**
 * Composants partagés des écrans RDC.
 * Zéro lib concurrente d'Ant Design (règle IA) : AntD pour les
 * primitives, tokens sémantiques + CSS modules pour l'habillage.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Modal } from 'antd';
import { useNavigate } from 'react-router-dom';
import styles from './rdc.module.scss';
import {
  addPatient, searchPatients,
} from './data/rdcStore';
import { formatFc, usdToFc } from './data/money';
import type { Medicament, Patient } from './data/types';
import { statutStock, type StatutStock } from './data/rdcStore';
import { useOnlineStatus, type StatutConnexion } from './hooks';
import { SyncBadge } from '../../offline/SyncBadge';

// ------------------------------------------------------------
// Debounce 250 ms (brief RDC 3.2 — recherche instantanée)
// ------------------------------------------------------------
function useDebounced<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

// ------------------------------------------------------------
// Indicateur de connexion permanent (brief RDC 4.1)
// ------------------------------------------------------------
const CONNEXION_LABEL: Record<StatutConnexion, string> = {
  en_ligne: '🟢 En ligne',
  degrade: '🟠 Mode dégradé',
  hors_ligne: '🔴 Hors ligne',
};

export function StatutConnexionBadge() {
  const statut = useOnlineStatus();
  return (
    <span className={`${styles.connexion} ${styles[statut]}`} role="status" aria-live="polite">
      {CONNEXION_LABEL[statut]}
    </span>
  );
}

// ------------------------------------------------------------
// En-tête d'écran : titre + retour accueil + connexion
// ------------------------------------------------------------
export function EnTeteRDC({
  titre, sousTitre, actions,
}: { titre: string; sousTitre?: string; actions?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className={styles.pageHeader}>
      <div>
        <h1 className={styles.pageHeaderTitle}>{titre}</h1>
        {sousTitre ? <p className={styles.pageHeaderSub}>{sousTitre}</p> : null}
      </div>
      <div className={styles.spacer} />
      {actions}
      {/* File d'écriture différée : N en attente / échecs — visible
          en permanence (brief RDC 4.1 : « statut en attente de
          synchronisation », jamais de perte silencieuse). */}
      <SyncBadge />
      <StatutConnexionBadge />
      <Button onClick={() => navigate('/rdc')}>Accueil</Button>
    </header>
  );
}

// ------------------------------------------------------------
// Montant bicolonne FC / USD (brief RDC 1.3 — toujours les deux)
// ------------------------------------------------------------
export function MoneyDual({ usd, taux, fort = false }: { usd: number; taux: number; fort?: boolean }) {
  const fc = usdToFc(usd, taux);
  return (
    <span className={fort ? styles.totalPrincipal : styles.amount} style={fort ? undefined : { fontStyle: 'normal' }}>
      {usd.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $
      <span style={{ color: 'var(--color-text-tertiary)' }}> · </span>
      {formatFc(fc)}
    </span>
  );
}

// ------------------------------------------------------------
// Badge de stock (rouge = rupture, orange = bas, vert = ok)
// ------------------------------------------------------------
const STOCK_LABEL: Record<StatutStock, string> = { ok: 'Disponible', bas: 'Stock bas', rupture: 'Rupture' };

export function StockBadge({ medicament }: { medicament: Medicament }) {
  const s = statutStock(medicament);
  return (
    <span className={`${styles.badge} ${styles[s]}`} title={`Seuil d'alerte : ${medicament.seuil}`}>
      {STOCK_LABEL[s]} — {medicament.stock}
    </span>
  );
}

// ------------------------------------------------------------
// Recherche patient instantanée (≥ 2 caractères, debounce 250 ms)
// + bouton "Créer ce patient" DANS la dropdown (brief RDC 3.2)
// ------------------------------------------------------------
export function RecherchePatient({
  patients,
  onSelect,
  onCreer,
  placeholder = 'Rechercher : nom, prénom, téléphone ou n° dossier…',
}: {
  patients: Patient[];
  onSelect: (p: Patient) => void;
  /** Reçoit la requête tapée (pré-remplissage du formulaire création). */
  onCreer: (requete: string) => void;
  placeholder?: string;
}) {
  const [requete, setRequete] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const requeteDebounced = useDebounced(requete, 250);

  const resultats = useMemo(() => searchPatients(patients, requeteDebounced), [patients, requeteDebounced]);
  const afficher = ouvert && requeteDebounced.length >= 2;

  return (
    <div className={styles.rechercheWrap}>
      <input
        className={styles.rechercheInput}
        type="search"
        value={requete}
        aria-label="Recherche de patient"
        placeholder={placeholder}
        onChange={(e) => { setRequete(e.target.value); setOuvert(true); }}
        onFocus={() => setOuvert(true)}
        onBlur={() => { window.setTimeout(() => setOuvert(false), 150); }}
      />
      {afficher ? (
        <div className={styles.resultats} role="listbox" aria-label="Résultats de recherche">
          {resultats.map((p) => (
            <button
              key={p.id}
              type="button"
              className={styles.resultatItem}
              onMouseDown={(e) => { e.preventDefault(); onSelect(p); setOuvert(false); }}
            >
              <span className={styles.nomPrenom}>{p.nom} {p.prenom}</span>
              <span className={styles.meta}>{p.sexe === 'M' ? 'Homme' : 'Femme'} · {p.ageEstime} an{p.ageEstime > 1 ? 's' : ''}</span>
              {p.telephone ? <span className={styles.meta}>{p.telephone}</span> : null}
              <span className={styles.dossier}>{p.id}</span>
            </button>
          ))}
          <button
            type="button"
            className={styles.creerAction}
            onMouseDown={(e) => { e.preventDefault(); onCreer(requete); setOuvert(false); }}
          >
            ➕ Créer ce patient : «&nbsp;{requete}&nbsp;»
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------
// Formulaire de création rapide (Nom + Prénom + Sexe + Âge estimé)
// ------------------------------------------------------------
export function FormulaireCreationRapide({
  requeteInitiale,
  typePatientDefaut,
  onCree,
  onAnnule,
}: {
  requeteInitiale: string;
  /**
   * FK `typePatient` du POST /api/patient (requis par le schéma
   * MySQL) — premier type exposé par GET /api/patient/type, null si
   * l'API est injoignable (le rejeu échouera alors visiblement).
   */
  typePatientDefaut?: number | null;
  onCree: (p: Patient) => void;
  onAnnule: () => void;
}) {
  const morceaux = requeteInitiale.trim().split(/\s+/);
  const [nom, setNom] = useState(morceaux.length > 1 ? (morceaux[0] ?? '') : requeteInitiale);
  const [prenom, setPrenom] = useState(morceaux.length > 1 ? (morceaux[1] ?? '') : '');
  const [sexe, setSexe] = useState<'M' | 'F'>('M');
  const [age, setAge] = useState<number>(30);
  const [telephone, setTelephone] = useState('');

  const valide = nom.trim().length >= 2 && prenom.trim().length >= 2 && age >= 0;

  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>Création rapide de patient</h3>
      <p className={styles.pageHeaderSub} style={{ marginBottom: 12 }}>
        Seuls Nom, Prénom, Sexe et Âge estimé sont obligatoires. Le reste est modifiable plus tard.
      </p>
      <div className={styles.row}>
        <label>
          Nom&nbsp;*
          <input className={styles.rechercheInput} style={{ minHeight: 48 }} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="NOM" />
        </label>
        <label>
          Prénom&nbsp;*
          <input className={styles.rechercheInput} style={{ minHeight: 48 }} value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Prénom" />
        </label>
        <label>
          Sexe&nbsp;*
          <select className={styles.rechercheInput} style={{ minHeight: 48 }} value={sexe} onChange={(e) => setSexe(e.target.value === 'F' ? 'F' : 'M')}>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </select>
        </label>
        <label>
          Âge estimé&nbsp;*
          <input
            className={styles.rechercheInput}
            style={{ minHeight: 48 }}
            type="number"
            min={0}
            max={120}
            value={age}
            onChange={(e) => setAge(Number(e.target.value) || 0)}
          />
        </label>
        <label>
          Téléphone (optionnel)
          <input className={styles.rechercheInput} style={{ minHeight: 48 }} value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+243 …" />
        </label>
      </div>
      <div className={styles.actionsBas}>
        <Button type="primary" size="large" disabled={!valide} onClick={() => onCree(addPatient({ nom, prenom, sexe, ageEstime: age, telephone }, { idTypePatientDefaut: typePatientDefaut ?? null }))}>
          Créer le patient
        </Button>
        <Button size="large" onClick={onAnnule}>Annuler</Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Aperçu imprimable : Modal + bouton Imprimer (window.print)
// ------------------------------------------------------------
export function ModalApercu({
  ouvert, titre, onFermer, children,
}: { ouvert: boolean; titre: string; onFermer: () => void; children: ReactNode }) {
  return (
    <Modal
      open={ouvert}
      title={titre}
      onCancel={onFermer}
      width={820}
      footer={[
        <Button key="fermer" onClick={onFermer}>Fermer</Button>,
        <Button key="imprimer" type="primary" onClick={() => window.print()}>🖨️ Imprimer</Button>,
      ]}
    >
      {children}
    </Modal>
  );
}
