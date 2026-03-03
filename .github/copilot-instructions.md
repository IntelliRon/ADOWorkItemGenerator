<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## TypeScript Node.js Project Setup

This workspace contains a TypeScript Node.js project for creating ADO Work Items.

**Project Status:** Ready for development

### Project Details
- **Language:** TypeScript
- **Runtime:** Node.js v25.6.1+
- **Package Manager:** npm
- **Main Entry Point:** src/index.ts
- **Build Output:** dist/
- **Project Structure:**
  - `src/` - TypeScript source code files
  - `dist/` - Compiled JavaScript (generated)
  - `tsconfig.json` - TypeScript compiler configuration
  - `package.json` - Project configuration

### Available Scripts
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Build and run the project
- `npm run dev` - Run in development mode with ts-node
- `npm run clean` - Remove build artifacts

### Environment Variables Required
- `PERSONAL_ACCESS_TOKEN` - Personal access token for Azure DevOps
- `ORG` - Azure DevOps organization
- `PROJECT` - Azure DevOps project

### Development Guidelines
- All source code should be in the `src/` directory
- TypeScript strict mode is enabled
- Type annotations are required for all variables and functions
- Compiled output goes to the `dist/` directory

