# AEGIS Architecture Documentation

## 1. Architectural Style: Modular Monolith with Clean Architecture
AEGIS is built as a **Modular Monolith** following **Clean Architecture** (`Aegis.sln`).

### Why a Modular Monolith?
1. **Transactional Integrity**: Critical crisis operations (allocating scarce insulin/water, recording a two-person human decision, writing a localized `NotificationOutbox` row, and sealing a SHA-256 `AuditLogEntry`) must succeed or roll back atomically within a single PostgreSQL ACID transaction. Distributed sagas or 2PC across microservices would introduce partial-failure risks during life-safety operations.
2. **Team Size & Coursework Deadline**: A single solution with strict project boundaries avoids container orchestration overhead while enforcing compile-time separation of concerns.
3. **Simpler Deployment & Observability**: One deployable ASP.NET Core container and one Serilog pipeline simplify root-cause analysis.

### Path to Microservices Later
Because every module communicates through interfaces in `Aegis.Application` and domain events via `IDomainEventDispatcher`, high-throughput modules (`AiEngine`, `NotificationOutboxWorker`, `RoutingService`) can later be extracted into independent worker services backed by RabbitMQ/Kafka without rewriting `Aegis.Domain`.

---

## 2. Clean Architecture Layers
- **`src/Aegis.Domain`**: Enterprise entities, enums, `Result<T>`, domain events, and repository/UoW interfaces. Zero external package dependencies.
- **`src/Aegis.Application`**: Use-case interfaces, DTOs, FluentValidation validators, `IAllocationStrategy` implementations, and `NotificationFactory` / `RecommendationFactory`. No EF Core dependency.
- **`src/Aegis.Infrastructure`**: `AegisDbContext` (Npgsql + snake_case in schema `aegis`), `AuditService`, `RuleBasedAiProvider`, `OsrmRoutingService` (with Polly resilience), `LocalFileStorage`, MailKit `SmtpNotificationProvider`, and `NotificationOutboxWorker`.
- **`src/Aegis.Api`**: Thin REST controllers under `/api/v1`, JWT bearer authentication, RBAC policies, rate limiting, RFC 7807 `ExceptionHandlingMiddleware`, and Swagger.

---

## 3. OOP & GoF Design Patterns Implemented
| Pattern | Classes / Interfaces | Purpose |
|---|---|---|
| **Repository + Unit of Work** | `IRepository<T>`, `Repository<T>`, `IUnitOfWork`, `UnitOfWork` | Abstracts persistence and guarantees atomic multi-entity transactions. |
| **Dependency Injection** | `Program.cs` composition root + all service interfaces | Decouples controllers and use cases from concrete infrastructure implementations. |
| **Strategy** | `IAllocationStrategy`, `MaxUrgencyStrategy`, `FairShareStrategy`, `FastestEtaStrategy` | Swaps shortage allocation algorithms at runtime in the Scenario Lab (`POST /api/v1/scenarios/shortage`). |
| **Factory** | `NotificationFactory`, `RecommendationFactory` | Encapsulates creation of localized (EN/SI/TA) outbox messages and standardized AI recommendations. |
| **Observer** | `IDomainEvent`, `IDomainEventHandler<T>`, `IDomainEventDispatcher` | Lightweight in-house event dispatcher decoupling request/decision state changes from side effects. |
| **Transactional Outbox** | `NotificationOutbox`, `NotificationOutboxWorker` | Ensures notifications are persisted in the same DB transaction as business state changes and delivered with exponential backoff. |

---

## 4. Event-Driven Workflow & Resilience Path
1. **Request Created**: Citizen submits `POST /api/v1/requests` (with optional `Idempotency-Key`).
2. **AI Scoring**: `RuleBasedAiProvider` evaluates multilingual keywords (EN/SI/TA), vulnerability signals, waiting time, and resource fit, producing an `AiRecommendation` (`Priority`, `Confidence`, `RationaleJson`, `FeatureScoresJson`).
   - *Degraded-Mode Fallback*: If `AiEngine` is unhealthy/degraded, the request is automatically set to `ManualTriage` so human coordinators can triage without interruption.
3. **Human-in-the-Loop Decision**: AI never mutates operational state on its own. A coordinator calls `POST /api/v1/ai/recommendations/{id}/decision` (`Approve`, `Modify`, `Reject`, `Defer`), supplying a mandatory justification (for `Modify`/`Reject`) and a distinct `SecondApproverId` (for critical/medical cases).
4. **Notification & Audit**: In the same transaction, `NotificationFactory` writes a `NotificationOutbox` record and `AuditService` locks `AuditChainHead` (`pg_advisory_xact_lock`) to append a SHA-256 hash-chained `AuditLogEntry`. `NotificationOutboxWorker` dispatches the message asynchronously with exponential backoff (`2^attempts` min).
