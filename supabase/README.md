# Supabase

Schema del progetto Event/Macro Studier. Per applicare le migration:

```bash
# via Supabase CLI (linkato a un progetto)
supabase db push

# oppure via SQL editor del dashboard, eseguendo i file in ordine
```

## File

- `migrations/0001_initial_schema.sql` — tabelle, indici, funzione `match_brain_chunks`.

## Note

- L'embedding di default usa **vettori da 1024 dimensioni** (Voyage `voyage-3`).
  Se cambi provider con dimensione diversa, aggiorna `brain_chunks.embedding` e
  `match_brain_chunks` di conseguenza, e ricrea l'indice IVFFlat.
- L'indice IVFFlat con `lists = 100` è ottimale per ~100k chunk. Aumenta `lists`
  con la crescita del corpus.
- `pgvector` deve essere abilitato sul progetto Supabase (dashboard → Database
  → Extensions → vector).
