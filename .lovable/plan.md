## Fase 6 — Promemoria, Commenti/Reazioni ed Export ICS

Obiettivo: chiudere il cerchio sociale del calendario dando agli utenti un modo per ricordarsi gli eventi, discutere e reagire agli impegni, e portarli fuori dall'app in formato standard.

### 1. Promemoria eventi

**Backend**
- Aggiungere alla tabella `events` una colonna `reminder_minutes` (integer, default NULL) che indica quanti minuti prima dell'inizio inviare il promemoria.
- Creare tabella `event_reminders` (`event_id`, `user_id`, `scheduled_at`, `sent_at`) per tracciare quali promemoria sono stati già generati. GRANT + RLS: l'utente vede solo i propri record.
- Creare un job schedulato con `pg_cron` che ogni 5 minuti chiama un endpoint pubblico `/api/public/hooks/send-reminders`.
- L'endpoint, autenticato con `apikey`, trova gli eventi con `reminder_minutes` impostato il cui orario di inizio meno `reminder_minutes` è passato e per cui non esiste ancora una riga in `event_reminders`, e inserisce una notifica in-app di tipo `event_reminder` nella tabella `notifications` per il proprietario dell'evento e per ogni invitato con stato `going`/`maybe`.
- Aggiungere `event_reminder` all'enum `notification_type` e aggiornare trigger/icon se necessario.

**Frontend**
- Nel form evento (`EventForm`) aggiungere un selettore "Promemoria" con opzioni: nessuno, 15 min, 30 min, 1h, 1 giorno.
- Mostrare l'indicatore del promemoria impostato nel dettaglio giorno e nel form.

**Canali aggiuntivi (opzionale, fuori dal percorso base)**
- Notifiche desktop browser: richiedono service worker + chiavi VAPID. Se richiesto, si attiva in un secondo momento.
- Email: richiede un provider esterno (Resend/SendGrid/etc.) e un connector/secrets dedicati. Fuori scope per questa fase a meno che non venga fornito un provider.

### 2. Commenti e reazioni

**Backend**
- Creare tabella `event_comments` (`event_id`, `user_id`, `body`, `created_at`, `updated_at`). GRANT + RLS: chi può vedere l'evento può vedere i commenti; solo l'autore può modificarli/cancellarli.
- Creare tabella `event_reactions` (`event_id`, `user_id`, `reaction`, `created_at`) con unique (`event_id`, `user_id`, `reaction`). GRANT + RLS analoghe.
- Trigger per notificare il proprietario dell'evento quando arriva un nuovo commento o reazione (tipo `event_comment` o `event_reaction`).

**Frontend**
- Aggiungere `EventComments` nel dettaglio giorno, sotto `EventInvites`: lista commenti, input per scriverne uno, bottone elimina per l'autore.
- Aggiungere `EventReactions` con una fila di emoji rapide (es. 🔥 ❤️ 🎉 👍) che mostrano il conteggio e permettono di togglare la propria reazione.
- Invalidare query key `event-comments` / `event-reactions` dopo mutazioni.

### 3. Export ICS

**Backend**
- Creare server route `/api/public/ics/events` (o server fn) che genera un file `.ics` con tutti gli eventi visibili all'utente nel range richiesto.
- Per ogni evento includere: UID, SUMMARY, DTSTART, DTEND (o DURATION), DESCRIPTION, LOCATION, URL.
- Autenticazione tramite `requireSupabaseAuth` se usata come server fn, o `apikey` se chiamata da link pubblico.

**Frontend**
- Aggiungere un pulsante "Esporta / Aggiungi al calendario" nel dettaglio evento e nel form.
- Per il singolo evento: download di un `.ics` con quell'evento.
- Per il periodo: generazione del feed con parametri `from`/`to`.

### 4. Fix e pulizia collaterali

- Verificare che il campo `reminder_minutes` non crei problemi di hydration nell'interfaccia.
- Aggiornare i tipi di `notification_type` in `src/integrations/supabase/types.ts` dopo la migrazione.
- Aggiungere icone e testi per le nuove notifiche in `NotificationsBell.tsx`.

### Dettagli tecnici
- Migrazioni: una per `event_reminders`, `event_comments`, `event_reactions`; una per `ALTER TYPE notification_type ADD VALUE 'event_reminder'`; una per `pg_cron` (da applicare con il tool insert, non migration, perché contiene URL progetto).
- Server fn / route per promemoria: `send-reminders` sotto `src/routes/api/public/hooks/send-reminders.ts`.
- Componenti nuove: `src/components/calendar/EventComments.tsx`, `src/components/calendar/EventReactions.tsx`.
- Nessuna dipendenza npm aggiuntiva per ICS: formato generato manualmente. Se in futuro si aggiunge calcolo timezone complesso, si valuta `date-fns`/`ical-generator`.

### Fuori scope
- Email promemoria (senza provider configurato).
- Notifiche push mobile.
- Integrazione scrittura con Google Calendar / Outlook.

### Nota su GitHub sync
Il codice prodotto è compatibile con il sync GitHub di Lovable. Per farlo analizzare da Claude, collega prima il progetto dalla UI: **+ → GitHub → Connect project**. Dopo il collegamento, ogni modifica verrà pushata automaticamente nel repository.