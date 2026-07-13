## Fase 5 — Notifiche & realtime, Ricerca & scoperta, Inviti eventi

### 1. Notifiche & realtime

**Backend**
- Nuova tabella `notifications` (user_id destinatario, actor_id, type: `follow_request` | `follow_accepted` | `event_invite` | `event_rsvp` | `event_reminder`, entity_type, entity_id, read_at, created_at).
- RLS: il destinatario legge/aggiorna/cancella le proprie; insert consentito ad `authenticated` con `actor_id = auth.uid()`.
- Trigger su `follows` (INSERT → notifica al followee; UPDATE a `accepted` → notifica al follower).
- Trigger su `event_invites` (nuova tabella, vedi §3) → notifica all'invitato; su UPDATE dello stato RSVP → notifica al proprietario dell'evento.
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications`.

**Frontend**
- Icona campanella nell'header (`AppShell`) con badge conteggio non lette; popover con lista, tap → naviga alla risorsa e marca come letta.
- Hook `useNotifications` con subscribe realtime (in `useEffect`, cleanup su unmount) + invalidazione TanStack Query.

### 2. Ricerca & scoperta

- Barra di ricerca globale in cima alla pagina **Amici** (tab "Persone").
- Server fn `searchProfiles(query)` che filtra su `username` e `display_name` (ILIKE), esclude sé stessi, mostra stato relazione (segui / richiesta pendente / da seguire).
- Sezione "Suggeriti" sotto la ricerca: profili aperti recenti che l'utente non segue ancora (limite 10).
- Ricerca eventi condivisi con me nella pagina Calendario tramite un input opzionale (deferibile a follow-up).

### 3. Condivisione eventi & inviti

**Backend**
- Nuova tabella `event_invites` (event_id, invitee_id, status: `pending` | `going` | `maybe` | `declined`, invited_by, timestamps). Unique (event_id, invitee_id).
- RLS: l'invitato vede/aggiorna la propria riga; il proprietario dell'evento vede tutte le righe del proprio evento e può inserire/cancellare inviti (solo verso persone che lo seguono o che segue).
- Estensione tabella `events`: nulla di nuovo, riusiamo `visibility` esistente. Gli eventi con almeno un invito diventano visibili all'invitato tramite policy SELECT aggiuntiva su `events` (`EXISTS event_invites WHERE invitee_id = auth.uid()`).
- GRANT completi + trigger updated_at.

**Frontend**
- Nel form evento (`EventForm`): sezione "Invita amici" con multi-select tra gli amici accettati.
- Nel dettaglio evento (giorno/settimana): elenco partecipanti con stato RSVP; se sono l'invitato mostro pulsanti Partecipo / Forse / No.
- Nel feed Amici (tab Feed): mostro anche eventi pubblici degli utenti seguiti + inviti ricevuti in cima con azioni rapide.

### 4. Fix collaterale (silenzioso)
- Sistemare hydration mismatch su `AuthPage` e `AppShell` (Suspense SSR vuoto → div reale al mount): rendere il markup deterministico rimuovendo branch client-only nel primo render.

### Dettagli tecnici
- Migrazioni separate per: `notifications` + trigger, `event_invites` + policy estesa su `events`.
- Client Supabase browser per subscribe realtime; server fn autenticate per tutte le mutation (invita, rispondi, marca letta, cerca).
- Query keys: `["notifications"]`, `["search-profiles", q]`, `["event-invites", eventId]`, invalidate mirate dopo mutation.
- Nessun nuovo asset o dipendenza npm richiesti.

### Fuori scope (per fase successiva)
- Promemoria push / email.
- Notifiche desktop del browser.
- Ricerca full-text su liste ed eventi.
