# LocationScout BETA — Handoff

## TL;DR

- **Repo**: `LocationScout-Base` — содержит И backend (`src/`), И frontend (`src/ui/`).
  Это один и тот же git-репозиторий, единая ветка содержит обе части.
- **Ветка**: `experiment/beta-2-screens` (от `main`). Локальная, **не запушена**.
- **Состояние**: 4 коммита, всё чисто (working tree clean кроме pre-existing main-uncommitted в `.env.example`, `package.json.tmp`, `_observability/`, `setup-planner-system.md`, `src/ui/package-lock.json` — это не наше).

```
c49902d  beta: only floorplan auto-generates; Cancel buttons; continuity prompts
7f11506  beta: drop Input screen — 2 visible stages (References, Setups)
92f3761  beta: e2e test results — full pipeline A-H PASS
1d7a08c  beta: 2-screen UI + auto-approved Bible pipeline
```

## Что в ветке

### Видимая UI

2 экрана: **References** (на `/`) → **Setups** (на `/setups`).
Скрыты: Input, Research, Analysis (Bible review), Light/States (Mood states), Outputs.

### Бэк-генерация автоматическая ТОЛЬКО для:

- `scout_location` → строит Bible (фон, при загрузке приложения через `BetaAutoBoot`). Bible сразу идёт с `approval_status: "approved"`.
- `create_floorplan` → стартует автоматически когда юзер заходит на References.

Всё остальное (`generate_isometric_reference`, `generate_anchor`, `generate_setup_images`) — **только по кнопке Regenerate**.

### Валидация и retry

`generate_anchor` теперь по умолчанию `validation.enabled = false`, `max_attempts = 1`. Никаких VLM-проверок и автоматических ретраев. Их планируется выделить в отдельный инструмент / пользовательское действие — см. ниже.

### Cancel

При активной генерации (floorplan / isometric / anchor / setup batch) рядом с прогрессом видна кнопка **Cancel**. Под капотом — `cancel_task` MCP tool. Polling-loop сам переведёт UI в `missing`/`error` после отмены.

### Промпт-continuity

В шаблонах `src/prompts/generate-{isometric,anchor,setup}-system.md` теперь явный блок **KEY FACTS — MUST PRESERVE** с критическими фактами из Bible:

- Isometric: размеры, форма, окна/двери — из флорплана.
- Anchor: размеры, time of day, lighting, atmosphere, key_details — из Bible; continuity к floorplan+isometric.
- Setup: то же что в anchor, плюс «та же комната, мебель и свет, что и на anchor-картинке».

Это не валидация — просто более жёсткие инструкции для модели генерации.

## Как запустить локально (Windows)

Требует `.env` в корне `LocationScout-Base` с:
- `ANTHROPIC_API_KEY=...`
- `FAL_AI_API_KEY=...`
- `INTER_AGENT_TOKEN=1234` (любой непустой; Vite-прокси сам подставит этот токен в запросы)
- `PORT=8080`
- `AGENT_EDITOR_URL` и `FAL_MODEL_*` — любые непустые (чтобы `predev` чек прошёл)

Два терминала. PowerShell блокирует `npm.ps1` — используй `npm.cmd` или Git Bash.

**Терминал 1 — backend (порт 8080):**

```powershell
cd C:\path\to\LocationScout-Base
$env:ENABLED_TOOLS = "scout_location,write_bible,create_floorplan,generate_isometric_reference,generate_anchor,extract_setups,generate_setup_images,get_bible,get_setup_prompt,get_outputs,assemble_anchor_prompt,assemble_isometric_prompt,assemble_setup_prompt,list_versions,compare_with_anchor,get_upstream_gates,ping,get_info,get_task_status,get_task_result,cancel_task,approve_artifact,reject_artifact,request_revision,submit_feedback"
npm.cmd run dev
```

Жди `listening on :8080`. Проверь: `curl http://127.0.0.1:8080/health` → `{"status":"ok",...}`.

**Терминал 2 — UI (порт 5176):**

```powershell
cd C:\path\to\LocationScout-Base
npm.cmd run dev:ui
```

