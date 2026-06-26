# Ruflo — Claude Code Configuration

## Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — prefer editing existing files
- NEVER create documentation files unless explicitly requested
- NEVER save working files or tests to root — use `/src`, `/tests`, `/docs`, `/config`, `/scripts`
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- NEVER add a `Co-Authored-By` trailer to user commits unless this project's `.claude/settings.json` has `attribution.commit` set (#2078). The Claude Code Bash tool may suggest one in its default commit-message template — ignore it. `Co-Authored-By` is semantic authorship attribution under git/GitHub convention; the tool is the facilitator, not a co-author.
- Keep files under 500 lines
- Validate input at system boundaries

## Agent Comms (SendMessage-First Coordination)

Named agents coordinate via `SendMessage`, not polling or shared state.

```
Lead (you) ←→ architect ←→ developer ←→ tester ←→ reviewer
              (named agents message each other directly)
```

### Spawning a Coordinated Team

```javascript
// ALL agents in ONE message, each knows WHO to message next
Agent({ prompt: "Research the codebase. SendMessage findings to 'architect'.",
  subagent_type: "researcher", name: "researcher", run_in_background: true })
Agent({ prompt: "Wait for 'researcher'. Design solution. SendMessage to 'coder'.",
  subagent_type: "system-architect", name: "architect", run_in_background: true })
Agent({ prompt: "Wait for 'architect'. Implement it. SendMessage to 'tester'.",
  subagent_type: "coder", name: "coder", run_in_background: true })
Agent({ prompt: "Wait for 'coder'. Write tests. SendMessage results to 'reviewer'.",
  subagent_type: "tester", name: "tester", run_in_background: true })
Agent({ prompt: "Wait for 'tester'. Review code quality and security.",
  subagent_type: "reviewer", name: "reviewer", run_in_background: true })

// Kick off the pipeline
SendMessage({ to: "researcher", summary: "Start", message: "[task context]" })
```

### Patterns

| Pattern | Flow | Use When |
|---------|------|----------|
| **Pipeline** | A → B → C → D | Sequential dependencies (feature dev) |
| **Fan-out** | Lead → A, B, C → Lead | Independent parallel work (research) |
| **Supervisor** | Lead ↔ workers | Ongoing coordination (complex refactor) |

### Rules

- ALWAYS name agents — `name: "role"` makes them addressable
- ALWAYS include comms instructions in prompts — who to message, what to send
- Spawn ALL agents in ONE message with `run_in_background: true`
- After spawning: STOP, tell user what's running, wait for results
- NEVER poll status — agents message back or complete automatically

## Swarm & Routing

### Config
- **Topology**: hierarchical-mesh (anti-drift)
- **Max Agents**: 8
- **Memory**: hybrid
- **HNSW**: Enabled
- **Neural**: Enabled

```bash
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized
```

### Agent Routing

| Task | Agents | Topology |
|------|--------|----------|
| Bug Fix | researcher, coder, tester | hierarchical |
| Feature | architect, coder, tester, reviewer | hierarchical |
| Refactor | architect, coder, reviewer | hierarchical |
| Performance | perf-engineer, coder | hierarchical |
| Security | security-architect, auditor | hierarchical |

### When to Swarm
- **YES**: 3+ files, new features, cross-module refactoring, API changes, security, performance
- **NO**: single file edits, 1-2 line fixes, docs updates, config changes, questions

### 3-Tier Model Routing

| Tier | Handler | Use Cases |
|------|---------|-----------|
| 1 | Agent Booster (WASM) | Simple transforms — skip LLM, use Edit directly |
| 2 | Haiku | Simple tasks, low complexity |
| 3 | Sonnet/Opus | Architecture, security, complex reasoning |

## Memory & Learning

### Before Any Task
```bash
npx @claude-flow/cli@latest memory search --query "[task keywords]" --namespace patterns
npx @claude-flow/cli@latest hooks route --task "[task description]"
```

### After Success
```bash
npx @claude-flow/cli@latest memory store --namespace patterns --key "[name]" --value "[what worked]"
npx @claude-flow/cli@latest hooks post-task --task-id "[id]" --success true --store-results true
```

### MCP Tools (use `ToolSearch("keyword")` to discover)

| Category | Key Tools |
|----------|-----------|
| **Memory** | `memory_store`, `memory_search`, `memory_search_unified` |
| **Bridge** | `memory_import_claude`, `memory_bridge_status` |
| **Swarm** | `swarm_init`, `swarm_status`, `swarm_health` |
| **Agents** | `agent_spawn`, `agent_list`, `agent_status` |
| **Hooks** | `hooks_route`, `hooks_post-task`, `hooks_worker-dispatch` |
| **Security** | `aidefence_scan`, `aidefence_is_safe`, `aidefence_has_pii` |
| **Hive-Mind** | `hive-mind_init`, `hive-mind_consensus`, `hive-mind_spawn` |

