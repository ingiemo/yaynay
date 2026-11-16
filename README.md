# YayNay

En enkel nettapp (PWA) for privat bruk.

Data lagres bare lokalt i nettleseren. Ingen server, ingen innlogging.

## Teknisk

Ren HTML, CSS og JavaScript uten byggesteg. Virker offline.

- Test lokalt: `python3 -m http.server 5174 --bind 127.0.0.1` (legg til `?sw` for å teste offline)
- Ny versjon: øk `VERSION` i `sw.js`, og legg nye filer inn i `FILES`
