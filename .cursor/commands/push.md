# Git Push Automation Command

Automate the complete git workflow with intelligent staging, committing, and pushing to the current branch with proper error handling and validation.

## 🚀 Command Flow

Execute a complete git workflow with these automated steps:
1. **Stage Changes**: Add all modified, new, and deleted files to staging
2. **Generate Commit**: Create descriptive commit message based on changes
3. **Push to Branch**: Push committed changes to remote origin branch
4. **Validation**: Verify successful push and provide status feedback

## 📝 Core Functionality

### Automatic Staging
- Stage all tracked file modifications (`git add -A`)
- Include new untracked files relevant to the project
- Handle file deletions and renames properly
- Skip staging of ignored files (.gitignore compliance)
- Provide summary of staged changes before commit

### Intelligent Commit Messages
Generate commit messages following conventional commit standards:
- **Feature**: `feat: add new dashboard component with metrics cards`
- **Fix**: `fix: resolve authentication flow redirect issue`
- **Style**: `style: update button colors to match Joveo design system`
- **Refactor**: `refactor: optimize data fetching in chart components`
- **Docs**: `docs: update API documentation for chart endpoints`
- **Test**: `test: add unit tests for metric card calculations`

### Branch Management
- Automatically detect current branch name
- Push to `release` by default
- Handle upstream branch setup for new branches
- Provide clear feedback on push success/failure
- Offer retry mechanism for failed pushes

## 🔧 Command Execution

### Interactive Mode
```bash
# Prompt for commit message
git add -A
echo "Staged changes summary:"
git status --short
echo -n "Enter commit message: "
read commit_message
git commit -m "$commit_message"
git push origin $(git branch --show-current)
```

### Quick Mode with Auto-Message
```bash
# Generate commit message from staged changes
git add -A
commit_msg=$(git diff --cached --name-only | head -5 | xargs -I {} echo "Update {}" | paste -sd ", " -)
git commit -m "feat: $commit_msg"
git push origin $(git branch --show-current)
```

### Feature-Specific Mode
Allow user to specify the type of changes:
- Accept feature description as parameter
- Generate conventional commit message
- Include relevant files in commit scope
- Apply appropriate commit type prefix

## ⚡ Advanced Features

### Pre-Push Validation
- Check for uncommitted changes
- Verify remote branch exists or offer to create
- Run basic syntax checks on TypeScript/JavaScript files
- Check for potential merge conflicts

### Error Handling
- Handle authentication failures gracefully
- Provide clear error messages for network issues
- Offer solutions for common git problems:
  - Untracked files in ignored directories
  - Large file warnings
  - Branch protection violations
  - Merge conflicts requiring resolution

### Status Reporting
After successful push, provide:
- Number of files changed
- Lines added/removed summary
- Remote branch status
- Link to create pull request (if applicable)
- Next suggested actions

## 🎯 Usage Examples

### Basic Push
```bash
# Stages all changes, prompts for message, pushes to current branch
@push
```

### Feature Push
```bash
# Commits with feature-specific message
@push "add metric cards to dashboard"
# Results in: "feat: add metric cards to dashboard"
```

### Quick Fix Push
```bash
# For bug fixes
@push --fix "resolve chart loading timeout"
# Results in: "fix: resolve chart loading timeout"
```

### Style Update Push
```bash
# For design system updates
@push --style "update colors to match Joveo design tokens"
# Results in: "style: update colors to match Joveo design tokens"
```

## 🛡️ Safety Features

### Confirmation Prompts
- Show staged files before commit
- Confirm push to remote branch
- Warning for pushing to main/master branches
- Option to review diff before committing

### Rollback Support
- Provide commands to undo last commit if needed
- Store last commit hash for easy reference
- Offer to create backup branch before risky operations

### Branch Protection
- Prevent accidental pushes to protected branches
- Suggest creating feature branch instead
- Require explicit confirmation for main branch pushes

## 📊 Integration Features

### CI/CD Awareness
- Check for running CI/CD pipelines
- Warning if push might break ongoing deployments
- Integration with common platforms (GitHub Actions, etc.)

### Team Workflow
- Detect if pull request should be created
- Check for required reviewers on target branch
- Suggest creating draft PR for work-in-progress

### Project Context
- Use project-specific commit message templates
- Apply conventional commit standards for the repository
- Include relevant issue/ticket numbers if detected

## 🔍 Monitoring & Feedback

### Progress Indicators
- Show progress during each git operation
- Provide estimated time for large pushes
- Display network transfer progress for large files

### Success Confirmation
- Confirm successful push with branch status
- Display commit hash and message
- Show remote branch URL for verification
- Provide next action suggestions

Execute the complete git workflow with intelligent automation, proper error handling, and clear feedback throughout the process.
