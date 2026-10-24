/**
 * ÉCRAN 5/5 — Pharmacie « Scan & Go » (brief RDC 3.5)
 * - écran unique : file d'attente des ordonnances + vente directe
 *   (patient externe sans consultation — très courant en RDC) ;
 * - chaque ligne : médicament, quantité, prix, STOCK RESTANT
 *   (rouge = rupture, orange = stock bas, vert = dispo) ;
 * - "Délivrer" décrémente le stock et génère le ticket ;
 * - si rupture : blocage + alternative thérapeutique de même
 *   classe en un clic (brief RDC 1.5).
 */

import { useMemo, useState } from 'react';
import { Button, InputNumber, message } from 'antd';
import styles from './rdc.module.scss';
import { EnTeteRDC, ModalApercu, MoneyDual, StockBadge } from './components';
import {
  useRdcState, delivrerOrdonnance, substituerLigne, vendreDirecte,
  statutStock, trouverAlternative, type ResultatDelivrance,
} from './data/rdcStore';
import { getTaux } from './data/money';
import type { Medicament } from './data/types';
import { TicketVente } from './printDocuments';

interface LigneVente { medicamentId: string; quantite: number }

export default function PharmacieRDC() {
  const state = useRdcState();
  const taux = getTaux();

  const [ticket, setTicket] = useState<{
    lignes: Array<{ nom: string; quantite: number; prixUsd: number }>;
    totalUsd: number;
    patientNom?: string;
  } | null>(null);

  const [echecDelivrance, setEchecDelivrance] = useState<Record<string, ResultatDelivrance>>({});

  // Vente directe
  const [lignesVente, setLignesVente] = useState<LigneVente[]>([]);
  const [medChoisi, setMedChoisi] = useState('');
  const [qteChoisie, setQteChoisie] = useState<number>(1);
  const [clientNom, setClientNom] = useState('');

  const alertes = useMemo(() => {
    const rupture = state.medicaments.filter((m) => statutStock(m) === 'rupture');
    const bas = state.medicaments.filter((m) => statutStock(m) === 'bas');
    return { rupture, bas };
  }, [state.medicaments]);

  const enAttente = state.ordonnances.filter((o) => o.statut === 'en_attente');
  const delivrees = state.ordonnances.filter((o) => o.statut === 'delivree').slice(0, 3);

  const totalVente = lignesVente.reduce((s, l) => {
    const med = state.medicaments.find((m) => m.id === l.medicamentId);
    return s + (med ? med.prixUsd * l.quantite : 0);
  }, 0);

  function nomPatient(patientId: string): string {
    const p = state.patients.find((x) => x.id === patientId);
    return p ? `${p.nom} ${p.prenom}` : patientId;
  }

  function medParId(id: string): Medicament | undefined {
    return state.medicaments.find((m) => m.id === id);
  }

  function delivrer(ordonnanceId: string) {
    const res = delivrerOrdonnance(ordonnanceId);
    const ordonnance = state.ordonnances.find((o) => o.id === ordonnanceId);
    if (!ordonnance) return;
    if (res.ok) {
      setEchecDelivrance((prev) => {
        const next = { ...prev };
        delete next[ordonnanceId];
        return next;
      });
      const lignesTicket = ordonnance.lignes.map((l) => {
        const med = medParId(l.medicamentId);
        return { nom: med?.nom ?? l.medicamentId, quantite: l.quantite, prixUsd: med?.prixUsd ?? 0 };
      });
      setTicket({
        lignes: lignesTicket,
        totalUsd: lignesTicket.reduce((s, l) => s + l.quantite * l.prixUsd, 0),
        patientNom: nomPatient(ordonnance.patientId),
      });
      message.success(`Ordonnance délivrée — stock mis à jour, ticket généré (${ordonnance.id}).`);
    } else {
      setEchecDelivrance((prev) => ({ ...prev, [ordonnanceId]: res }));
      message.error('Délivrance bloquée : au moins un médicament est en rupture. Substituez ou réapprovisionnez.');
    }
  }

  function ajouterLigneVente() {
    if (!medChoisi) return;
    setLignesVente((prev) => {
      const existante = prev.find((l) => l.medicamentId === medChoisi);
      if (existante) {
        return prev.map((l) => (l.medicamentId === medChoisi ? { ...l, quantite: l.quantite + qteChoisie } : l));
      }
      return [...prev, { medicamentId: medChoisi, quantite: qteChoisie }];
    });
    setMedChoisi('');
    setQteChoisie(1);
  }

  function encaisserVenteDirecte() {
    if (lignesVente.length === 0) return;
    const res = vendreDirecte(lignesVente);
    if (!res.ok) {
      const noms = res.ruptures.map((r) => r.nom).join(', ');
      message.error(`Stock insuffisant pour : ${noms}. Réduisez la quantité ou choisissez l'alternative.`);
      return;
    }
    const lignesTicket = lignesVente.map((l) => {
      const med = medParId(l.medicamentId);
      return { nom: med?.nom ?? l.medicamentId, quantite: l.quantite, prixUsd: med?.prixUsd ?? 0 };
    });
    setTicket({ lignes: lignesTicket, totalUsd: totalVente, patientNom: clientNom.trim() || 'Vente directe' });
    setLignesVente([]);
    setClientNom('');
    message.success('Vente encaissée — stock mis à jour, ticket généré.');
  }

  return (
    <main className={styles.page}>
      <EnTeteRDC
        titre="Pharmacie"
        sousTitre="File d'attente des ordonnances + vente directe — stock en temps réel"
      />

      {alertes.rupture.length > 0 || alertes.bas.length > 0 ? (
        <div className={`${styles.alerteBar} ${alertes.rupture.length > 0 ? styles.alerteBarRouge : ''}`} style={{ marginBottom: 16 }}>
          {alertes.rupture.length > 0 ? `🔴 ${alertes.rupture.length} rupture(s) : ${alertes.rupture.map((m) => m.nom).join(', ')}` : null}
          {alertes.rupture.length > 0 && alertes.bas.length > 0 ? ' — ' : null}
          {alertes.bas.length > 0 ? `🟠 ${alertes.bas.length} stock(s) bas : ${alertes.bas.map((m) => m.nom).join(', ')}` : null}
        </div>
      ) : null}

      <div className={styles.pharmaGrid}>
        {/* ---------- FILE D'ATTENTE ---------- */}
        <section aria-label="File d'attente des ordonnances">
          <h2 className={styles.cardTitle}>File d'attente ({enAttente.length})</h2>
          {enAttente.length === 0 ? (
            <div className={styles.card}>Aucune ordonnance en attente. Les ordonnances de l'écran Consultation arrivent ici.</div>
          ) : null}
          {enAttente.map((o) => {
            const echec = echecDelivrance[o.id];
            return (
              <div key={o.id} className={styles.carteOrdonnance}>
                <div className={styles.row} style={{ marginBottom: 8 }}>
                  <strong>{nomPatient(o.patientId)}</strong>
                  <span className={styles.dossier}>{o.patientId}</span>
                  <span className={styles.meta}>{o.medecin} · {new Date(o.dateIso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  <div className={styles.spacer} />
                  <Button type="primary" onClick={() => delivrer(o.id)}>Délivrer</Button>
                </div>
                {o.lignes.map((l, i) => {
                  const med = medParId(l.medicamentId);
                  return (
                    <div key={`${o.id}-${i}`} className={styles.ligneMed}>
                      <span className={styles.nomMed}>{med?.nom ?? l.medicamentId}</span>
                      <span className={styles.meta}>{l.posologie} · {l.dureeJours} j</span>
                      {med ? <StockBadge medicament={med} /> : null}
                      <span className={styles.prix}><MoneyDual usd={(med?.prixUsd ?? 0) * l.quantite} taux={taux} /></span>
                    </div>
                  );
                })}
                {echec && !echec.ok ? (
                  <div className={styles.stack} style={{ marginTop: 8 }}>
                    {echec.ruptures.map((r, i) => {
                      const alt = r.alternative;
                      return (
                        <div key={i} className={styles.alternative}>
                          🔴 {r.nom} — stock insuffisant.
                          {alt ? (
                            <>
                              {' '}Alternative (même classe) : <strong>{alt.nom}</strong>
                              <Button size="small" style={{ marginLeft: 8 }} onClick={() => { substituerLigne(o.id, r.medicamentId, alt.id); message.info(`Ligne substituée par ${alt.nom}.`); }}>
                                Substituer
                              </Button>
                            </>
                          ) : (
                            ' Aucune alternative de même classe en stock.'
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}

          {delivrees.length > 0 ? (
            <>
              <h2 className={styles.cardTitle} style={{ marginTop: 16 }}>Délivrées récemment</h2>
              {delivrees.map((o) => (
                <div key={o.id} className={`${styles.carteOrdonnance} ${styles.delivree}`}>
                  <div className={styles.row}>
                    <strong>{nomPatient(o.patientId)}</strong>
                    <span className={styles.dossier}>{o.patientId}</span>
                    <span className={styles.badge + ' ' + styles.ok}>Délivrée</span>
                    <span className={styles.meta}>{o.lignes.length} ligne(s)</span>
                  </div>
                </div>
              ))}
            </>
          ) : null}
        </section>

        {/* ---------- VENTE DIRECTE ---------- */}
        <section className={styles.card} aria-label="Vente directe">
          <h2 className={styles.cardTitle}>Vente directe (patient externe)</h2>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Nom du client (optionnel)
            <input
              className={styles.rechercheInput}
              style={{ minHeight: 48, marginTop: 4 }}
              value={clientNom}
              onChange={(e) => setClientNom(e.target.value)}
              placeholder="Ex. : Maman Bakala"
            />
          </label>
          <div className={styles.row}>
            <label style={{ flex: '1 1 260px' }}>
              Médicament
              <select
                className={styles.rechercheInput}
                style={{ minHeight: 48, marginTop: 4 }}
                value={medChoisi}
                onChange={(e) => setMedChoisi(e.target.value)}
              >
                <option value="">— Choisir —</option>
                {state.medicaments.map((m) => (
                  <option key={m.id} value={m.id} disabled={m.stock <= 0}>
                    {m.nom} — stock {m.stock}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantité
              <InputNumber
                min={1}
                value={qteChoisie}
                onChange={(v) => setQteChoisie(v ?? 1)}
                style={{ width: 90, marginTop: 4 }}
              />
            </label>
            <Button style={{ marginTop: 24 }} onClick={ajouterLigneVente} disabled={!medChoisi}>➕ Ajouter</Button>
          </div>

          {lignesVente.map((l) => {
            const med = medParId(l.medicamentId);
            if (!med) return null;
            const insuffisant = med.stock < l.quantite;
            const alt = insuffisant ? trouverAlternative(med.id) : null;
            return (
              <div key={l.medicamentId} className={styles.ligneMed} style={{ marginTop: 8 }}>
                <span className={styles.nomMed}>{med.nom}</span>
                <span className={styles.meta}>x {l.quantite}</span>
                <StockBadge medicament={med} />
                <span className={styles.prix}><MoneyDual usd={med.prixUsd * l.quantite} taux={taux} /></span>
                <Button size="small" danger onClick={() => setLignesVente((prev) => prev.filter((x) => x.medicamentId !== l.medicamentId))} aria-label={`Retirer ${med.nom}`}>✕</Button>
                {insuffisant ? (
                  <div className={styles.alternative} style={{ width: '100%' }}>
                    Stock insuffisant ({med.stock} restant).
                    {alt ? <> Alternative : <strong>{alt.nom}</strong> (stock {alt.stock}).</> : null}
                  </div>
                ) : null}
              </div>
            );
          })}

          <div className={styles.totalLigne} style={{ marginTop: 12 }}>
            <span className={styles.label}>Total à encaisser</span>
            <MoneyDual usd={totalVente} taux={taux} fort />
          </div>
          <Button
            type="primary"
            size="large"
            block
            disabled={lignesVente.length === 0 || totalVente <= 0}
            onClick={encaisserVenteDirecte}
          >
            💰 Encaisser et imprimer le ticket
          </Button>
        </section>
      </div>

      <ModalApercu
        ouvert={ticket !== null}
        titre="Ticket pharmacie"
        onFermer={() => setTicket(null)}
      >
        {ticket ? (
          <TicketVente lignes={ticket.lignes} totalUsd={ticket.totalUsd} taux={taux} reference="PHARMA" patientNom={ticket.patientNom} />
        ) : null}
      </ModalApercu>
    </main>
  );
}