### Background Workers

| Worker | When |
|--------|------|
| `audit` | After security changes |
| `optimize` | After performance work |
| `testgaps` | After adding features |
| `map` | Every 5+ file changes |
| `document` | After API changes |

```bash
npx @claude-flow/cli@latest hooks worker dispatch --trigger audit
```

## Agents

**Core**: `coder`, `reviewer`, `tester`, `planner`, `researcher`
**Architecture**: `system-architect`, `backend-dev`, `mobile-dev`
**Security**: `security-architect`, `security-auditor`
**Performance**: `performance-engineer`, `perf-analyzer`
**Coordination**: `hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`
**GitHub**: `pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`

Any string works as a custom agent type.

## Build & Test

- ALWAYS run tests after code changes
- ALWAYS verify build succeeds before committing

```bash
npm run build && npm test
```

## CLI Quick Reference

```bash
npx @claude-flow/cli@latest init --wizard           # Setup
npx @claude-flow/cli@latest swarm init --v3-mode     # Start swarm
npx @claude-flow/cli@latest memory search --query "" # Vector search
npx @claude-flow/cli@latest hooks route --task ""    # Route to agent
npx @claude-flow/cli@latest doctor --fix             # Diagnostics
npx @claude-flow/cli@latest security scan            # Security scan
npx @claude-flow/cli@latest performance benchmark    # Benchmarks
```

26 commands, 140+ subcommands. Use `--help` on any command for details.

## Setup

```bash
claude mcp add claude-flow -- npx -y ruflo@latest mcp start
npx ruflo@latest doctor --fix
```

> The background `daemon` is optional. It runs interval workers that each spawn
> a headless `claude` session, so it consumes tokens continuously. Start it only
> if you want those sweeps: `npx ruflo@latest daemon start` (self-stops after 12h
> by default; `--ttl 0` to disable, `daemon status --all` to audit running daemons).

**Agent tool** handles execution (agents, files, code, git). **MCP tools** handle coordination (swarm, memory, hooks). **CLI** is the same via Bash.

---

# Constitución del Proyecto — All Motors Cloud

**Versión:** 1.0 | **Estado:** Activo | **Última actualización:** Junio 2026

---

## Propósito del Proyecto

All Motors Cloud nace desde un taller mecánico real.
No fue concebido por una empresa de software intentando comprender el funcionamiento de un taller.
Fue concebido por el propietario de All Motors SPA, un taller mecánico ubicado en Chile, a partir de problemas reales detectados durante años de operación utilizando distintos sistemas de gestión.

El objetivo del proyecto no es crear un ERP genérico.
El objetivo es construir la mejor plataforma de gestión para talleres mecánicos.
La tecnología nunca será el objetivo. Será únicamente el medio para mejorar la operación del taller.

---

## Qué NO estamos construyendo

- No estamos construyendo un clon de TallerGP.
- No estamos replicando su arquitectura.
- No estamos intentando copiar su interfaz.
- No queremos desarrollar un software con cientos de funciones innecesarias.
- No queremos un sistema donde el mecánico pase más tiempo usando el software que reparando vehículos.

---

## Qué estamos construyendo

Una plataforma llamada **All Motors Cloud**, diseñada desde la experiencia de un taller mecánico real.
Con el tiempo estará compuesta por distintos productos que compartirán la misma base de datos. Ejemplo:

- Core ERP
- Recepción Digital
- Check-In Inteligente
- Historial Técnico
- App del Mecánico
- Portal del Cliente
- CRM
- Inventario
- Compras
- Business Intelligence
- Inteligencia Artificial
- API Pública

Todos compartirán un mismo modelo de dominio.

---

## Estado actual

El proyecto se encuentra en su etapa de fundación. Ya se logró:

- Conexión con la API oficial de TallerGP.
- Autenticación (OAuth2 + access token).
- Exploración de 15 tipos de entidades con paginación completa.
- Extracción de clientes, vehículos y órdenes de trabajo.
- Validación del historial del vehículo SRDV88.
- Comparación entre el historial de la API y el historial visible en TallerGP.

**Conclusión:** La API permite reconstruir prácticamente todo el historial técnico del vehículo.
TallerGP será únicamente una fuente de migración de datos. Nunca será el modelo del nuevo sistema.

---

## Estado del Producto

### Fase actual

Fase 0 — Migración y Fundación.

### Completado

- Migration Toolkit: conexión, autenticación, exploración y validación de datos.
- Data Discovery Engine: catálogo de 15 entidades con análisis de campos.
- Vehicle History Validator: reconstrucción del historial completo por patente.
- Product Bible: estructura inicial y Capítulo 00 (Preámbulo).

