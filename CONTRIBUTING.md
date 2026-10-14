# Contributing to ERD Forge

Thank you for your interest in contributing to ERD Forge! We welcome contributions to our local-first schema modeling and SQL lineage workstation.

---

## Code of Conduct

Please be respectful, collaborative, and considerate of others in all discussions, pull requests, and issues.

---

## Development Setup

### Prerequisites

- **Node.js**: v20 or higher
- **pnpm**: v9 or higher

### Getting Started

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/fobiddenai/erd-forge.git
   cd erd-forge
   ```

2. **Install monorepo dependencies:**
   ```bash
   pnpm install
   ```

3. **Start the local development server:**
   ```bash
   pnpm dev
   ```
   Open `http://localhost:5173` in your browser.

---

## Development Workflow

### Building Peggy Grammar
If you edit the SDL grammar in `apps/web/src/parsers/sdl/grammar.pegjs`, recompile it with:
```bash
pnpm --filter @erd-forge/web build:grammar
```

### Type Checking
Strict TypeScript mode is enforced across all packages:
```bash
pnpm typecheck
```

### Running Tests
All tests are powered by Vitest:
```bash
# Run all tests
pnpm test

# Run tests in watch mode during development
pnpm --filter @erd-forge/web test:watch
```

### Building for Production
```bash
pnpm build
```

---

## Submitting Pull Requests

1. **Branch Naming**:
   - `feat/feature-name` for new features
   - `fix/bug-description` for bug fixes
   - `docs/documentation-update` for documentation changes
2. **Commit Hygiene**: Write clear, descriptive commit messages adhering to Conventional Commits (e.g. `feat: add Snowflake dialect support in lineage parser`).
3. **Pre-flight Checks**: Ensure `pnpm typecheck` and `pnpm test` pass with 0 errors before pushing your branch.
4. **Open PR**: Create a Pull Request against the `main` branch with a clear description of your changes and motivation.