**Открой http://localhost:5176/** (именно `localhost`, не `127.0.0.1` — Vite слушает только на IPv6 `[::1]`).

## Сценарий первого запуска

1. Сразу — сплеш «Building location bible…» (~25–35 c). `BetaAutoBoot` фоном вызывает `scout_location` с фикстурой Marlowe (1947 noir LA office). Bible получает `approval_status: approved` и пишется на диск.
2. Появляется References. Хедер: «References › 🔒 Setups».
3. Floorplan генерится автоматически (~5–10 c, Python/matplotlib).
4. Isometric и Anchor — пустые карточки с кнопкой **Regenerate**. Жми когда хочешь.
5. Когда Anchor готов — кнопка **Approve Anchor** разблокирует Setups (через существующую gate-логику).
6. На Setups: каждая карточка пустая, **Regenerate** на каждой. Когда сетапы готовы — внизу зелёная кнопка **Send to Pipeline →** (вместо «View Outputs»). После клика — баннер «✓ Sent to Shot Generation».

Если хочешь свежий прогон, удали артефакты с диска:

```powershell
Remove-Item -Recurse -Force output\location-scout\anchor, output\location-scout\isometric, output\location-scout\setup, output\location-scout\floorplan, output\location-scout\bible, output\location-scout\research, output\location-scout\validation
```

## Карта изменений

### Backend (`src/`)

| Файл | Что |
|------|-----|
| `src/index.ts` | `ENABLED_TOOLS` allow-list оборачивает `server.tool` (BETA hides tools by env var). |
| `src/tools/location.ts` | Step 1 (Research) в `scout_location` закомментирован под `/* BETA */`; Bible payload получает `approval_status: "approved"`; default `validation.enabled = false`, `max_attempts = 1` для `generate_anchor`. |
| `src/lib/prompt-assembly.ts` | новая функция `extractBibleFacts()` извлекает dimensions / time_of_day / light_summary / atmosphere / key_details / negative_list_text. Все три `buildXPromptVars` теперь возвращают continuity-факты. |
| `src/prompts/generate-isometric-system.md` | переписан под KEY FACTS header. |
| `src/prompts/generate-anchor-system.md` | переписан под KEY FACTS header. |
| `src/prompts/generate-setup-system.md` | переписан под KEY FACTS header. |
| `src/prompts/write-bible-pipeline-system.md` | в начало добавлен NOTE: «если Research = (not available), пиши из общих знаний». |

### Frontend (`src/ui/src/`)

| Файл | Что |
|------|-----|
| `src/ui/src/components/BetaAutoBoot.tsx` | новый. Оборачивает `<Routes>`. На mount фоном вызывает `scout_location` с фикстурой; сплеш «Building location bible…» пока крутится; на готовности `dispatch(APPROVE_STAGE input)` → unlocks References. |
| `src/ui/src/components/ReferencePicker.tsx` | rename prop `ref` → `refData` в `Thumbnail` и `LockedThumbnail` (имя `ref` зарезервировано React, тихо стирался). |
| `src/ui/src/stages.ts` | `STAGES` урезан до 2 (References на `/`, Setups). |
| `src/ui/src/state/pipeline.ts` | `STAGE_ORDER` урезан до `["input", "references", "setups"]` (input нужен как gate-prerequisite). |
| `src/ui/src/App.tsx` | импорты `Analysis/LightStates/Outputs/Research/InputPage` закомменчены; `PAGES` 2 записи; `<Routes>` обёрнут в `<BetaAutoBoot>`; catch-all → `/`. |
| `src/ui/src/pages/InputPage.tsx` | в коде остался, не в роутинге. |
| `src/ui/src/pages/ReferencesPage.tsx` | убран auto-fire `generate_isometric_reference` и `generate_anchor` на mount. `AnchorState["generating"]` теперь несёт `task_id`. Cancel-кнопка во всех 3 generating-плейсхолдерах. |
| `src/ui/src/pages/SetupsPage.tsx` | убран auto-fire `generate_setup_images`. `BatchState["generating"]` несёт `task_id`. Cancel в batch-баннере. `handleSend` (BETA "Send to Pipeline") вместо `handleAdvance`. `useNavigate` закомменчен. |
| `src/ui/.env.beta` | feature-flags маркеры (пока не читаются из кода). |