### En desarrollo

- Product Bible: capítulos 01 al 04.
- Scripts de migración completa de datos históricos.

### Próximos hitos

- Modelo de datos del Core ERP.
- Migración completa: 2.842 clientes, 3.539 vehículos, 5.449 órdenes de trabajo.
- Inicio de desarrollo del Core ERP — Fase 1.

---

## Fuente Oficial de Verdad

Toda decisión funcional debe quedar documentada.
La documentación oficial del producto vive en `docs/product-bible/`.

Si existe una contradicción entre el código y la documentación:
**la documentación tiene prioridad. El código deberá adaptarse. Nunca al revés.**

---

## Principios Fundamentales

Estos principios nunca deben romperse.

**1. El vehículo es la entidad principal.**
Todo gira alrededor del vehículo. No alrededor de la factura. No alrededor de la Orden de Trabajo.

**2. El historial técnico es el activo más importante.**
Debe contener toda la vida del vehículo, incluyendo:

- Diagnósticos
- Presupuestos
- Trabajos realizados
- Trabajos rechazados
- Fotografías
- Videos
- Scanner
- Garantías
- Recomendaciones
- Próximas mantenciones

**3. El software nunca debe disminuir la productividad.**
El taller gana dinero reparando vehículos, no utilizando software.
Toda funcionalidad debe reducir trabajo. Nunca aumentarlo.

**4. Toda información debe capturarse una sola vez.**
Nunca pedir dos veces el mismo dato.

**5. La evidencia tiene prioridad sobre el texto.**
Siempre que sea posible, utilizar:

- Fotografías
- Videos
- PDF
- Firmas
- Archivos

Antes que descripciones largas.

**6. Todo debe quedar trazado.**
Cada acción importante debe registrar:

- Usuario
- Fecha
- Hora
- Acción realizada

Nunca debe perderse el historial.

**7. El software debe adaptarse al taller.**
Nunca obligar al taller a cambiar su forma de trabajar solamente para adaptarse al sistema.

---

## Filosofía de Desarrollo

Antes de desarrollar cualquier funcionalidad, siempre debe responderse:

> *¿Esta funcionalidad mejora realmente la operación del taller?*

Si la respuesta es no, debe replantearse.
No desarrollar funcionalidades solamente porque son técnicamente interesantes.

---

## Productividad

El tiempo del mecánico es el recurso más valioso del taller. Por lo tanto:

- Reducir clics.
- Reducir escritura.
- Automatizar procesos.
- Utilizar tablet cuando corresponda.
- Registrar información de forma automática.

**Regla general:** si una tarea frecuente requiere más de tres clics o más de diez segundos, debe rediseñarse.

---

## Arquitectura

Toda nueva funcionalidad debe respetar:

- Arquitectura modular.
- Código limpio.
- Responsabilidades separadas.
- Reutilización.
- Escalabilidad.
- Mantenibilidad.

No duplicar lógica de negocio.

---

## Estructura del Proyecto

```
docs/                  — Documentación general del proyecto
  product-bible/       — Fuente oficial de verdad del producto
  decisions/           — Registro de decisiones de arquitectura (ADRs)
migration-toolkit/     — Herramientas de extracción y migración desde TallerGP
backend/               — Servidor de la plataforma (próxima fase)
frontend/              — Interfaces de usuario (próxima fase)
packages/              — Paquetes compartidos del monorepo
scripts/               — Scripts de utilidad y automatización
```

---

## Uso de TallerGP

TallerGP será utilizado únicamente como fuente de migración.

- No copiar su arquitectura.
- No copiar sus limitaciones.
- No copiar su experiencia de usuario.

Analizar la información. Comprender el negocio. Construir una solución mejor.

---

## Rol de Claude

Claude actúa como Arquitecto de Software y Editor Técnico del proyecto.
Antes de escribir código debe:

1. Revisar la Product Bible.
2. Revisar decisiones de arquitectura.
3. Verificar que la funcionalidad respete los principios del proyecto.
4. Identificar riesgos.
5. Proponer mejoras.

Nunca asumir reglas de negocio que no estén documentadas.
Cuando exista duda, solicitar que primero se documente la decisión antes de implementarla.

---

## Restricciones

1. Nunca asumir reglas de negocio que no estén documentadas.
2. Consultar siempre la Product Bible antes de diseñar nuevas funcionalidades.
3. No duplicar lógica de negocio.
4. No crear documentación paralela fuera de la Product Bible.
5. Toda decisión importante debe quedar documentada.

---

## Objetivo Final

All Motors Cloud no busca convertirse únicamente en un software de gestión.
Busca convertirse en el **Sistema Operativo de un Taller Mecánico**.
Cada decisión debe acercar al proyecto a ese objetivo.
