/**
 * AppRouter — routes centralisées (étape 3.5).
 * - Chaque page = React.lazy → code splitting par route (brief perf :
 *   cible < 300 KB gzip initial vs 696 KB baseline).
 * - Fallback Suspense : PageFallback (skeleton, zéro layout shift).
 * - RequireAuth : même logique que l'ancien SecureRoute (redux user).
 * - Catch-all : les routes héritées sans destination
 *   (/historique_paiement, /rapports_activite…) redirigent vers
 *   l'accueil au lieu d'une zone vide (jamais de cul-de-sac).
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import AppShell from '../shell/AppShell';
import { PageFallback } from '../shell/PageFallback';

// ---------- Pages (code splitting) ----------
const Login = lazy(() => import('../../pages/login/Login'));
const Register = lazy(() => import('../../pages/register/Register'));
const RightBar = lazy(() => import('../../pages/rightBar/RightBar'));
const DocteurForm = lazy(() => import('../../pages/docteur/docteurForm/DocteurForm'));
const ListeDocteur = lazy(() => import('../../pages/docteur/ListeDocteur/ListeDocteur'));
const Utilisateur = lazy(() => import('../../pages/utilisateur/Utilisateur'));
const PatientForm = lazy(() => import('../../pages/patient/form/PatientForm'));
const Patient = lazy(() => import('../../pages/patient/Patient'));
const FormService = lazy(() => import('../../pages/service/formService/FormService'));
const Service = lazy(() => import('../../pages/service/Service'));
const Consultation = lazy(() => import('../../pages/consultation/Consultation'));
const ListeConsultation = lazy(() => import('../../pages/consultation/listeConsultation/ListeConsultation'));
const Admission = lazy(() => import('../../pages/admission/Admission'));
const Traitement = lazy(() => import('../../pages/traitement/Traitement'));
const ListePrescriptionLabo = lazy(() => import('../../pages/labo/listePrescriptionLabo/ListePrescriptionLabo'));
const Labo = lazy(() => import('../../pages/labo/Labo'));
const Medicament = lazy(() => import('../../pages/medicament/Medicament'));
const Ordonnance = lazy(() => import('../../pages/ordonnance/Ordonnance'));
const Factures = lazy(() => import('../../pages/factures/Factures'));
const Paiement = lazy(() => import('../../pages/paiement/Paiement'));
const Rdv = lazy(() => import('../../pages/rdv/Rdv'));

// ---------- Écrans cœur RDC (prototype — brief RDC 2026) ----------
// Non destructif : les 20 routes héritées restent intactes ; le
// nouveau parcours métier RDC vit sous /rdc/* (accueil, patients,
// caisse, consultation, pharmacie) — voir docs/RDC_BUSINESS_LOGIC.md
// et docs/MIGRATION_PLAN.md pour la bascule finale.
const AccueilRDC = lazy(() => import('../../pages/rdc/AccueilRDC'));
const PatientsRDC = lazy(() => import('../../pages/rdc/PatientsRDC'));
const CaisseRDC = lazy(() => import('../../pages/rdc/CaisseRDC'));
const ConsultationRDC = lazy(() => import('../../pages/rdc/ConsultationRDC'));
const PharmacieRDC = lazy(() => import('../../pages/rdc/PharmacieRDC'));

/** Garde d'authentification — parité avec l'ancien SecureRoute. */
function RequireAuth({ children }: { children: ReactNode }) {
  const user = useSelector((state: { user?: { currentUser?: unknown } }) => state.user?.currentUser);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function lazyPage(Component: React.LazyExoticComponent<React.ComponentType>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Component />
    </Suspense>
  );
}

export function AppRouter() {
  const router = createBrowserRouter([
    {
      path: '/',
      element: <RequireAuth><AppShell /></RequireAuth>,
      children: [
        { index: true, element: lazyPage(RightBar) },
        { path: 'form_personnel', element: lazyPage(DocteurForm) },
        { path: 'liste_docteur', element: lazyPage(ListeDocteur) },
        { path: 'form_user', element: lazyPage(Utilisateur) },
        { path: 'liste_user', element: lazyPage(Utilisateur) },
        { path: 'form_patient', element: lazyPage(PatientForm) },
        { path: 'liste_patient', element: lazyPage(Patient) },
        { path: 'form_service', element: lazyPage(FormService) },
        { path: 'liste_service', element: lazyPage(Service) },
        { path: 'consultation', element: lazyPage(Consultation) },
        { path: 'liste_consultation', element: lazyPage(ListeConsultation) },
        { path: 'admission', element: lazyPage(Admission) },
        { path: 'traitement', element: lazyPage(Traitement) },
        { path: 'prescription_labo', element: lazyPage(ListePrescriptionLabo) },
        { path: 'labo', element: lazyPage(Labo) },
        { path: 'medicament', element: lazyPage(Medicament) },
        { path: 'ordonnance', element: lazyPage(Ordonnance) },
        { path: 'factures', element: lazyPage(Factures) },
        { path: 'paiement', element: lazyPage(Paiement) },
        { path: 'liste_rdv', element: lazyPage(Rdv) },
        // ---- Parcours RDC (prototype) ----
        { path: 'rdc', element: lazyPage(AccueilRDC) },
        { path: 'rdc/patients', element: lazyPage(PatientsRDC) },
        { path: 'rdc/caisse', element: lazyPage(CaisseRDC) },
        { path: 'rdc/consultation', element: lazyPage(ConsultationRDC) },
        { path: 'rdc/pharmacie', element: lazyPage(PharmacieRDC) },
      ],
    },
    { path: '/login', element: lazyPage(Login) },
    { path: '/register', element: lazyPage(Register) },
    { path: '*', element: <Navigate to="/" replace /> },
  ]);

  return <RouterProvider router={router} />;
}

AppRouter.displayName = 'AppRouter';
export default AppRouter;
