/**
 * Documents imprimables RDC — pattern .print-zone (typography.scss).
 *  - Reçu / facture     : A4, caisse
 *  - Ordonnance         : A5, consultation (posologie en gras)
 *  - Fiche carnet       : A4, fiche patient synthétique (le carnet
 *    papier appartient au patient en RDC — brief 1.4)
 *  - Ticket de vente    : pharmacie (vente directe)
 *
 * Arial, noir sur blanc ; jamais d'italique sur posologies/montants.
 */

import styles from './print.module.scss';
import { formatFc, formatUsd, usdToFc } from './data/money';
import type { Medicament, MouvementCaisse, Ordonnance, Patient } from './data/types';

function dateFr(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function LigneChamp({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className={styles.champ}>
      <div className={styles.label}>{label}</div>
      <div className={styles.valeur}>{valeur}</div>
    </div>
  );
}

const EN_TETE_HOPITAL = (
  <div className={styles.docHeader}>
    <div className={styles.hopital}>Hôpital Général de Référence</div>
    <div className={styles.dept}>Zone de santé — République Démocratique du Congo</div>
  </div>
);

// ------------------------------------------------------------
// Reçu / facture de caisse (A4)
// ------------------------------------------------------------
export function RecuFacture({ mouvement, patient }: { mouvement: MouvementCaisse; patient: Patient | undefined }) {
  const fc = usdToFc(mouvement.totalUsd, mouvement.tauxFcUsd);
  const estException = mouvement.mode === 'exonere' || mouvement.mode === 'urgence_vitale';
  return (
    <div className={`${styles.doc} print-zone`} id="print-document">
      {EN_TETE_HOPITAL}
      <div className={styles.docTitre}>Reçu de paiement — {mouvement.reference}</div>

      <div className={styles.docGrid}>
        <LigneChamp label="Patient" valeur={patient ? `${patient.nom} ${patient.prenom}` : '—'} />
        <LigneChamp label="N° dossier (carnet)" valeur={patient?.id ?? '—'} />
        <LigneChamp label="Date" valeur={dateFr(mouvement.dateIso)} />
        <LigneChamp label="Mode de paiement" valeur={modePaiementLibelle(mouvement)} />
      </div>

      <table className={styles.docTable}>
        <thead>
          <tr>
            <th>Acte</th>
            <th className={styles.num}>Montant (USD)</th>
            <th className={styles.num}>Montant (FC)</th>
          </tr>
        </thead>
        <tbody>
          {mouvement.lignes.map((l) => (
            <tr key={l.acteId}>
              <td>{l.libelle}</td>
              <td className={styles.num}>{formatUsd(l.montantUsd)}</td>
              <td className={styles.num}>{formatFc(usdToFc(l.montantUsd, mouvement.tauxFcUsd))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.docTotaux}>
        <div className={styles.ligne}><span>Total</span><span>{formatUsd(mouvement.totalUsd)} · {formatFc(fc)}</span></div>
        {mouvement.partMutuelleUsd > 0 ? (
          <div className={styles.ligne}>
            <span>Prise en charge {mouvement.mutuelle?.organisme ?? 'mutuelle'}</span>
            <span>- {formatUsd(mouvement.partMutuelleUsd)}</span>
          </div>
        ) : null}
        <div className={styles.ligne}><span>Ticket modérateur (patient)</span><span>{formatUsd(mouvement.ticketModerateurUsd)}</span></div>
        <div className={styles.ligne}><span>Payé maintenant</span><span>{formatUsd(mouvement.montantPayeUsd)}</span></div>
        {mouvement.soldeUsd > 0 ? (
          <div className={styles.ligne}><span>Échéance (acompte)</span><span>{formatUsd(mouvement.soldeUsd)}</span></div>
        ) : null}
        <div className={styles.ligne + ' ' + styles.fort}>
          <span>{mouvement.soldeUsd > 0 ? 'Reste dû' : 'Solde'}</span>
          <span>{formatUsd(mouvement.soldeUsd)} · {formatFc(usdToFc(mouvement.soldeUsd, mouvement.tauxFcUsd))}</span>
        </div>
      </div>

      {mouvement.mutuelle && mouvement.partMutuelleUsd > 0 ? (
        <div className={styles.docNote}>
          Mutuelle : {mouvement.mutuelle.organisme} — couverture {mouvement.mutuelle.couverturePct} % ·
          adhérent n° {mouvement.mutuelle.numeroAdherent} · taux du jour : 1 USD = {mouvement.tauxFcUsd} FC
        </div>
      ) : (
        <div className={styles.docNote}>Taux du jour : 1 USD = {mouvement.tauxFcUsd} FC</div>
      )}

      {estException ? (
        <div className={styles.docMention}>
          {mouvement.mode === 'urgence_vitale'
            ? 'Prise en charge d\'urgence vitale sans paiement préalable — régularisation a posteriori (arrêté ministériel n°1250/2025)'
            : 'Exonération / prise en charge sociale — patient exonéré'}
          <div style={{ fontWeight: 400, textTransform: 'none' }}>
            Autorisé par : {mouvement.autorisePar ?? '—'} · Motif : {mouvement.motifExoneration ?? '—'}
          </div>
        </div>
      ) : null}

      <div className={styles.docSignature}>
        <div className={styles.sig}>
          Le patient
          <div className={styles.nom}>Signature / empreinte</div>
        </div>
        <div className={styles.sig}>
          Le caissier
          <div className={styles.nom}>Nom et visa</div>
        </div>
      </div>

      <div className={styles.docFooter}>
        Ce reçu est votre preuve de paiement — à conserver dans le carnet du patient.
      </div>
    </div>
  );
}

function modePaiementLibelle(m: MouvementCaisse): string {
  const mode: Record<MouvementCaisse['mode'], string> = {
    totalite: 'Paiement totalité',
    acompte: 'Acompte (solde à la sortie)',
    exonere: 'Exonéré / prise en charge',
    urgence_vitale: 'Urgence vitale (paiement différé)',
  };
  const paiement: Record<NonNullable<MouvementCaisse['modePaiement']>, string> = {
    especes_fc: 'Espèces (FC)',
    especes_usd: 'Espèces (USD)',
    mobile_money: 'Mobile money',
  };
  const p = m.modePaiement ? ` — ${paiement[m.modePaiement]}` : '';
  return `${mode[m.mode]}${p}`;
}

// ------------------------------------------------------------
// Ordonnance (A5)
// ------------------------------------------------------------
export function OrdonnanceDoc({
  ordonnance, patient, medicaments,
}: { ordonnance: Ordonnance; patient: Patient | undefined; medicaments: Medicament[] }) {
  return (
    <div className={`${styles.doc} ${styles.docA5} print-zone print-ordonnance`} id="print-document">
      {EN_TETE_HOPITAL}
      <div className={styles.docTitre}>Ordonnance médicale</div>

      <div className={styles.docGrid}>
        <LigneChamp label="Patient" valeur={patient ? `${patient.nom} ${patient.prenom}` : '—'} />
        <LigneChamp label="N° dossier" valeur={patient?.id ?? '—'} />
        <LigneChamp label="Âge / sexe" valeur={`${patient?.ageEstime ?? '—'} ans · ${patient?.sexe === 'F' ? 'F' : 'M'}`} />
        <LigneChamp label="Date" valeur={dateFr(ordonnance.dateIso)} />
        <LigneChamp label="Service" valeur={ordonnance.service} />
        <LigneChamp label="Médecin" valeur={ordonnance.medecin} />
      </div>

      <table className={styles.docTable}>
        <thead>
          <tr>
            <th style={{ width: '55%' }}>Médicament</th>
            <th>Posologie</th>
            <th className={styles.num}>Qté</th>
          </tr>
        </thead>
        <tbody>
          {ordonnance.lignes.map((l, i) => {
            const med = medicaments.find((m) => m.id === l.medicamentId);
            return (
              <tr key={`${l.medicamentId}-${i}`}>
                <td>{med ? `${med.nom} (${med.forme})` : l.medicamentId}</td>
                <td className={styles.posologie}>
                  {l.posologie} — pendant {l.dureeJours} jour{l.dureeJours > 1 ? 's' : ''}
                </td>
                <td className={styles.num}>{l.quantite}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className={styles.docNote}>
        Présenter cette ordonnance à la pharmacie de l'hôpital. Posologie à respecter strictement.
      </div>

      <div className={styles.docSignature}>
        <div className={styles.sig}>
          Signature du médecin
          <div className={styles.nom}>{ordonnance.medecin}</div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Fiche patient synthétique — carnet (A4)
// ------------------------------------------------------------
export function FicheCarnet({ patient }: { patient: Patient }) {
  return (
    <div className={`${styles.doc} print-zone`} id="print-document">
      {EN_TETE_HOPITAL}
      <div className={styles.docTitre}>Fiche patient — carnet</div>

      <div className={styles.docGrid}>
        <LigneChamp label="N° dossier" valeur={patient.id} />
        <LigneChamp label="Nom et prénom" valeur={`${patient.nom} ${patient.prenom}`} />
        <LigneChamp label="Sexe" valeur={patient.sexe === 'F' ? 'Féminin' : 'Masculin'} />
        <LigneChamp label="Âge estimé" valeur={`${patient.ageEstime} an${patient.ageEstime > 1 ? 's' : ''}`} />
        <LigneChamp label="Téléphone" valeur={patient.telephone || '—'} />
        <LigneChamp label="Adresse" valeur={patient.adresse || '—'} />
        <LigneChamp label="Mutuelle" valeur={patient.mutuelle ? `${patient.mutuelle.organisme} (${patient.mutuelle.couverturePct} %) — n° ${patient.mutuelle.numeroAdherent}` : '—'} />
        <LigneChamp label="Statut" valeur={patient.exonere ? 'EXONÉRÉ / prise en charge sociale' : patient.refere ? 'Référé (centre de santé)' : 'Patient ordinaire'} />
      </div>

      <div className={styles.docNote}>
        Ce document résume l'identification du patient pour le carnet papier qu'il détient.
        Toute consultation, hospitalisation ou référence doit être notée dans ce carnet.
      </div>

      <div className={styles.docSignature}>
        <div className={styles.sig}>
          Le service d'accueil
          <div className={styles.nom}>Visa</div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Ticket de vente pharmacie (vente directe)
// ------------------------------------------------------------
export function TicketVente({
  lignes, totalUsd, taux, reference, patientNom,
}: {
  lignes: Array<{ nom: string; quantite: number; prixUsd: number }>;
  totalUsd: number;
  taux: number;
  reference: string;
  patientNom?: string;
}) {
  return (
    <div className={`${styles.doc} print-zone`} id="print-document">
      {EN_TETE_HOPITAL}
      <div className={styles.docTitre}>Ticket pharmacie — {reference}</div>
      {patientNom ? (
        <div className={styles.docGrid}>
          <LigneChamp label="Client / patient" valeur={patientNom} />
          <LigneChamp label="Date" valeur={dateFr(new Date().toISOString())} />
        </div>
      ) : null}
      <table className={styles.docTable}>
        <thead>
          <tr>
            <th>Médicament</th>
            <th className={styles.num}>Qté</th>
            <th className={styles.num}>PU (USD)</th>
            <th className={styles.num}>Total (USD)</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={`${l.nom}-${i}`}>
              <td>{l.nom}</td>
              <td className={styles.num}>{l.quantite}</td>
              <td className={styles.num}>{formatUsd(l.prixUsd)}</td>
              <td className={styles.num}>{formatUsd(l.quantite * l.prixUsd)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} style={{ fontWeight: 700 }}>Total</td>
            <td className={styles.num} style={{ fontWeight: 700 }}>{formatUsd(totalUsd)}</td>
          </tr>
        </tbody>
      </table>
      <div className={styles.docTotaux}>
        <div className={styles.ligne + ' ' + styles.fort}>
          <span>À payer</span>
          <span>{formatUsd(totalUsd)} · {formatFc(usdToFc(totalUsd, taux))}</span>
        </div>
      </div>
      <div className={styles.docNote}>Taux du jour : 1 USD = {taux} FC — Merci.</div>
    </div>
  );
}