### Корневое

| Файл | Что |
|------|-----|
| `package.json` | убраны `react`, `react-dom`, `react-router-dom`, `@types/react-router-dom` из root deps (двойной React → 0-children mount). |
| `vite.config.ts` | proxy 8083 → 8080; `/artifacts` добавлен; `x-agent-token` инжектится из `INTER_AGENT_TOKEN`. |
| `.claude/launch.json` | `agent-ui` → `location-scout-ui`, port 5173 → 5176. |
| `.env.beta` | `ENABLED_TOOLS=...` allow-list (25 инструментов). |
| `ROLLOUT.md` | новый. Инструкция возврата каждой скрытой фичи (Input, Research, Bible review, Mood states, Outputs). |
| `BETA_TEST_RESULTS.md` | новый. Результаты e2e + iteration 2 browser verification. |

## Что НЕ доделано (TODO для следующего dev)

1. **Валидация** — нужно вынести в отдельный MCP tool (например `validate_anchor` или `audit_anchor`) и UI-кнопку «Validate». Сейчас просто отключено в `generate_anchor`.
2. **«Generate All Missing» button на Setups** — `runBatch` уже есть в коде (`void runBatch` суппрессит TS-warning), нужно привязать к UI-кнопке.
3. **Anchor img2img** — сейчас text-to-image (по дизайну run-019/020). Если нужен img2img из изометрии — пользователь может загрузить isometric как ref через «Upload»/«Gallery». Можно добавить дефолтный auto-attach с отдельным флагом.
4. **`mood_state_uris`** — `extract_setups` принимает массив, я подставляю пустой `[]`. Если нужен Mood states pipeline — раскомментить через ROLLOUT.md.
5. **Хардкод декоративных мет в References** — «GATE 3: Anchor Approved? | VLM Audit | LPIPS < 0.4 | SSIM > 0.6» и «ATTEMPT 1 / 3 (MAX RETRY)» — это статический mock в JSX. Следует убрать или подвязать к реальным данным.
6. **VLM AUDIT блок в Anchor** (LPIPS 0.32, SSIM 0.71, Bible match 94%, Anachronisms 0) — тоже mock-данные в JSX. Динамить по реальной валидации когда она вернётся.
7. **HMR reset state** — каждое HMR-перезагружение в Vite сбрасывает pipeline-state (in-memory) и `BetaAutoBoot` ре-фитит `scout_location`. Не критично в dev, но утомительно. Можно добавить sessionStorage.
8. **ROLLOUT.md не обновлён** — последний коммит (`c49902d`) не отразил auto-fire toggle и Cancel в ROLLOUT.md. Дописать.

## Pre-existing main-баги, которые я починил по дороге

Если когда-нибудь будем мержить в main, эти три фикса пригодятся всем (не только BETA):

1. **React 18/19 split** — root `package.json` тащил React 19, `src/ui/` — React 18. Vite грузил root-версию → silent 0-children mount. Убрал лишние UI-deps из root.
2. **Vite proxy port** — было 8083, бэкенд на 8080. Поправил.
3. **`ref` prop в `Thumbnail`/`LockedThumbnail`** — `ref` зарезервировано React, тихо стирался → краш компонента → размонтирование страницы. Переименовал в `refData`.

## Как продолжить

```bash
cd C:/Users/ZAKHAR/Documents/STANISLAVSKY/repos/LocationScout-Base
git checkout experiment/beta-2-screens
git log --oneline -5
# смотри BETA_TEST_RESULTS.md, ROLLOUT.md, этот файл
```

Когда будешь мержить или пушить:

- В `main` напрямую — нельзя без ревью.
- На GitHub/в облако — это деплой; `release` в этом проекте — production-only, идёт через `/deploy-agent`.
- Пуш в `origin experiment/beta-2-screens` для шеринга — норм.

Ничего не удалено. Все скрытые экраны и backend-степы остаются в коде с BETA-комментариями. Возврат — по `ROLLOUT.md`.
