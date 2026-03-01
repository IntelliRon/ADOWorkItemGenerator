# ADO Work Item Creator

A TypeScript Node.js application for programmatically creating Azure DevOps (ADO) work items using templates.

## Features

- Create ADO work items via the Azure DevOps API
- Template-based work item creation with variable substitution
- TypeScript with strict type checking
- Environment-based configuration

## Prerequisites

- Node.js v14 or higher
- npm
- Azure DevOps account with API access
- Personal Access Token (PAT) for Azure DevOps authentication

## Installation

```bash
npm install
```

## Configuration

### Environment Variables

Create a `.env` file in the project root with the following variables:

```
AZURE_PERSONAL_ACCESS_TOKEN=your-personal-access-token-here
ORG=your-ado-organization-name
PROJECT=your-ado-project-name
```

- **AZURE_PERSONAL_ACCESS_TOKEN** - Your Azure DevOps Personal Access Token (required for API authentication)
- **ORG** - Your Azure DevOps organization name (required)
- **PROJECT** - Your Azure DevOps project name (required)

## Usage

Run the application:

```bash
npm start
```

This will execute the ADO Work Item Creator with the configuration from your `.env` file.

## Project Structure

```
├── src/
│   └── index.ts              # Main entry point
├── work-item-templates/
│   └── workItemTemplate.json # Template for work item creation
├── tests/                    # Test files
├── package.json              # Project dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
```

## Work Item Templates

Work item templates are defined in JSON format. Example template:

```json
{
    "project": "Test",
    "type": "Task",
    "System.Title": "Test Work Item from Template",
    "System.Description": "This work item was created from a JSON template with variables. Here is a variable {{Variable1}}.",
    "System.IterationPath": "Test",
    "System.State": "To Do"
}
```

Templates support variable substitution using the `{{VariableName}}` syntax.

## Development

- All source code should be placed in the `src/` directory
- TypeScript strict mode is enabled
- Type annotations are required for all variables and functions

## Technologies

- **TypeScript** - Static type checking for JavaScript
- **ts-node** - Execute TypeScript directly without compilation
- **azure-devops-node-api** - Official Azure DevOps Node.js API client
- **dotenv** - Environment variable management

## License

ISC

